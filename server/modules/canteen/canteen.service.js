import { CanteenModel } from "./canteen.model.js";
import { UserModel } from "../users/users.model.js";
import { buildEmployeeAccess } from "../employees/employee.helpers.js";
import { createAuditLog } from "../../utils/auditLog.js";
import {
  employeeFullName,
  formatMealDate,
  parseMealDate,
  toMealDate,
  todayMealDate,
} from "./canteen.helpers.js";

const DENY_NO_ALLOWANCE = "no_allowance";
const DENY_LIMIT_REACHED = "limit_reached";

// Крупная карточка держится столько, дальше экран уходит на ленту
const DISPLAY_WINDOW_SECONDS = 20;

// Длина ленты последних проходов
const DISPLAY_FEED_LIMIT = 12;

const toInt = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const trim = (value, max = 255) =>
  typeof value === "string" && value.trim() !== ""
    ? value.trim().slice(0, max)
    : null;

// Доступ к записям столовой ограничен так же, как к сотрудникам:
// филиалом/отделом пользователя.
const buildAccessWhere = async (userId) => {
  const user = await UserModel.getById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");

  const access = buildEmployeeAccess(user);
  return Object.keys(access).length > 0 ? { employee: access } : {};
};

const employeeSearchOr = (search) => {
  const numericId = toInt(search);
  return [
    { employee: { first_name: { contains: search, mode: "insensitive" } } },
    { employee: { last_name: { contains: search, mode: "insensitive" } } },
    { employee: { middle_name: { contains: search, mode: "insensitive" } } },
    { employee: { employee_number: { contains: search, mode: "insensitive" } } },
    ...(Number.isInteger(numericId) && numericId > 0
      ? [{ employee_id: numericId }]
      : []),
  ];
};

const employeePlacementWhere = (filters) => {
  const employee = {};
  if (filters.branch_id) employee.branch_id = toInt(filters.branch_id);
  if (filters.department_id)
    employee.department_id = toInt(filters.department_id);
  if (filters.position_id) employee.position_id = toInt(filters.position_id);
  return Object.keys(employee).length > 0 ? employee : null;
};

// where по сотруднику из access и из фильтров надо объединять: присваивание
// перетёрло бы ограничение доступа и показало чужой филиал
const mergeEmployeeWhere = (where, employeeWhere) => {
  if (!employeeWhere) return where;
  where.employee = { ...(where.employee || {}), ...employeeWhere };
  return where;
};

const formatEmployee = (employee) =>
  employee
    ? {
        employeeFullName: employeeFullName(employee),
        employeeNumber: employee.employee_number || null,
        employeePhoto: employee.photo || null,
        branchName: employee.branch?.name || null,
        departmentName: employee.department?.name || null,
        positionName: employee.position?.name || null,
      }
    : {};

const formatAllowance = (row) => ({
  id: row.id,
  employee_id: row.employee_id,
  daily_limit: row.daily_limit,
  status: row.status,
  note: row.note,
  added_at: row.added_at,
  updated_at: row.updated_at,
  employee_status: row.employee?.status ?? null,
  ...formatEmployee(row.employee),
});

const formatMeal = (row) => ({
  id: row.id,
  employee_id: row.employee_id,
  date: row.date,
  meal_date: formatMealDate(row.meal_date),
  status: row.status,
  deny_reason: row.deny_reason,
  daily_limit: row.daily_limit,
  photo: row.photo ?? null,
  employee_status: row.employee?.status ?? null,
  deviceId: row.faceDevice?.id ?? row.face_device_id ?? null,
  deviceName: row.faceDevice?.name ?? null,
  ...formatEmployee(row.employee),
});

export const CanteenService = {
  // ─── Нормы порций ─────────────────────────────────────────────────────────
  getAllowances: async ({ userId, page, pageSize, filters = {} }) => {
    const currentPage = Math.max(toInt(page, 1) || 1, 1);
    const limit = Math.max(toInt(pageSize, 50) || 50, 1);
    const skip = (currentPage - 1) * limit;

    const where = await buildAccessWhere(userId);

    if (filters.search) where.OR = employeeSearchOr(filters.search);
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true" || filters.status === true;

    mergeEmployeeWhere(where, employeePlacementWhere(filters));

    const [rows, total] = await Promise.all([
      CanteenModel.findAllowances({ where, skip, take: limit }),
      CanteenModel.countAllowances(where),
    ]);

    // Сколько уже получено сегодня — колонка «Остаток» в таблице
    const mealDate = todayMealDate();
    const used = await Promise.all(
      rows.map((row) => CanteenModel.countServed(row.employee_id, mealDate)),
    );

    const data = rows.map((row, i) => {
      const usedToday = used[i];
      const limitToday = row.status ? row.daily_limit : 0;
      return {
        ...formatAllowance(row),
        used_today: usedToday,
        remaining_today: Math.max(0, limitToday - usedToday),
      };
    });

    return {
      data,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getAllowanceStats: async ({ userId }) => {
    const accessWhere = await buildAccessWhere(userId);
    const mealDate = todayMealDate();

    const [total, active, dailyCapacity, statuses] = await Promise.all([
      CanteenModel.countAllowances(accessWhere),
      CanteenModel.countAllowances({ ...accessWhere, status: true }),
      CanteenModel.sumDailyLimit({ ...accessWhere, status: true }),
      CanteenModel.groupMealsByStatus({ ...accessWhere, meal_date: mealDate }),
    ]);

    const byStatus = Object.fromEntries(
      statuses.map((s) => [s.status, s._count._all]),
    );

    const servedToday = byStatus.served || 0;

    return {
      total,
      active,
      // суммарная дневная ёмкость столовой
      dailyCapacity,
      servedToday,
      remainingToday: Math.max(0, dailyCapacity - servedToday),
      deniedToday: byStatus.denied || 0,
    };
  },

  getAllowanceById: async (id) => {
    const row = await CanteenModel.findAllowanceById(id);
    return row ? formatAllowance(row) : null;
  },

  // Одна форма назначает норму сразу нескольким сотрудникам
  assignAllowances: async (
    { employee_ids, daily_limit, status, note },
    userId,
  ) => {
    const ids = (Array.isArray(employee_ids) ? employee_ids : [employee_ids])
      .map((id) => toInt(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
      const err = new Error("Не выбран ни один сотрудник");
      err.statusCode = 400;
      throw err;
    }

    const limit = toInt(daily_limit, 1);
    if (!Number.isInteger(limit) || limit < 0 || limit > 20) {
      const err = new Error("Норма должна быть числом от 0 до 20");
      err.statusCode = 400;
      throw err;
    }

    const data = {
      daily_limit: limit,
      status: status === undefined ? true : status === true || status === "true",
      note: trim(note),
      added_by: toInt(userId),
    };

    const result = [];
    for (const employeeId of ids) {
      const old = await CanteenModel.findAllowanceByEmployee(employeeId);
      const saved = await CanteenModel.upsertAllowance(employeeId, data);
      await createAuditLog({
        userId,
        action: old ? "update" : "create",
        entity: "canteen_allowances",
        recordId: saved.id,
        oldData: old,
        newData: saved,
      });
      result.push(formatAllowance(saved));
    }

    return result;
  },

  updateAllowance: async (id, { daily_limit, status, note }, userId) => {
    const old = await CanteenModel.findAllowanceById(id);
    if (!old) {
      const err = new Error("Норма не найдена");
      err.statusCode = 404;
      throw err;
    }

    const data = {};
    if (daily_limit !== undefined) {
      const limit = toInt(daily_limit);
      if (!Number.isInteger(limit) || limit < 0 || limit > 20) {
        const err = new Error("Норма должна быть числом от 0 до 20");
        err.statusCode = 400;
        throw err;
      }
      data.daily_limit = limit;
    }
    if (status !== undefined) data.status = status === true || status === "true";
    if (note !== undefined) data.note = trim(note);

    const saved = await CanteenModel.updateAllowance(id, data);
    await createAuditLog({
      userId,
      action: "update",
      entity: "canteen_allowances",
      recordId: Number(id),
      oldData: old,
      newData: saved,
    });
    return formatAllowance(saved);
  },

  deleteAllowance: async (id, userId) => {
    const old = await CanteenModel.findAllowanceById(id);
    if (!old) {
      const err = new Error("Норма не найдена");
      err.statusCode = 404;
      throw err;
    }
    const result = await CanteenModel.deleteAllowance(id);
    await createAuditLog({
      userId,
      action: "delete",
      entity: "canteen_allowances",
      recordId: Number(id),
      oldData: old,
    });
    return result;
  },

  // ─── Списание порции по событию терминала ─────────────────────────────────
  // Вызывается обработчиком события face-устройства с purpose = "canteen".
  // Решение о выдаче принимается здесь, а не на устройстве: терминал умеет
  // только узнавать лицо.
  registerFromDeviceEvent: async ({
    employeeId,
    faceDeviceId,
    date,
    identifier,
    photo,
  }) => {
    const eventDate =
      date instanceof Date ? date : new Date(date || Date.now());
    const mealDate = toMealDate(eventDate);

    const allowance = await CanteenModel.findAllowanceByEmployee(employeeId);
    const limit = allowance?.status ? allowance.daily_limit : 0;
    const usedToday = await CanteenModel.countServed(employeeId, mealDate);

    let status = "served";
    let denyReason = null;

    if (!allowance || !allowance.status) {
      status = "denied";
      denyReason = DENY_NO_ALLOWANCE;
    } else if (usedToday >= limit) {
      status = "denied";
      denyReason = DENY_LIMIT_REACHED;
    }

    try {
      const meal = await CanteenModel.createMeal({
        employee_id: Number(employeeId),
        face_device_id: faceDeviceId ? Number(faceDeviceId) : null,
        date: eventDate,
        meal_date: mealDate,
        identifier: identifier || null,
        status,
        deny_reason: denyReason,
        daily_limit: limit,
        photo: photo || null,
      });

      const served = status === "served" ? usedToday + 1 : usedToday;
      return {
        ...formatMeal(meal),
        used_today: served,
        remaining_today: Math.max(0, limit - served),
        canteen: true,
      };
    } catch (err) {
      // то же событие уже обработано (webhook + опрос устройства)
      if (err.code === "P2002") return { canteen: true, duplicate: true };
      // сотрудника нет в базе — терминал знает больше, чем HR
      if (err.code === "P2003" || err.code === "P2025")
        return { canteen: true, notFound: true };
      throw err;
    }
  },

  // Пакетная обработка событий из опроса устройств (крон events_sync).
  // Норма проверяется по каждому событию отдельно и в хронологическом
  // порядке — иначе второй обед за день прошёл бы как выданный.
  registerPolledEvents: async (events) => {
    const sorted = [...events].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let saved = 0;
    for (const event of sorted) {
      try {
        const result = await CanteenService.registerFromDeviceEvent(event);
        if (!result.duplicate && !result.notFound) saved++;
      } catch (err) {
        console.error(
          `canteen: событие ${event.identifier} не сохранено:`,
          err.message,
        );
      }
    }
    return saved;
  },

  // ─── Экран столовой ───────────────────────────────────────────────────────
  getDisplayState: async ({ userId, deviceId, limit }) => {
    const accessWhere = await buildAccessWhere(userId);
    const mealDate = todayMealDate();

    const where = { ...accessWhere, meal_date: mealDate };
    if (deviceId) where.face_device_id = toInt(deviceId);

    const feedLimit = Math.min(
      Math.max(toInt(limit, DISPLAY_FEED_LIMIT) || DISPLAY_FEED_LIMIT, 1),
      50,
    );

    const [devices, rows, statuses] = await Promise.all([
      CanteenModel.findCanteenDevices(),
      CanteenModel.findMeals({ where, skip: 0, take: feedLimit }),
      CanteenModel.groupMealsByStatus(where),
    ]);

    const byStatus = Object.fromEntries(
      statuses.map((s) => [s.status, s._count._all]),
    );

    // Остаток берём текущий, а не «на момент прохода»: у раздачи важно,
    // сколько человеку положено прямо сейчас.
    const servedRows = await CanteenModel.servedByEmployee(
      [...new Set(rows.map((r) => r.employee_id))],
      mealDate,
    );

    const servedByEmployee = new Map();
    for (const served of servedRows) {
      const list = servedByEmployee.get(served.employee_id) || [];
      list.push(served.id);
      servedByEmployee.set(served.employee_id, list);
    }

    const recent = rows.map((row) => {
      const servedIds = servedByEmployee.get(row.employee_id) || [];
      const usedToday = servedIds.length;
      const ageSeconds = (Date.now() - new Date(row.date).getTime()) / 1000;
      // Какой по счёту была эта порция за день: «2 / 3», а не остаток —
      // остаток у всех строк сотрудника одинаковый и ничего не говорит
      const portionIndex = servedIds.indexOf(row.id);
      return {
        ...formatMeal(row),
        used_today: usedToday,
        remaining_today: Math.max(0, (row.daily_limit || 0) - usedToday),
        portion_no: portionIndex >= 0 ? portionIndex + 1 : null,
        age_seconds: Math.round(ageSeconds),
        fresh: ageSeconds <= DISPLAY_WINDOW_SECONDS,
      };
    });

    return {
      // event — та же первая строка ленты, вынесена для крупной карточки
      event: recent[0] || null,
      recent,
      devices,
      today: {
        date: formatMealDate(mealDate),
        served: byStatus.served || 0,
        denied: byStatus.denied || 0,
      },
      windowSeconds: DISPLAY_WINDOW_SECONDS,
    };
  },

  // ─── Журнал порций ────────────────────────────────────────────────────────
  getMeals: async ({ userId, page, pageSize, filters = {} }) => {
    const currentPage = Math.max(toInt(page, 1) || 1, 1);
    const limit = Math.max(toInt(pageSize, 50) || 50, 1);
    const skip = (currentPage - 1) * limit;

    const where = await buildAccessWhere(userId);

    if (filters.search) where.OR = employeeSearchOr(filters.search);
    if (filters.status === "served" || filters.status === "denied")
      where.status = filters.status;
    if (filters.device_id) where.face_device_id = toInt(filters.device_id);

    const from = parseMealDate(filters.date_from);
    const to = parseMealDate(filters.date_to);
    if (from || to) {
      where.meal_date = {};
      if (from) where.meal_date.gte = from;
      if (to) where.meal_date.lte = to;
    }

    mergeEmployeeWhere(where, employeePlacementWhere(filters));

    const [rows, total] = await Promise.all([
      CanteenModel.findMeals({ where, skip, take: limit }),
      CanteenModel.countMeals(where),
    ]);

    return {
      data: rows.map(formatMeal),
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // Ошибочный проход (двойное срабатывание терминала, чужое лицо).
  // Удаление снимает и списание нормы: остаток на день считается
  // количеством строк со статусом served.
  deleteMeal: async (id, userId) => {
    const mealId = toInt(id);
    if (!Number.isInteger(mealId) || mealId <= 0) {
      const err = new Error("Некорректный идентификатор прохода");
      err.statusCode = 400;
      throw err;
    }

    const accessWhere = await buildAccessWhere(userId);
    const old = await CanteenModel.findMealById(mealId, accessWhere);
    if (!old) {
      const err = new Error("Проход не найден");
      err.statusCode = 404;
      throw err;
    }

    await CanteenModel.deleteMeal(mealId);
    await createAuditLog({
      userId,
      action: "delete",
      entity: "canteen_meals",
      recordId: mealId,
      oldData: old,
    });
    return formatMeal(old);
  },

  // Массовое удаление проходов из журнала. Строки вне доступа пользователя
  // молча отбрасываются, а не роняют всю операцию.
  bulkDeleteMeals: async (ids, userId) => {
    const list = [
      ...new Set(
        (Array.isArray(ids) ? ids : [ids])
          .map((id) => toInt(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];

    if (list.length === 0) {
      const err = new Error("Не выбран ни один проход");
      err.statusCode = 400;
      throw err;
    }

    const accessWhere = await buildAccessWhere(userId);
    const rows = await CanteenModel.findMealsByIds(list, accessWhere);
    if (rows.length === 0) {
      const err = new Error("Проходы не найдены");
      err.statusCode = 404;
      throw err;
    }

    const allowedIds = rows.map((row) => row.id);
    await CanteenModel.deleteMealsByIds(allowedIds);

    for (const row of rows) {
      await createAuditLog({
        userId,
        action: "delete",
        entity: "canteen_meals",
        recordId: row.id,
        oldData: row,
      });
    }

    return { deleted: allowedIds.length, skipped: list.length - rows.length };
  },

  // ─── Отчёт ────────────────────────────────────────────────────────────────
  // group_by: employee (по умолчанию) | department | branch
  getReport: async ({ userId, filters = {} }) => {
    const accessWhere = await buildAccessWhere(userId);

    const from = parseMealDate(filters.date_from) || todayMealDate();
    const to = parseMealDate(filters.date_to) || from;

    // Норма в отчёте — план на весь период: дневной лимит × число суток
    const days = Math.max(
      Math.round((to.getTime() - from.getTime()) / 86400000) + 1,
      1,
    );

    const where = { ...accessWhere, meal_date: { gte: from, lte: to } };
    if (filters.search) where.OR = employeeSearchOr(filters.search);
    if (filters.device_id) where.face_device_id = toInt(filters.device_id);
    mergeEmployeeWhere(where, employeePlacementWhere(filters));

    // Нормы тянем отдельно от проходов: сотрудник с нормой, но без единого
    // прохода, тоже должен попасть в отчёт — со строкой «выдано 0».
    // Фильтр по терминалу к нормам не применяется: норма не привязана к нему.
    const allowanceWhere = { ...accessWhere, status: true };
    if (filters.search) allowanceWhere.OR = employeeSearchOr(filters.search);
    mergeEmployeeWhere(allowanceWhere, employeePlacementWhere(filters));

    const [rows, allowances] = await Promise.all([
      CanteenModel.mealsForReport(where),
      CanteenModel.findAllowances({ where: allowanceWhere }),
    ]);

    const groupBy = ["employee", "department", "branch"].includes(
      filters.group_by,
    )
      ? filters.group_by
      : "employee";

    const keyOf = (employee, employeeId) => {
      if (groupBy === "department")
        return String(employee?.department?.id ?? "none");
      if (groupBy === "branch") return String(employee?.branch?.id ?? "none");
      return String(employeeId);
    };

    const labelOf = (employee, employeeId) => {
      if (groupBy === "department") return employee?.department?.name || "—";
      if (groupBy === "branch") return employee?.branch?.name || "—";
      return employeeFullName(employee) || `#${employeeId}`;
    };

    const groups = new Map();
    const groupFor = (employee, employeeId) => {
      const key = keyOf(employee, employeeId);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: labelOf(employee, employeeId),
          employee_id: groupBy === "employee" ? employeeId : null,
          employeeNumber: employee?.employee_number || null,
          employeePhoto: employee?.photo || null,
          employee_status: employee?.status ?? null,
          branchName: employee?.branch?.name || null,
          departmentName: employee?.department?.name || null,
          positionName: employee?.position?.name || null,
          allowance: 0,
          served: 0,
          denied: 0,
          servedEmployees: new Set(),
        });
      }
      return groups.get(key);
    };

    for (const row of allowances)
      groupFor(row.employee, row.employee_id).allowance +=
        row.daily_limit * days;

    for (const row of rows) {
      const group = groupFor(row.employee, row.employee_id);
      if (row.status === "served") {
        group.served++;
        group.servedEmployees.add(row.employee_id);
      } else {
        group.denied++;
      }
    }

    const data = [...groups.values()]
      .map(({ servedEmployees, ...group }) => ({
        ...group,
        employees_served: servedEmployees.size,
      }))
      .sort(
        (a, b) =>
          b.served - a.served ||
          String(a.label).localeCompare(String(b.label), "ru"),
      );

    const totals = data.reduce(
      (acc, group) => ({
        allowance: acc.allowance + group.allowance,
        served: acc.served + group.served,
        denied: acc.denied + group.denied,
      }),
      { allowance: 0, served: 0, denied: 0 },
    );

    return {
      data,
      totals: {
        ...totals,
        // сотрудников, реально получивших порцию, а не просто прошедших
        employees_served: new Set(
          rows.filter((r) => r.status === "served").map((r) => r.employee_id),
        ).size,
        rows: rows.length,
      },
      period: {
        date_from: formatMealDate(from),
        date_to: formatMealDate(to),
        days,
      },
      group_by: groupBy,
    };
  },

  getDevices: async () => CanteenModel.findCanteenDevices(),
};
