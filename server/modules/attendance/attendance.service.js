import { DateTime } from "luxon";

import { UserModel } from "../users/users.model.js";
import {
  generateAttendanceReport,
  countScheduledDays,
  countScheduledMinutes,
  getScheduledDayKeys,
} from "../../utils/attendanceUtils.js";
import { EmployeeService } from "../employees/employees.service.js";
import { splitEmployeesByTodayStatus } from "./attendance.helpers.js";
import { canAccessEmployee } from "../employees/employee.helpers.js";
import { findLateEmployeesByDay } from "../lateEmployees/lateEmployees.helpers.js";
import { FacePassesService } from "../facePasses/facePasses.service.js";
import { TimeOffService } from "../timeOff/timeOff.service.js";
import { BranchService } from "../branches/branches.service.js";
import { DepartmentsService } from "../departments/departments.service.js";
import { PositionsService } from "../positions/positions.service.js";
import { EmployeeWorkScheduleHistoryModel } from "../employeeScheduleHistory/employeeScheduleHistory.model.js";

// Добавляет синтетические записи в faceEvents для сотрудников без проходов,
// чтобы generateAttendanceReport мог обработать их отгулы (day_off/vacation/hour).
async function augmentFaceEventsWithMissingEmployees(faceEvents, employees) {
  const presentIds = new Set(faceEvents.map((e) => String(e.employeeId)));
  const missing = employees.filter((emp) => !presentIds.has(String(emp.id)));
  if (!missing.length) return;

  const scheduleHistories = await EmployeeWorkScheduleHistoryModel.findByEmployeeIds(
    missing.map((e) => Number(e.id)),
  );

  const schedByEmp = {};
  for (const sh of scheduleHistories) {
    const eid = String(sh.employee_id);
    if (!schedByEmp[eid]) schedByEmp[eid] = [];
    schedByEmp[eid].push(sh);
  }

  for (const emp of missing) {
    faceEvents.push({
      employeeId: Number(emp.id),
      employeeNumber: emp.employeeNumber ?? null,
      employeeFullName: emp.employeeFullName,
      employeePhoto: emp.employeePhoto ?? null,
      branchName: emp.branchName ?? null,
      departmentName: emp.departmentName ?? null,
      positionName: emp.positionName ?? null,
      pinfl: emp.pinfl ?? null,
      workScheduleName: null,
      workSchedule: schedByEmp[String(emp.id)] ?? null,
      events: [],
    });
  }
}

// Режим «за период»: данные агрегируются по дням диапазона. Каждый день несёт
// свой срез посещаемости (пришли / не пришли / опоздали / …) с разбивкой
// по филиалам и отделам, плюс итоги по сотрудникам за весь период.
async function getAttendancePeriodService({ userId, filters }) {
  const from = DateTime.fromISO(String(filters.date_from), {
    zone: "Asia/Tashkent",
  });
  const to = DateTime.fromISO(String(filters.date_to), {
    zone: "Asia/Tashkent",
  });

  if (!from.isValid || !to.isValid) {
    const err = new Error("Некорректные даты периода");
    err.status = 400;
    throw err;
  }
  if (to < from) {
    const err = new Error("date_to раньше date_from");
    err.status = 400;
    throw err;
  }

  const fromKey = from.toFormat("yyyy-MM-dd");
  const toKey = to.toFormat("yyyy-MM-dd");

  // -1 день — чтобы захватить ночные смены, начавшиеся до начала периода
  const start_date = from.minus({ days: 1 }).startOf("day").toJSDate();
  const end_date = to.endOf("day").toJSDate();

  filters.start_date = start_date;
  filters.end_date = end_date;

  const [faceEvents, employees, timeOffs, branches, departments, positions] =
    await Promise.all([
      FacePassesService.getAll({ userId, filters }),
      EmployeeService.getActive({ userId, filters }),
      // getAll фильтрует по date_from/date_to; start_date/end_date он игнорирует
      TimeOffService.getAll({
        userId,
        filters: { date_from: start_date, date_to: end_date },
      }),
      BranchService.listActive({ userId }),
      DepartmentsService.getActiveDepartments({ userId }),
      PositionsService.getActivePositions(),
    ]);

  await augmentFaceEventsWithMissingEmployees(faceEvents, employees.data);

  // График нужен для плановых дней — в отчёте его нет, берём из входных данных
  const scheduleByEmployee = new Map(
    faceEvents.map((e) => [String(e.employeeId), e.workSchedule]),
  );

  const attendanceEvents = generateAttendanceReport(faceEvents, timeOffs);

  const schedFrom = from.startOf("day").toJSDate();
  const schedTo = to.endOf("day").toJSDate();

  const dayKeys = [];
  for (
    let cursor = from.startOf("day");
    cursor <= to.startOf("day");
    cursor = cursor.plus({ days: 1 })
  ) {
    dayKeys.push(cursor.toFormat("yyyy-MM-dd"));
  }

  const emptyCounts = () => ({
    totalEmployees: 0,
    scheduledEmployees: 0,
    present: 0,
    absent: 0,
    late: 0,
    lateMinutes: 0,
    inside: 0,
    left: 0,
    onTimeOff: 0,
  });

  const daysMap = new Map(
    dayKeys.map((date) => [
      date,
      { date, ...emptyCounts(), branches: new Map() },
    ]),
  );

  // День → филиал → отдел: счётчики инкрементируются на всех трёх уровнях
  const groupsForDay = (day, branchName, departmentName) => {
    if (!day.branches.has(branchName)) {
      day.branches.set(branchName, {
        name: branchName,
        ...emptyCounts(),
        departments: new Map(),
      });
    }

    const branch = day.branches.get(branchName);

    if (!branch.departments.has(departmentName)) {
      branch.departments.set(departmentName, {
        name: departmentName,
        ...emptyCounts(),
      });
    }

    return [day, branch, branch.departments.get(departmentName)];
  };

  const bump = (groups, field, value = 1) => {
    for (const group of groups) group[field] += value;
  };

  const periodStats = attendanceEvents.map((employee) => {
    const workSchedule = scheduleByEmployee.get(String(employee.employeeId));
    const scheduledDays = new Set(
      getScheduledDayKeys(schedFrom, schedTo, workSchedule),
    );

    const branchName = employee.branchName || null;
    const departmentName = employee.departmentName || null;

    let workedDays = 0;
    let absentDays = 0;
    let timeOffDays = 0;
    let lateDays = 0;
    let lateMinutes = 0;

    for (const dayKey of dayKeys) {
      const groups = groupsForDay(
        daysMap.get(dayKey),
        branchName,
        departmentName,
      );

      bump(groups, "totalEmployees");

      const isScheduled = scheduledDays.has(dayKey);
      if (isScheduled) bump(groups, "scheduledEmployees");

      const session = employee.sessions?.[dayKey];
      const hasEvents =
        Array.isArray(session?.events) && session.events.length > 0;
      const isCompanyPaidOff = session?.timeOff?.isCompanyPaid === true;

      // Ни проходов, ни оплачиваемого отгула — пропуск, но только в рабочий день
      if (!session || (!hasEvents && !isCompanyPaidOff)) {
        if (isScheduled) {
          absentDays += 1;
          bump(groups, "absent");
        }
        continue;
      }

      // Отгул за счёт компании на весь день — не present и не absent
      if (!hasEvents && session.timeOff.type !== "hour") {
        timeOffDays += 1;
        bump(groups, "onTimeOff");
        continue;
      }

      workedDays += 1;
      bump(groups, "present");

      const lastDirection = session.events.at(-1)?.direction;
      if (lastDirection === "entry") bump(groups, "inside");
      else if (lastDirection === "exit") bump(groups, "left");

      const [lateRecord] = findLateEmployeesByDay(
        [{ ...employee, sessions: { [dayKey]: session } }],
        dayKey,
      );
      if (lateRecord) {
        lateDays += 1;
        lateMinutes += lateRecord.lateMinutes || 0;
        bump(groups, "late");
        bump(groups, "lateMinutes", lateRecord.lateMinutes || 0);
      }
    }

    return {
      employeeId: String(employee.employeeId),
      workedDays,
      absentDays,
      timeOffDays,
      lateDays,
      lateMinutes,
      scheduledDays: scheduledDays.size,
    };
  });

  const days = dayKeys.map((date) => {
    const { branches: dayBranches, ...totals } = daysMap.get(date);

    return {
      ...totals,
      branches: [...dayBranches.values()].map((branch) => {
        const { departments: branchDepartments, ...branchTotals } = branch;
        return {
          ...branchTotals,
          departments: [...branchDepartments.values()],
        };
      }),
    };
  });

  return {
    data: {
      mode: "period",
      period: { from: fromKey, to: toKey, days: dayKeys.length },
      employees: employees.data,
      branches: branches.data,
      departments: departments.data,
      positions: positions.data,
      days,
      periodStats,
      // Мгновенных статусов за период нет — поля оставлены для совместимости
      present: [],
      absent: [],
      late: [],
      inside: [],
      left: [],
      onTimeOff: [],
    },
  };
}

export async function getAttendanceService({ userId, filters }) {
  const user = await UserModel.getById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");

  if (filters?.mode === "period") {
    return getAttendancePeriodService({ userId, filters });
  }

  const dt = DateTime.fromISO(filters.date, { zone: "Asia/Tashkent" });
  const dayKey = dt.toFormat("yyyy-MM-dd");

  const start_date = dt.minus({ days: 1 }).startOf("day").toJSDate();
  const end_date = dt.endOf("day").toJSDate();

  filters.start_date = start_date;
  filters.end_date = end_date;

  const [faceEvents, employees, timeOffs, branches, departments, positions] =
    await Promise.all([
      FacePassesService.getAll({ userId, filters }),
      EmployeeService.getActive({ userId, filters }),
      // getAll фильтрует по date_from/date_to; start_date/end_date он игнорирует
      TimeOffService.getAll({
        userId,
        filters: { date_from: start_date, date_to: end_date },
      }),
      BranchService.listActive({ userId }),
      DepartmentsService.getActiveDepartments({ userId }),
      PositionsService.getActivePositions(),
    ]);

  await augmentFaceEventsWithMissingEmployees(faceEvents, employees.data);

  let attendanceEvents = generateAttendanceReport(faceEvents, timeOffs);

  attendanceEvents = attendanceEvents.map((item) => ({
    ...item,
    sessions: item.sessions?.[dayKey]
      ? { [dayKey]: item.sessions[dayKey] }
      : {},
  }));

  const { present, absent, inside, left, onTimeOff } =
    splitEmployeesByTodayStatus(attendanceEvents);

  const presentIds = new Set(present.map((item) => item.id));
  const filteredAttendanceEvents = attendanceEvents.filter((item) =>
    presentIds.has(item.id),
  );

  const late = await findLateEmployeesByDay(
    filteredAttendanceEvents,
    filters.date,
  );

  return {
    data: {
      employees: employees.data,
      branches: branches.data,
      departments: departments.data,
      positions: positions.data,
      present: present,
      absent: absent,
      late: late,
      inside: inside,
      left: left,
      onTimeOff: onTimeOff,
    },
  };
}

export async function getAttendanceServiceByEmployeeId({
  userId,
  employeeId,
  filters = {},
}) {
  const user = await UserModel.getById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");

  const dt = filters.date
    ? DateTime.fromISO(filters.date, { zone: "Asia/Tashkent" })
    : DateTime.now().setZone("Asia/Tashkent");

  const dayKey = dt.toFormat("yyyy-MM-dd");

  // Границы дня и месяца
  const dayStart = dt.minus({ days: 1 }).startOf("day").toJSDate();
  const dayEnd = dt.endOf("day").toJSDate();
  const monthStart = dt
    .startOf("month")
    .minus({ days: 1 })
    .startOf("day")
    .toJSDate();
  const monthEnd = dt.endOf("month").endOf("day").toJSDate();

  // FacePassesService/TimeOffService читают только employeeIds (мн. число): одиночный
  // employeeId они игнорируют и отдают данные всех сотрудников из зоны доступа.
  const employeeIds = [Number(employeeId)];
  const employeeFilters = { ...filters, employeeIds };

  const [
    dayFaceEvents,
    monthFaceEvents,
    employee,
    dayTimeOffs,
    monthTimeOffs,
  ] = await Promise.all([
    FacePassesService.getAll({
      userId,
      filters: { ...employeeFilters, start_date: dayStart, end_date: dayEnd },
    }),
    FacePassesService.getAll({
      userId,
      filters: {
        ...employeeFilters,
        start_date: monthStart,
        end_date: monthEnd,
      },
    }),
    EmployeeService.getById(employeeId),
    // TimeOffService.getAll фильтрует по date_from/date_to (пересечение диапазонов),
    // а start_date/end_date игнорирует — раньше приходила вся история отгулов
    TimeOffService.getAll({
      userId,
      filters: { employeeIds, date_from: dayStart, date_to: dayEnd },
    }),
    TimeOffService.getAll({
      userId,
      filters: { employeeIds, date_from: monthStart, date_to: monthEnd },
    }),
  ]);

  if (!employee) throw new Error("Сотрудник не найден");

  if (!canAccessEmployee(user, employee)) {
    const err = new Error("Нет доступа к сотруднику");
    err.status = 403;
    throw err;
  }

  // --- Инициализация дефолтных значений ---
  let daySessions = {};
  let dayLate = null;

  let monthStats = {
    workedDays: 0,
    lateDays: 0,
    lateDetails: [],
    sessions: {},
  };

  // ─── Обработка данных за ДЕНЬ ─────────────────────────────────────
  // Даже без событий за день нужно прогнать через generateAttendanceReport,
  // чтобы учесть day_off/vacation/hour company-paid time-off (синтетическая сессия).
  const dayAttendanceInput =
    dayFaceEvents && dayFaceEvents.length > 0
      ? dayFaceEvents
      : [
          {
            employeeId: Number(employeeId),
            employeeFullName: employee.employeeFullName,
            workSchedule: employee.employeeScheduleHistory || null,
            events: [],
          },
        ];

  const dayAttendanceEvents = generateAttendanceReport(
    dayAttendanceInput,
    dayTimeOffs,
  );

  const dayEvent = dayAttendanceEvents.find(
    (e) => String(e.employeeId) === String(employeeId),
  );

  if (dayEvent && dayEvent.sessions?.[dayKey]) {
    daySessions = { [dayKey]: dayEvent.sessions[dayKey] };

    // Проверка на опоздание только если есть сессии
    // 3-й аргумент — includeLunchLate. Раньше сюда попадал список праздников
    // (всегда truthy), поэтому обеденные опоздания тут учитывались всегда —
    // поведение сохранено явным true.
    const [lateResult] = await findLateEmployeesByDay(
      [{ ...dayEvent, sessions: daySessions }],
      dayKey,
      true,
    );
    dayLate = lateResult;
  }

  // ─── Обработка данных за МЕСЯЦ ────────────────────────────────────
  if (monthFaceEvents && monthFaceEvents.length > 0) {
    const monthAttendanceEvents = generateAttendanceReport(
      monthFaceEvents,
      monthTimeOffs,
    );

    const monthEvent = monthAttendanceEvents.find(
      (e) => String(e.employeeId) === String(employeeId),
    );

    if (monthEvent && monthEvent.sessions) {
      const monthDays = Object.keys(monthEvent.sessions);

      // Убираем .then(), так как findLateEmployeesByDay возвращает массив, а не Promise
      const monthLateChecks = monthDays.map((date) => {
        const result = findLateEmployeesByDay(
          [{ ...monthEvent, sessions: { [date]: monthEvent.sessions[date] } }],
          date,
          true,
        );

        // Результат функции - массив, берем первый элемент или null
        return result && result[0] ? result[0] : null;
      });

      monthStats = {
        workedDays: monthEvent.totalWorkedDays,
        lateDays: monthLateChecks.filter(Boolean).length,
        lateDetails: monthLateChecks.filter(Boolean),
        sessions: monthEvent.sessions,
      };
    }
  }

  // Плановые рабочие дни и часы за весь месяц по графику
  const schedMonthStart = dt.startOf("month").toJSDate();
  const schedMonthEnd = dt.endOf("month").toJSDate();
  const scheduledDays = employee.employeeScheduleHistory?.length
    ? countScheduledDays(
        schedMonthStart,
        schedMonthEnd,
        employee.employeeScheduleHistory,
      )
    : 0;
  const scheduledMinutes = employee.employeeScheduleHistory?.length
    ? countScheduledMinutes(
        schedMonthStart,
        schedMonthEnd,
        employee.employeeScheduleHistory,
      )
    : 0;

  // Прошедшие плановые дни (для расчёта пропусков):
  // - текущий месяц → до сегодня; прошлый месяц → весь месяц
  const now = DateTime.now().setZone("Asia/Tashkent");
  const isCurrentMonth = dt.year === now.year && dt.month === now.month;
  const schedToDate = isCurrentMonth ? now.toJSDate() : schedMonthEnd;
  const scheduledDaysToDate = employee.employeeScheduleHistory?.length
    ? countScheduledDays(
        schedMonthStart,
        schedToDate,
        employee.employeeScheduleHistory,
      )
    : 0;

  // Возвращаем структуру в любом случае
  const daySession = daySessions[dayKey] || null;
  const todayStatus = !daySession
    ? "absent"
    : daySession.timeOff?.isCompanyPaid && daySession.timeOff.type !== "hour"
      ? "on_time_off"
      : dayLate
        ? "late"
        : "present";

  return {
    data: {
      employee,
      today: {
        date: dayKey,
        sessions: daySessions,
        isLate: !!dayLate,
        lateInfo: dayLate ?? null,
        status: todayStatus,
      },
      month: {
        from: dt.startOf("month").toFormat("yyyy-MM-dd"),
        to: dt.endOf("month").toFormat("yyyy-MM-dd"),
        ...monthStats,
        scheduledDays,
        scheduledMinutes,
        scheduledDaysToDate,
      },
    },
  };
}
