import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import XLSX from "xlsx";
import JSZip from "jszip";
import { prismaContext } from "../../utils/prismaContext.js";

import { EmployeeModel } from "./employees.model.js";
import { createAuditLog } from "../../utils/auditLog.js";
import { UserModel } from "../users/users.model.js";
import { FaceDevicesService } from "../faceDevices/faceDevices.service.js";
import { buildEmployeeAccess, removeUndefined } from "./employee.helpers.js";
import { EmploymentOrdersModel } from "../employmentOrders/employmentOrders.model.js";
import { DepartmentsModel } from "../departments/departments.model.js";
import { EmployeeWorkScheduleHistoryModel } from "../employeeScheduleHistory/employeeScheduleHistory.model.js";
import { EmploymentOrdersService } from "../employmentOrders/employmentOrders.service.js";

function getEmployeeNumericPriority(emp, s) {
  if (String(emp.id) === s) return 1;
  if (String(emp.employee_number || "") === s) return 2;
  if ((emp.pinfl || "").includes(s)) return 3;
  if ((emp.passport || "").toLowerCase().includes(s.toLowerCase())) return 4;
  return 5;
}

const buildFullName = (e) =>
  [e?.last_name, e?.first_name, e?.middle_name].filter(Boolean).join(" ");

const REHIRE_LIST_LIMIT = 50;

const toDateOnly = (d) => (d ? new Date(d).toISOString().split("T")[0] : null);

// Дата увольнения — из последнего приказа, если он «terminate»
const getFiredDate = (e) => {
  const last = e.employmentOrders?.[0];
  return last?.type === "terminate" ? toDateOnly(last.date) : null;
};

const pickEmployeeAuditFields = (e) =>
  e
    ? {
        id: e.id,
        last_name: e.last_name,
        first_name: e.first_name,
        middle_name: e.middle_name,
        gender: e.gender,
        date_of_birth: e.date_of_birth,
        pinfl: e.pinfl,
        passport: e.passport,
        passport_expiry_date: e.passport_expiry_date,
        phone: e.phone,
        email: e.email,
        address: e.address,
        education: e.education,
        education_specialty: e.education_specialty,
        employee_number: e.employee_number,
        status: e.status,
        work_schedule_id: e.work_schedule_id,
      }
    : null;

export const EmployeeService = {
  create: async (userId, rawData, file) => {
    const user = await UserModel.getById(Number(userId));

    if (!user) throw new Error("Пользователь не найден");

    if (
      !rawData.last_name ||
      !rawData.first_name ||
      !rawData.pinfl ||
      !rawData.order_date ||
      !rawData.branch_id ||
      !rawData.department_id ||
      !rawData.position_id
    ) {
      throw new Error("Не указаны обязательные данные");
    }

    let photoPath;

    if (file) {
      photoPath = file?.filename;
    }

    const employeeData = removeUndefined({
      employee_number: rawData.employee_number
        ? String(rawData.employee_number)
        : undefined,
      last_name: rawData.last_name,
      first_name: rawData.first_name,
      middle_name: rawData.middle_name,
      gender: rawData.gender,
      date_of_birth: rawData.date_of_birth
        ? new Date(rawData.date_of_birth)
        : undefined,
      pinfl: rawData.pinfl,
      passport: rawData.passport,
      passport_expiry_date: rawData.passport_expiry_date
        ? new Date(rawData.passport_expiry_date)
        : undefined,
      education: rawData.education,
      education_specialty: rawData.education_specialty,
      phone: rawData.phone,
      email: rawData.email,
      address: rawData.address,
      photo: photoPath,
      branch: rawData.branch_id
        ? { connect: { id: Number(rawData.branch_id) } }
        : undefined,
      department: rawData.department_id
        ? { connect: { id: Number(rawData.department_id) } }
        : undefined,
      position: rawData.position_id
        ? { connect: { id: Number(rawData.position_id) } }
        : undefined,
      workSchedule: rawData.work_schedule_id
        ? { connect: { id: Number(rawData.work_schedule_id) } }
        : undefined,
      status: true,
    });

    if (rawData.door_ids) {
      const doorIdsArray = Array.isArray(rawData.door_ids)
        ? rawData.door_ids
        : rawData.door_ids.split(",").map((s) => s.trim());

      const doorIds = doorIdsArray
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d > 0);

      if (doorIds.length > 0) {
        employeeData.doors = { connect: doorIds.map((id) => ({ id })) };
      }
    }

    const prisma = prismaContext.get();

    const newEmployee = await prisma.$transaction(async (tx) => {
      // 1️⃣ Создание сотрудника
      const createdEmployee = await EmployeeModel.create(employeeData, tx);

      // 2️⃣ Создание приказа (если есть)
      if (rawData.order_date || rawData.order_number) {
        const orderData = removeUndefined({
          date: rawData.order_date ? new Date(rawData.order_date) : null,
          order_number: rawData.order_number ?? null,
          type: "hire",
          branch: rawData.branch_id
            ? { connect: { id: Number(rawData.branch_id) } }
            : undefined,
          department: rawData.department_id
            ? { connect: { id: Number(rawData.department_id) } }
            : undefined,
          position: rawData.position_id
            ? { connect: { id: Number(rawData.position_id) } }
            : undefined,
          employee: { connect: { id: createdEmployee.id } },
        });

        await EmploymentOrdersModel.create(orderData, tx);
      }

      // 3️⃣ Создание истории графика (если есть)
      if (rawData.work_schedule_id) {
        await EmployeeWorkScheduleHistoryModel.create(
          {
            employee: { connect: { id: createdEmployee.id } },
            workSchedule: { connect: { id: Number(rawData.work_schedule_id) } },
            date_from: rawData.order_date
              ? new Date(rawData.order_date)
              : new Date(),
            date_to: null,
            addedBy: { connect: { id: Number(userId) } },
          },
          tx,
        );
      }

      return createdEmployee;
    });

    const wantsDoorSync = ["true", "1", true, 1].includes(rawData.sync_doors);

    if (rawData.door_ids && wantsDoorSync) {
      Promise.resolve()
        .then(() => FaceDevicesService.syncEmployee(newEmployee.id))
        .catch((err) =>
          console.error("Ошибка синхронизации с FaceDevice:", err),
        );
    }

    if (file && photoPath) {
      const clientFolder = path.dirname(photoPath);
      const newFileName = `${newEmployee.id}.jpg`;
      const newPhotoPath = `${clientFolder}/${newFileName}`;
      const oldFilePath = file.path;
      const newFilePath = path.join(path.dirname(file.path), newFileName);

      try {
        await fs.promises.rename(oldFilePath, newFilePath);
        const prisma = prismaContext.get();
        await prisma.employees.update({
          where: { id: newEmployee.id },
          data: { photo: newPhotoPath },
        });
        newEmployee.photo = newPhotoPath;
      } catch (err) {
        console.error("Ошибка при переименовании фото сотрудника:", err);
      }
    }

    await createAuditLog({
      userId,
      action: "create",
      entity: "employees",
      recordId: newEmployee.id,
      newData: pickEmployeeAuditFields(newEmployee),
    });
    return newEmployee;
  },

  getAll: async ({ userId, page, pageSize, filters = {} }) => {
    const {
      branch_id,
      branch_ids,
      department_id,
      department_ids,
      employee_id,
      employee_ids,
      not_employee_ids,
      position_id,
      position_ids,
      search,
      gender,
      status,
      has_work_schedule,
      sort_by,
      sort_order,
      hasEvents,
      hasEventsFrom,
      hasEventsTo,
    } = filters;

    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const where = { AND: [] };

    // --- фильтры ---
    if (branch_ids?.length) where.branch_id = { in: branch_ids.map(Number) };
    else if (branch_id) where.branch_id = Number(branch_id);

    if (department_ids?.length)
      where.department_id = { in: department_ids.map(Number) };
    else if (department_id) where.department_id = Number(department_id);

    if (employee_id) where.id = Number(employee_id);
    if (employee_ids?.length) where.id = { in: employee_ids.map(Number) };
    if (not_employee_ids?.length)
      where.id = { notIn: not_employee_ids.map(Number) };

    if (position_ids?.length)
      where.position_id = { in: position_ids.map(Number) };
    else if (position_id) where.position_id = Number(position_id);

    if (gender) where.gender = gender;

    if (status !== undefined && status !== null && status !== "") {
      if (typeof status === "string") {
        where.status = status === "true";
      } else {
        where.status = Boolean(status);
      }
    }

    if (
      has_work_schedule !== undefined &&
      has_work_schedule !== null &&
      has_work_schedule !== ""
    ) {
      const hasWorkSchedule =
        has_work_schedule === true || has_work_schedule === "true";
      where.work_schedule_id = hasWorkSchedule ? { not: null } : null;
    }

    const isNumericSearch = search && /^\d+$/.test(search.trim());

    if (search && search?.trim() !== "") {
      const s = search.trim();

      // 1. Пытаемся преобразовать строку в число
      const numericValue = Number(s);

      // 2. Проверяем, является ли число допустимым для INT4 (32-bit signed)
      // Это критически важно, чтобы не было ошибки ConversionError
      const isValidInt4 =
        !isNaN(numericValue) &&
        Number.isInteger(numericValue) &&
        numericValue >= -2147483648 &&
        numericValue <= 2147483647;

      let exactNumericFilters = [];
      if (isValidInt4) {
        // Поиск по числовым полям только если число "влезает" в INT4
        exactNumericFilters = [{ id: numericValue }];
      }

      // 3. Строковые фильтры (ПИНФЛ, Паспорт, номер табеля — всегда строки)
      const stringFilters = [
        { pinfl: { contains: s } },
        { passport: { contains: s, mode: "insensitive" } },
        { employee_number: { contains: s } },
      ];

      // 4. Разбор ФИО
      const parts = s.split(/\s+/).filter(Boolean);
      const fioSearch = {
        AND: parts.map((part) => ({
          OR: [
            { first_name: { contains: part, mode: "insensitive" } },
            { last_name: { contains: part, mode: "insensitive" } },
            { middle_name: { contains: part, mode: "insensitive" } },
          ],
        })),
      };

      // 5. Итоговое объединение через OR
      where.AND = [
        {
          OR: [...exactNumericFilters, ...stringFilters, fioSearch],
        },
      ];
    }

    // --- права доступа ---
    const accessFilter = buildEmployeeAccess(user);
    where.AND.push(accessFilter);

    // --- фильтр "есть события в месяце" на уровне SQL (exists), чтобы не тянуть
    // всех сотрудников постранично вручную в JS (см. timesheet.controller.js) ---
    if ((hasEvents === "yes" || hasEvents === "no") && hasEventsFrom && hasEventsTo) {
      const from = new Date(hasEventsFrom);
      const to = new Date(hasEventsTo);
      const eventsCondition = {
        OR: [
          { facePasses: { some: { date: { gte: from, lte: to } } } },
          {
            employeeTimeOffs: {
              some: {
                is_company_paid: true,
                date_from: { lte: to },
                date_to: { gte: from },
              },
            },
          },
        ],
      };
      where.AND.push(hasEvents === "yes" ? eventsCondition : { NOT: eventsCondition });
    }

    const currentPage = Math.max(parseInt(page) || 1, 1);
    const size = Math.max(parseInt(pageSize) || 50, 1);
    const skip = (currentPage - 1) * size;

    const { data: rawData, total } = await EmployeeModel.getAll(
      where,
      isNumericSearch ? 0 : skip,
      isNumericSearch ? 100000 : size,
      sort_by,
      sort_order,
    );

    let data = rawData;
    if (isNumericSearch && rawData.length > 0) {
      const s = search.trim();
      data = [...rawData].sort(
        (a, b) =>
          getEmployeeNumericPriority(a, s) - getEmployeeNumericPriority(b, s),
      );
      data = data.slice(skip, skip + size);
    }

    return {
      data,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: size,
        totalPages: Math.ceil(total / size),
      },
    };
  },

  // Все уволенные (status=false) без учёта зоны доступа логина: в обычном списке сотрудники
  // чужого филиала не видны, а принять их на работу логин может.
  getRehireCandidates: async ({ search }) => {
    const and = [{ status: false }];
    let exactWhere = null;

    const s = String(search || "").trim();
    if (s) {
      const parts = s.split(/\s+/).filter(Boolean);

      // ID — точное совпадение, и только если число влезает в INT4 (иначе Prisma падает с ConversionError)
      const numericValue = Number(s);
      const isValidInt4 =
        /^\d+$/.test(s) &&
        Number.isInteger(numericValue) &&
        numericValue <= 2147483647;

      and.push({
        OR: [
          ...(isValidInt4 ? [{ id: numericValue }] : []),
          { employee_number: { contains: s } },
          { pinfl: { contains: s } },
          { passport: { contains: s, mode: "insensitive" } },
          {
            AND: parts.map((part) => ({
              OR: [
                { first_name: { contains: part, mode: "insensitive" } },
                { last_name: { contains: part, mode: "insensitive" } },
                { middle_name: { contains: part, mode: "insensitive" } },
              ],
            })),
          },
        ],
      });

      // Точное совпадение по ID / таб. номеру — первым: короткое число даёт много вхождений
      // в ПИНФЛ, и нужный сотрудник мог бы не попасть в первые 50 строк
      if (/^\d+$/.test(s)) {
        exactWhere = {
          AND: [
            { status: false },
            {
              OR: [
                ...(isValidInt4 ? [{ id: numericValue }] : []),
                { employee_number: s },
              ],
            },
          ],
        };
      }
    }

    const { data: found, total } = await EmployeeModel.findRehireCandidates(
      { AND: and },
      REHIRE_LIST_LIMIT,
    );

    let data = found;
    if (exactWhere) {
      const { data: exact } = await EmployeeModel.findRehireCandidates(
        exactWhere,
        REHIRE_LIST_LIMIT,
      );
      const exactIds = new Set(exact.map((e) => e.id));
      data = [...exact, ...found.filter((e) => !exactIds.has(e.id))].slice(
        0,
        REHIRE_LIST_LIMIT,
      );
    }

    return {
      data: data.map((e) => ({
        id: e.id,
        last_name: e.last_name,
        first_name: e.first_name,
        middle_name: e.middle_name,
        pinfl: e.pinfl,
        photo: e.photo,
        branch_name: e.branch?.name ?? null,
        department_name: e.department?.name ?? null,
        position_name: e.position?.name ?? null,
        fired_date: getFiredDate(e),
      })),
      total,
    };
  },

  // Данные одного уволенного для подстановки в форму приёма (тот же отбор, что у списка)
  getRehireCandidate: async ({ id }) => {
    const e = await EmployeeModel.findRehireCandidate({
      id: Number(id),
      status: false,
    });
    if (!e) return null;

    const { employmentOrders, doors, ...rest } = e;

    return {
      ...rest,
      date_of_birth: toDateOnly(e.date_of_birth),
      passport_expiry_date: toDateOnly(e.passport_expiry_date),
      door_ids: doors.map((d) => d.id),
      fired_date: getFiredDate(e),
    };
  },

  // Повторный приём уволенного: новый сотрудник не создаётся — обновляем личные данные и
  // оформляем приказ о приёме. Статус, филиал, отдел и должность выставляет сам приказ.
  rehire: async (id, rawData, file, userId) => {
    if (
      !rawData.order_date ||
      !rawData.branch_id ||
      !rawData.department_id ||
      !rawData.position_id
    ) {
      throw new Error("Не указаны обязательные данные");
    }

    const candidate = await EmployeeModel.findRehireCandidate({
      id: Number(id),
    });
    if (!candidate) throw new Error("Сотрудник не найден");
    if (candidate.status !== false) throw new Error("Сотрудник уже работает");

    // Приказ о приёме должен стать последним, иначе статус по последнему приказу останется «уволен»
    const last = candidate.employmentOrders?.[0];
    if (
      last?.type === "terminate" &&
      new Date(rawData.order_date) <= new Date(last.date)
    ) {
      throw new Error(
        `Дата приёма должна быть позже даты увольнения (${toDateOnly(last.date)})`,
      );
    }

    const wantsDoorSync = ["true", "1", true, 1].includes(rawData.sync_doors);

    // Приказные поля и статус сюда не идут: update() их отбрасывает, а приказ выставит их сам
    const personal = { ...rawData, work_schedule_start_date: rawData.order_date };
    delete personal.sync_doors;
    delete personal.status;

    await EmployeeService.update(id, personal, file, userId);

    await EmploymentOrdersService.create(
      {
        type: "hire",
        employeeId: Number(id),
        order_number: rawData.order_number,
        order_date: rawData.order_date,
        branch_id: rawData.branch_id,
        department_id: rawData.department_id,
        position_id: rawData.position_id,
      },
      userId,
    );

    if (wantsDoorSync) {
      Promise.resolve()
        .then(() => FaceDevicesService.syncEmployee(Number(id)))
        .catch((err) =>
          console.error("Ошибка синхронизации с FaceDevice:", err),
        );
    }

    await createAuditLog({
      userId,
      action: "rehire",
      entity: "employees",
      recordId: id,
      newData: {
        branch_id: Number(rawData.branch_id),
        department_id: Number(rawData.department_id),
        position_id: Number(rawData.position_id),
        order_date: rawData.order_date,
      },
    });

    return { id: Number(id) };
  },

  getActive: async ({ userId, filters = {} }) => {
    const { branch_id, department_id } = filters;

    const user = await UserModel.getById(Number(userId));

    if (!user) {
      throw new Error("Пользователь не найден");
    }

    const accessWhere = buildEmployeeAccess(user);

    const where = { ...accessWhere, status: true };

    if (branch_id) {
      where.branch_id = Number(branch_id);
    }

    if (department_id) {
      where.department_id = Number(department_id);
    }

    const records = await EmployeeModel.getActive(where);

    const formatted = records.map((emp) => ({
      id: String(emp.id),
      employeeFullName:
        [emp.last_name, emp.first_name, emp.middle_name]
          .filter(Boolean)
          .join(" ") + ` (${emp.id})`,
      employeeNumber: emp.employee_number || null,
      employeePhoto: emp.photo || null,
      branchName: emp.branch?.name || null,
      departmentName: emp.department?.name || null,
      positionName: emp.position?.name || null,
    }));

    return {
      data: formatted,
    };
  },

  getStats: async ({ userId }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const accessFilter = buildEmployeeAccess(user);
    const prisma = prismaContext.get();

    // Current week: Monday 00:00 → Sunday 23:59
    const now = new Date();
    const dow = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const orderAccessFilter = Object.keys(accessFilter).length
      ? { employee: accessFilter }
      : {};

    const [
      total,
      active,
      fired,
      genderGroups,
      newThisWeek,
      firedThisWeek,
      birthdayCandidates,
    ] = await Promise.all([
      prisma.employees.count({ where: accessFilter }),
      prisma.employees.count({ where: { ...accessFilter, status: true } }),
      prisma.employees.count({ where: { ...accessFilter, status: false } }),
      prisma.employees.groupBy({
        by: ["gender"],
        where: accessFilter,
        _count: { id: true },
      }),
      prisma.employment_orders.count({
        where: {
          type: "hire",
          date: { gte: monday, lte: sunday },
          ...orderAccessFilter,
        },
      }),
      prisma.employment_orders.count({
        where: {
          type: "terminate",
          date: { gte: monday, lte: sunday },
          ...orderAccessFilter,
        },
      }),
      prisma.employees.findMany({
        where: { ...accessFilter, status: true, date_of_birth: { not: null } },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          middle_name: true,
          date_of_birth: true,
          photo: true,
          branch: { select: { name: true } },
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      }),
    ]);

    // Month/day pairs: today → Sunday (прошедшие дни рождения не показываем)
    const todayIdx = dow === 0 ? 6 : dow - 1; // 0 = понедельник
    const weekDays = Array.from({ length: 7 - todayIdx }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + todayIdx + i);
      return { month: d.getMonth() + 1, day: d.getDate() };
    });

    const birthdayList = birthdayCandidates
      .filter((emp) => {
        const dob = new Date(emp.date_of_birth);
        return weekDays.some(
          (wd) =>
            wd.month === dob.getUTCMonth() + 1 && wd.day === dob.getUTCDate(),
        );
      })
      .map((emp) => ({
        id: emp.id,
        full_name: [emp.last_name, emp.first_name, emp.middle_name]
          .filter(Boolean)
          .join(" "),
        date_of_birth: emp.date_of_birth,
        photo: emp.photo,
        branch: emp.branch?.name || null,
        department: emp.department?.name || null,
        position: emp.position?.name || null,
      }))
      .sort((a, b) => {
        const da = new Date(a.date_of_birth);
        const db = new Date(b.date_of_birth);
        const ma = da.getUTCMonth() * 100 + da.getUTCDate();
        const mb = db.getUTCMonth() * 100 + db.getUTCDate();
        return ma - mb;
      });

    const gender = { male: 0, female: 0, unspecified: 0 };
    for (const g of genderGroups) {
      if (g.gender === "male") gender.male = g._count.id;
      else if (g.gender === "female") gender.female = g._count.id;
      else gender.unspecified += g._count.id;
    }

    return {
      total,
      active,
      fired,
      gender,
      new_this_week: newThisWeek,
      fired_this_week: firedThisWeek,
      birthdays_this_week: birthdayList.length,
      birthday_list: birthdayList,
    };
  },

  // Профиль сотрудника для карточки на странице «Сотрудники»:
  // все истории в одном ответе, Decimal → number, added_by → ФИО.
  getProfile: async (id) => {
    const raw = await EmployeeModel.getProfile(id);

    if (!raw) return null;

    const num = (v) => (v === null || v === undefined ? 0 : Number(v));

    const fio = (u) => {
      if (!u) return "—";
      const e = u.employee;
      if (!e) return u.username || `#${u.id}`;
      return [e.last_name, e.first_name, e.middle_name]
        .filter(Boolean)
        .join(" ");
    };

    const { employee } = raw;

    const dateFields = ["date_of_birth", "passport_expiry_date"];
    for (const field of dateFields) {
      if (employee[field]) {
        employee[field] = new Date(employee[field]).toISOString().split("T")[0];
      }
    }

    const salaryHistory = raw.salaryHistory.map((s) => ({
      ...s,
      amount: num(s.amount),
      addedBy: fio(s.addedBy),
    }));

    const scheduleHistory = raw.scheduleHistory.map((s) => ({
      ...s,
      addedBy: fio(s.addedBy),
    }));

    const assetAssignments = raw.assetAssignments.map((a) => ({
      ...a,
      addedBy: fio(a.addedBy),
    }));

    const timeOff = raw.timeOff.map((t) => ({
      ...t,
      addedBy: fio(t.addedBy),
    }));

    const payrollItems = raw.payrollItems.map((p) => ({
      id: p.id,
      sheet_id: p.sheet_id,
      month: p.sheet?.month ?? null,
      year: p.sheet?.year ?? null,
      sheet_status: p.sheet?.status ?? null,
      salary_type: p.salary_type,
      base_salary: num(p.base_salary),
      worked_days: p.worked_days,
      total_work_days: p.total_work_days,
      worked_hours: p.worked_hours,
      total_work_hours: p.total_work_hours,
      accrued: num(p.accrued),
      debt_deduction: num(p.debt_deduction),
      manual_adjustment: num(p.manual_adjustment),
      late_minutes: p.late_minutes,
      overtime_minutes: p.overtime_minutes,
      late_amount: num(p.late_amount),
      overtime_amount: num(p.overtime_amount),
      net: num(p.net),
      salary_balance: num(p.salary_balance),
      paid_amount: num(p.paid_amount),
      status: p.status,
      payout_status: p.payout_status,
      paymentLogs: (p.paymentLogs || []).map((l) => ({
        id: l.id,
        amount: num(l.amount),
        payment_date: l.payment_date,
        note: l.note,
      })),
    }));

    // Сводка по финансам — чтобы фронт не считал то же самое повторно
    const totals = {
      accrued: payrollItems.reduce((s, p) => s + p.net, 0),
      paid: payrollItems.reduce((s, p) => s + p.paid_amount, 0),
      // salary_balance последнего закрытого месяца = текущий долг/переплата
      balance: payrollItems.length ? payrollItems[0].salary_balance : 0,
    };

    const assets = {
      assigned: assetAssignments.filter((a) => a.state === "assigned").length,
      returned: assetAssignments.filter((a) => a.state === "returned").length,
      scrapped: assetAssignments.filter((a) => a.state === "scrapped").length,
    };

    const currentSalary =
      salaryHistory.find((s) => !s.date_to) || salaryHistory[0] || null;

    return {
      employee,
      salaryHistory,
      scheduleHistory,
      employmentOrders: raw.employmentOrders,
      assetAssignments,
      payrollItems,
      timeOff,
      attendance: raw.attendance,
      summary: { totals, assets, currentSalary },
    };
  },

  getById: async (id) => {
    const employee = await EmployeeModel.getById(id);

    if (!employee) return null;

    // Преобразуем даты, если они есть
    const dateFields = ["date_of_birth", "passport_expiry_date", "order_date"];

    for (const field of dateFields) {
      if (employee[field]) {
        const date = new Date(employee[field]);
        employee[field] = date.toISOString().split("T")[0];
      }
    }

    // Преобразуем график работы
    if (employee.employeeScheduleHistory?.length) {
      employee.employeeScheduleHistory = employee.employeeScheduleHistory.map(
        (h) => {
          const emp = h.addedBy?.employee;

          const addedByFio = emp
            ? `${emp.last_name} ${emp.first_name}${
                emp.middle_name ? " " + emp.middle_name : ""
              } (${h.added_by})`
            : "—";

          return {
            id: h.id,
            employee_id: h.employee_id,
            work_schedule_id: h.work_schedule_id,
            date_from: h.date_from,
            date_to: h.date_to,
            added_at: h.added_at,
            workSchedule: h.workSchedule,
            addedBy: addedByFio,
          };
        },
      );
    }

    // Преобразуем doors в массив ID
    if (employee.doors?.length) {
      employee.door_ids = employee.doors.map((d) => d.id);
    } else {
      employee.door_ids = [];
    }

    return employee;
  },

  update: async (id, rawData, file, userId) => {
    if (!rawData || Object.keys(rawData).length === 0) {
      throw new Error("Нет данных для обновления");
    }

    const raw = { ...rawData };
    delete raw.id;

    // Сохраняем намерение очистить график ДО удаления пустых строк
    const wantsClearSchedule =
      raw.work_schedule_id !== undefined && raw.work_schedule_id === "";

    // Сохраняем намерение очистить фото ДО удаления пустых строк
    const wantsClearPhoto = raw.photo !== undefined && raw.photo === "";

    // Снимок исходных значений ДО удаления пустых строк —
    // нужен, чтобы отличить "поле не передано" от "поле явно очищено"
    const rawOriginal = { ...raw };

    // -------------------------------------------------
    // 1️⃣ НОРМАЛИЗАЦИЯ
    // -------------------------------------------------

    Object.keys(raw).forEach((key) => {
      if (Array.isArray(raw[key])) return;
      if (raw[key] === "") delete raw[key];
    });

    // -------------------------------------------------
    // 2️⃣ РАЗДЕЛЯЕМ ДАННЫЕ: ORDER / EMPLOYEE
    // -------------------------------------------------

    const orderFields = [
      "order_id",
      "order_number",
      "order_date",
      "branch_id",
      "department_id",
      "position_id",
    ];

    let orderId = null;
    const orderUpdateData = {};

    for (const field of orderFields) {
      if (raw[field] !== undefined) {
        if (field === "order_id") {
          orderId = Number(raw[field]);
        } else if (field === "order_date") {
          orderUpdateData.date = new Date(raw[field]);
        } else if (field === "order_number") {
          orderUpdateData.order_number = String(raw[field]);
        } else if (
          ["branch_id", "department_id", "position_id"].includes(field)
        ) {
          orderUpdateData[field] =
            raw[field] !== null ? Number(raw[field]) : null;
        }

        delete raw[field];
      }
    }

    // -------------------------------------------------
    // 3️⃣ ФОРМИРУЕМ DATA ДЛЯ EMPLOYEE
    // -------------------------------------------------

    const data = {};

    if (rawOriginal.employee_number !== undefined) {
      data.employee_number =
        rawOriginal.employee_number === ""
          ? null
          : String(rawOriginal.employee_number);
    }

    // Поля, которые можно явно очистить пустой строкой -> null
    const clearableScalarFields = [
      "middle_name",
      "passport",
      "pinfl",
      "phone",
      "email",
      "address",
      "education_specialty",
    ];

    // Обязательные/select-поля: пустая строка = "не менять"
    const scalarFields = [
      "first_name",
      "last_name",
      "gender",
      "education",
      "branch_id",
      "department_id",
      "position_id",
    ];

    for (const field of clearableScalarFields) {
      if (rawOriginal[field] !== undefined) {
        data[field] = rawOriginal[field] === "" ? null : rawOriginal[field];
      }
    }

    for (const field of scalarFields) {
      if (raw[field] !== undefined) {
        data[field] = raw[field];
      }
    }

    if (rawOriginal.date_of_birth !== undefined) {
      data.date_of_birth =
        rawOriginal.date_of_birth === ""
          ? null
          : new Date(rawOriginal.date_of_birth);
    }

    if (rawOriginal.passport_expiry_date !== undefined) {
      data.passport_expiry_date =
        rawOriginal.passport_expiry_date === ""
          ? null
          : new Date(rawOriginal.passport_expiry_date);
    }

    if (raw.status !== undefined) {
      data.status = ["true", "active", true, 1, "1"].includes(raw.status);
    }

    // -------------------------------------------------
    // 4️⃣ СВЯЗИ СОТРУДНИКА
    // -------------------------------------------------

    if (Array.isArray(raw.door_ids)) {
      const doorIds = raw.door_ids
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d > 0);

      data.doors = { set: doorIds.map((id) => ({ id })) };
    }

    // -------------------------------------------------
    // 5️⃣ ГРАФИК (отдельная ответственность)
    // -------------------------------------------------

    const currentSchedule = await EmployeeModel.getCurrentWorkSchedule(id);

    const newScheduleId =
      raw.work_schedule_id !== undefined ? Number(raw.work_schedule_id) : null;

    const oldScheduleId = currentSchedule?.work_schedule_id ?? null;

    const scheduleChanged =
      newScheduleId !== null && newScheduleId !== oldScheduleId;

    if (scheduleChanged) {
      await EmployeeModel.updateWorkSchedule(
        Number(id),
        newScheduleId,
        userId,
        raw.work_schedule_start_date,
      );

      data.workSchedule = {
        connect: { id: newScheduleId },
      };
    }

    // Явный сброс графика
    if (wantsClearSchedule && oldScheduleId !== null) {
      data.workSchedule = { disconnect: true };
    }

    // -------------------------------------------------
    // 6️⃣ ФОТО (после логики, перед update)
    // -------------------------------------------------

    if (file) {
      data.photo = file.filename;
    } else if (wantsClearPhoto) {
      data.photo = null;
    }

    // -------------------------------------------------
    // 7️⃣ ОБНОВЛЯЕМ СОТРУДНИКА
    // -------------------------------------------------

    const oldEmployee = await EmployeeModel.getById(id);

    const updatedEmployee = await EmployeeModel.update(id, data);

    // -------------------------------------------------
    // 8️⃣ ОБНОВЛЯЕМ ПРИКАЗ (если нужно)
    // -------------------------------------------------

    if (orderId && Object.keys(orderUpdateData).length > 0) {
      const currentOrder = await EmploymentOrdersModel.findById(orderId);
      const orderActuallyChanged =
        currentOrder &&
        Object.keys(orderUpdateData).some((k) => {
          const oldVal =
            currentOrder[k] instanceof Date
              ? currentOrder[k].toISOString().slice(0, 10)
              : currentOrder[k];
          const newVal =
            orderUpdateData[k] instanceof Date
              ? orderUpdateData[k].toISOString().slice(0, 10)
              : orderUpdateData[k];
          return String(oldVal ?? "") !== String(newVal ?? "");
        });
      if (orderActuallyChanged) {
        await EmploymentOrdersService.update(orderId, orderUpdateData, userId);
      }
    }

    // -------------------------------------------------
    // 9️⃣ СИНХРОНИЗАЦИЯ FACE-УСТРОЙСТВ
    // -------------------------------------------------

    const photoChanged = !!file;

    const oldDoorIds = oldEmployee.doors?.map((d) => Number(d.id)) || [];
    const newDoorIds = Array.isArray(raw.door_ids)
      ? raw.door_ids.map((d) => Number(d))
      : null;

    const removedDoorIds = newDoorIds
      ? oldDoorIds.filter((id) => !newDoorIds.includes(id))
      : [];

    const wantsDoorSync = ["true", "1", true, 1].includes(raw.sync_doors);

    if (wantsDoorSync) {
      Promise.resolve()
        .then(() => FaceDevicesService.syncEmployee(id, { removedDoorIds }))
        .catch((err) =>
          console.error("Ошибка синхронизации с FaceDevice:", err),
        );
    }

    const oldAuditData = pickEmployeeAuditFields(oldEmployee);
    const newAuditData = pickEmployeeAuditFields(updatedEmployee);
    const hasEmployeeChanges = Object.keys({
      ...oldAuditData,
      ...newAuditData,
    }).some(
      (k) =>
        JSON.stringify(oldAuditData?.[k] ?? null) !==
        JSON.stringify(newAuditData?.[k] ?? null),
    );
    if (hasEmployeeChanges) {
      await createAuditLog({
        userId,
        action: "update",
        entity: "employees",
        recordId: id,
        oldData: oldAuditData,
        newData: newAuditData,
      });
    }
    return updatedEmployee;
  },

  getDeleteImpact: async (id) => {
    const employee = await EmployeeModel.getById(id);
    if (!employee) throw new Error("Сотрудник не найден");

    return EmployeeModel.getDeleteImpact(id);
  },

  delete: async (id, userId) => {
    const old = await EmployeeModel.getById(id);
    if (!old) throw new Error("Сотрудник не найден");

    const impact = await EmployeeModel.getDeleteImpact(id);
    const { blockers } = impact;

    const blockedReasons = [];
    if (blockers.hasUser) blockedReasons.push("есть учётная запись пользователя");
    if (blockers.payrollItems > 0)
      blockedReasons.push(`есть начисления в ведомости (${blockers.payrollItems})`);
    if (blockers.tasksAssigned > 0)
      blockedReasons.push(`назначены задачи (${blockers.tasksAssigned})`);
    if (blockers.directedBranches > 0)
      blockedReasons.push(`является директором филиала (${blockers.directedBranches})`);

    if (blockedReasons.length > 0) {
      const err = new Error(
        `Невозможно удалить сотрудника: ${blockedReasons.join(", ")}`,
      );
      err.code = "EMPLOYEE_DELETE_BLOCKED";
      err.blockers = blockers;
      throw err;
    }

    const result = await EmployeeModel.delete(id);
    await createAuditLog({
      userId,
      action: "delete",
      entity: "employees",
      recordId: id,
      oldData: {
        ...pickEmployeeAuditFields(old),
        deletedRelated: {
          employmentOrders: impact.employmentOrders,
          facePasses: impact.facePasses,
          timeOff: impact.timeOff,
        },
      },
    });
    return result;
  },

  bulkUpdateWorkSchedule: async (employeeIds, workScheduleId, startDate, userId) => {
    const ids = [...new Set(employeeIds.map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    const newScheduleId = Number(workScheduleId);

    if (!ids.length) throw new Error("Не выбраны сотрудники");
    if (!Number.isInteger(newScheduleId) || newScheduleId <= 0)
      throw new Error("Не выбран график работы");

    const updatedIds = [];

    for (const id of ids) {
      const current = await EmployeeModel.getCurrentWorkSchedule(id);
      if (!current) continue;
      if (current.work_schedule_id === newScheduleId) continue;

      await EmployeeModel.updateWorkSchedule(id, newScheduleId, userId, startDate);
      await EmployeeModel.update(id, {
        workSchedule: { connect: { id: newScheduleId } },
      });

      await createAuditLog({
        userId,
        action: "update",
        entity: "employees",
        recordId: id,
        oldData: { work_schedule_id: current.work_schedule_id },
        newData: { work_schedule_id: newScheduleId },
      });

      updatedIds.push(id);
    }

    return { updated: updatedIds.length, employee_ids: updatedIds };
  },

  // Массовое назначение/снятие дверей. mode: add | remove | replace
  bulkUpdateDoors: async (employeeIds, doorIds, mode, syncDoors, userId) => {
    const ids = [...new Set((employeeIds || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    const targetDoorIds = [...new Set((doorIds || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    const action = ["add", "remove", "replace"].includes(mode) ? mode : "add";

    if (!ids.length) throw new Error("Не выбраны сотрудники");
    if (action !== "replace" && !targetDoorIds.length)
      throw new Error("Не выбраны двери");

    const employees = await EmployeeModel.getManyWithDoors(ids);
    const updatedIds = [];

    for (const employee of employees) {
      const oldDoorIds = employee.doors.map((d) => d.id);

      let newDoorIds;
      if (action === "add") {
        newDoorIds = [...new Set([...oldDoorIds, ...targetDoorIds])];
      } else if (action === "remove") {
        newDoorIds = oldDoorIds.filter((id) => !targetDoorIds.includes(id));
      } else {
        newDoorIds = [...targetDoorIds];
      }

      const unchanged =
        oldDoorIds.length === newDoorIds.length &&
        oldDoorIds.every((id) => newDoorIds.includes(id));
      if (unchanged) continue;

      await EmployeeModel.update(employee.id, {
        doors: { set: newDoorIds.map((id) => ({ id })) },
      });

      await createAuditLog({
        userId,
        action: "update",
        entity: "employees",
        recordId: employee.id,
        oldData: { door_ids: oldDoorIds },
        newData: { door_ids: newDoorIds },
      });

      if (syncDoors) {
        const removedDoorIds = oldDoorIds.filter(
          (id) => !newDoorIds.includes(id),
        );
        Promise.resolve()
          .then(() =>
            FaceDevicesService.syncEmployee(employee.id, { removedDoorIds }),
          )
          .catch((err) =>
            console.error("Ошибка синхронизации с FaceDevice:", err),
          );
      }

      updatedIds.push(employee.id);
    }

    return { updated: updatedIds.length, employee_ids: updatedIds };
  },

  // Массовая синхронизация с face-устройствами без изменения дверей.
  // Идёт в фоне и последовательно: syncEmployee делает ретраи с паузами по 10 с,
  // параллельный запуск на всём списке положит терминалы и оборвёт HTTP-запрос.
  bulkSyncFaceDevices: async (employeeIds) => {
    const ids = [...new Set((employeeIds || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    if (!ids.length) throw new Error("Не выбраны сотрудники");

    const employees = await EmployeeModel.getManyWithDoors(ids);
    const existingIds = employees.map((e) => e.id);
    const notFound = ids.filter((id) => !existingIds.includes(id));

    Promise.resolve().then(async () => {
      for (const id of existingIds) {
        try {
          await FaceDevicesService.syncEmployee(id);
        } catch (err) {
          console.error(
            `Ошибка синхронизации сотрудника ${id} с FaceDevice:`,
            err.message,
          );
        }
      }
      console.log(
        `Массовая синхронизация с FaceDevice завершена: ${existingIds.length} сотрудников`,
      );
    });

    return { queued: existingIds.length, not_found: notFound };
  },

  // Прямое исправление филиала/отдела/должности БЕЗ приказа — для кривых данных
  // (импорт, ручные ошибки). Последний приказ правим вместе с карточкой:
  // любое создание/изменение/удаление приказа пересчитывает эти поля сотрудника
  // из последнего приказа, и правка только в employees откатилась бы.
  bulkUpdatePlacement: async (employeeIds, fields, userId) => {
    const ids = [...new Set((employeeIds || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    if (!ids.length) throw new Error("Не выбраны сотрудники");

    const toId = (v) => {
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : null;
    };

    const branchId = toId(fields.branch_id);
    const departmentId = toId(fields.department_id);
    const positionId = toId(fields.position_id);

    if (!branchId && !departmentId && !positionId)
      throw new Error("Не выбрано, что менять");

    // отдел обязан принадлежать выбранному филиалу, иначе получим
    // сотрудника в филиале A с отделом филиала B
    if (departmentId) {
      const department = await DepartmentsModel.findUnique(departmentId);
      if (!department) throw new Error("Отдел не найден");
      if (branchId && department.branch_id !== branchId)
        throw new Error("Отдел не принадлежит выбранному филиалу");
    }

    const employees = await EmployeeModel.getManyWithDoors(ids);
    const updatedIds = [];

    for (const employee of employees) {
      const data = removeUndefined({
        branch_id: branchId ?? undefined,
        department_id: departmentId ?? undefined,
        position_id: positionId ?? undefined,
      });

      const unchanged = Object.entries(data).every(
        ([key, value]) => employee[key] === value,
      );
      if (unchanged) continue;

      await EmployeeModel.update(employee.id, data);

      const latestOrder = await EmploymentOrdersModel.findLatestByEmployee(
        employee.id,
      );
      if (latestOrder) {
        await EmploymentOrdersModel.update(latestOrder.id, data);
      }

      await createAuditLog({
        userId,
        action: "update",
        entity: "employees",
        recordId: employee.id,
        oldData: {
          branch_id: employee.branch_id,
          department_id: employee.department_id,
          position_id: employee.position_id,
        },
        newData: data,
      });

      updatedIds.push(employee.id);
    }

    return { updated: updatedIds.length, employee_ids: updatedIds };
  },

  // Предпросмотр массового удаления: что удалится и кого удалить нельзя
  getBulkDeleteImpact: async (employeeIds) => {
    const ids = [...new Set((employeeIds || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    if (!ids.length) throw new Error("Не выбраны сотрудники");

    const [employees, impacts] = await Promise.all([
      EmployeeModel.getManyWithDoors(ids),
      EmployeeModel.getBulkDeleteImpact(ids),
    ]);

    const totals = { employmentOrders: 0, facePasses: 0, timeOff: 0 };
    const deletable = [];
    const blocked = [];

    for (const employee of employees) {
      const impact = impacts[employee.id];
      const { blockers } = impact;
      const isBlocked =
        blockers.hasUser ||
        blockers.payrollItems > 0 ||
        blockers.tasksAssigned > 0 ||
        blockers.directedBranches > 0;

      const row = { id: employee.id, name: buildFullName(employee), blockers };

      if (isBlocked) {
        blocked.push(row);
        continue;
      }

      totals.employmentOrders += impact.employmentOrders;
      totals.facePasses += impact.facePasses;
      totals.timeOff += impact.timeOff;
      deletable.push(row);
    }

    return { totals, deletable, blocked };
  },

  bulkDelete: async (employeeIds, userId) => {
    const { deletable, blocked } =
      await EmployeeService.getBulkDeleteImpact(employeeIds);

    const deletedIds = [];
    const failed = [];

    for (const row of deletable) {
      try {
        await EmployeeService.delete(row.id, userId);
        deletedIds.push(row.id);
      } catch (err) {
        console.error(`Ошибка при удалении сотрудника ${row.id}:`, err);
        failed.push({ id: row.id, name: row.name, error: err.message });
      }
    }

    return {
      deleted: deletedIds.length,
      employee_ids: deletedIds,
      blocked,
      failed,
    };
  },

  importFromExcel: async (buffer, userId) => {
    // Normalize XML entries: handle UTF-16 LE/BE, strip illegal chars, fix BOM
    const zip = await JSZip.loadAsync(buffer);
    const illegalXmlRE = new RegExp(
      "[\x00-\x08\x0B\x0C\x0E-\x1F" +
        String.fromCodePoint(0xd800) +
        "-" +
        String.fromCodePoint(0xdfff) +
        String.fromCodePoint(0xfffe) +
        String.fromCodePoint(0xffff) +
        "]",
      "g",
    );
    let zipDirty = false;
    for (const [name, file] of Object.entries(zip.files)) {
      if (file.dir || (!name.endsWith(".xml") && !name.endsWith(".rels")))
        continue;
      const raw = await file.async("nodebuffer");
      let xml;
      let needsUpdate = false;
      if (raw[0] === 0xff && raw[1] === 0xfe) {
        xml = raw.slice(2).toString("utf16le");
        xml = xml.replace(/encoding="UTF-16[^"]*"/i, 'encoding="UTF-8"');
        needsUpdate = true; // always re-store: original is UTF-16 binary
      } else if (raw[0] === 0xfe && raw[1] === 0xff) {
        const swapped = Buffer.from(raw.slice(2));
        for (let i = 0; i + 1 < swapped.length; i += 2) {
          const t = swapped[i];
          swapped[i] = swapped[i + 1];
          swapped[i + 1] = t;
        }
        xml = swapped.toString("utf16le");
        xml = xml.replace(/encoding="UTF-16[^"]*"/i, 'encoding="UTF-8"');
        needsUpdate = true;
      } else {
        xml = raw.toString("utf8");
        if (xml.charCodeAt(0) === 0xfeff) {
          xml = xml.slice(1);
          needsUpdate = true;
        }
      }
      let patched = xml.replace(illegalXmlRE, "");
      const firstAngle = patched.indexOf("<");
      if (firstAngle > 0) patched = patched.slice(firstAngle);
      if (patched !== xml) needsUpdate = true;
      if (needsUpdate) {
        zip.file(name, patched);
        zipDirty = true;
      }
    }
    const cleanBuf = zipDirty
      ? await zip.generateAsync({ type: "nodebuffer" })
      : buffer;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(cleanBuf);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new Error("Рабочий лист не найден");

    const normCell = (v) => {
      if (v === null || v === undefined) return null;
      if (v instanceof Date) return v;
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      )
        return v;
      if (v && Array.isArray(v.richText))
        return v.richText.map((r) => r.text || "").join("");
      if (v && (v.formula !== undefined || v.sharedFormula !== undefined))
        return normCell(v.result);
      if (v && v.text !== undefined) return String(v.text);
      return v;
    };

    const rows = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const arr = [];
      for (let c = 1; c <= row.cellCount; c++)
        arr.push(normCell(row.getCell(c).value));
      rows.push(arr);
    });

    const prisma = prismaContext.get();

    const getCellValue = (row, colIdx) => {
      const v = row[colIdx];
      if (v === null || v === undefined) return null;
      if (v instanceof Date) return v;
      if (typeof v === "string") return v.trim();
      return v;
    };

    const parseDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      if (typeof val === "string") {
        const m = val.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      if (typeof val === "number") {
        const epoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(epoch.getTime() + val * 86400000);
      }
      return null;
    };

    const toStr = (v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    };

    const allBranches = await prisma.branches.findMany({
      select: { id: true, name: true },
    });
    const allDepartments = await prisma.departments.findMany({
      select: { id: true, name: true, branch_id: true },
    });
    const allPositions = await prisma.positions.findMany({
      select: { id: true, name: true },
    });
    const allWorkSchedules = await prisma.work_schedules.findMany({
      select: { id: true, name: true },
    });

    const branchMap = new Map(
      allBranches.map((b) => [b.name.trim().toLowerCase(), b]),
    );
    const posMap = new Map(
      allPositions.map((p) => [p.name.trim().toLowerCase(), p]),
    );
    const wsMap = new Map(
      allWorkSchedules.map((w) => [w.name.trim().toLowerCase(), w]),
    );

    const header = rows[0] || [];
    const headerStr = header.map((h) =>
      String(h || "")
        .trim()
        .toLowerCase(),
    );
    if (!headerStr[0] || !headerStr[0].startsWith("id")) {
      throw new Error(
        `Неверный формат файла: первая колонка должна называться "ID", получено "${header[0] ?? ""}"`,
      );
    }
    const isTemplateFormat = headerStr.length >= 17;
    const col = isTemplateFormat
      ? { branchName: 12, deptName: 13, posName: 14, status: 15, wsName: 16 }
      : { branchName: 12, deptName: 13, posName: 14, wsName: null, status: 15 };

    let updated = 0;
    let created = 0;
    let unchanged = 0;
    let ordersCreated = 0;
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;
      const idVal = getCellValue(row, 0);
      if (idVal === null || idVal === "") continue;

      const employeeId = Number(idVal);
      if (!Number.isInteger(employeeId) || employeeId <= 0) continue;

      const rowNum = i + 1;

      let updateData = {};
      try {
        const current = await prisma.employees.findUnique({
          where: { id: employeeId },
          select: {
            id: true,
            branch_id: true,
            department_id: true,
            position_id: true,
            employee_number: true,
            last_name: true,
            first_name: true,
            middle_name: true,
            date_of_birth: true,
            gender: true,
            pinfl: true,
            passport: true,
            passport_expiry_date: true,
            phone: true,
            email: true,
            address: true,
            work_schedule_id: true,
            status: true,
          },
        });

        console.log("current", current);

        const rawBranchName = toStr(getCellValue(row, col.branchName));
        const rawDeptName = toStr(getCellValue(row, col.deptName));
        const rawPosName = toStr(getCellValue(row, col.posName));

        const newBranchId = rawBranchName
          ? (branchMap.get(rawBranchName.toLowerCase())?.id ?? null)
          : null;

        let newDeptId = null;
        if (rawDeptName) {
          const deptKey = rawDeptName.toLowerCase();
          if (newBranchId) {
            const dept = allDepartments.find(
              (d) =>
                d.name.trim().toLowerCase() === deptKey &&
                d.branch_id === newBranchId,
            );
            newDeptId = dept?.id ?? null;
          } else {
            const dept = allDepartments.find(
              (d) => d.name.trim().toLowerCase() === deptKey,
            );
            newDeptId = dept?.id ?? null;
          }
        }

        const newPosId = rawPosName
          ? (posMap.get(rawPosName.toLowerCase())?.id ?? null)
          : null;

        const employeeNumber = toStr(getCellValue(row, 1));
        const lastName = toStr(getCellValue(row, 2));
        const firstName = toStr(getCellValue(row, 3));
        const middleName = getCellValue(row, 4);
        const dobRaw = getCellValue(row, 5);
        const gender = toStr(getCellValue(row, 6));
        const pinfl = toStr(getCellValue(row, 7));
        const passport = toStr(getCellValue(row, 8));
        const passportExpiryRaw = getCellValue(row, 9);
        const phone = toStr(getCellValue(row, 10));
        const address = getCellValue(row, 11);
        const statusRaw = toStr(getCellValue(row, col.status));
        const rawWsName =
          col.wsName !== null ? toStr(getCellValue(row, col.wsName)) : null;
        const newWsId = rawWsName
          ? (wsMap.get(rawWsName.toLowerCase())?.id ?? null)
          : null;
        const dob = parseDate(dobRaw);
        const passportExpiry = parseDate(passportExpiryRaw);

        if (!current) {
          if (statusRaw !== "true") {
            errors.push({
              row: rowNum,
              code: "EMPLOYEE_NOT_FOUND",
              id: employeeId,
            });
            continue;
          }

          updateData = {
            employee_number: employeeNumber,
            pinfl,
            passport,
            phone,
          };

          await prisma.employees.create({
            data: {
              id: employeeId,
              employee_number: employeeNumber,
              last_name: lastName,
              first_name: firstName,
              middle_name:
                middleName !== null ? String(middleName).trim() || null : null,
              date_of_birth: dob,
              gender,
              pinfl,
              passport,
              passport_expiry_date: passportExpiry,
              phone,
              address: address !== null ? String(address).trim() || null : null,
              status: true,
              work_schedule_id: newWsId,
              branch_id: newBranchId,
              department_id: newDeptId,
              position_id: newPosId,
            },
          });

          if (newBranchId || newDeptId || newPosId) {
            const today = new Date().toISOString().slice(0, 10);
            await EmploymentOrdersService.create(
              {
                employeeId,
                type: "hire",
                order_number: `IMPORT-${today}-${employeeId}`,
                order_date: new Date(),
                branch_id: newBranchId,
                department_id: newDeptId,
                position_id: newPosId,
              },
              userId,
            );
            ordersCreated++;
          }

          if (newWsId) {
            await EmployeeWorkScheduleHistoryModel.create({
              employee: { connect: { id: employeeId } },
              workSchedule: { connect: { id: newWsId } },
              date_from: new Date(),
              date_to: null,
              addedBy: { connect: { id: Number(userId) } },
            });
          }

          created++;
          continue;
        }

        const branchChanged = newBranchId && newBranchId !== current.branch_id;
        const deptChanged = newDeptId && newDeptId !== current.department_id;
        const posChanged = newPosId && newPosId !== current.position_id;
        const wsChanged = newWsId && newWsId !== current.work_schedule_id;

        if (wsChanged) {
          const importDate = new Date().toISOString().slice(0, 10);
          await EmployeeModel.updateWorkSchedule(
            employeeId,
            newWsId,
            userId,
            importDate,
          );
        }

        if (branchChanged || deptChanged || posChanged) {
          const today = new Date().toISOString().slice(0, 10);

          await EmploymentOrdersService.create(
            {
              employeeId,
              type: "transfer",
              order_number: `IMPORT-${today}-${employeeId}`,
              order_date: new Date(),
              branch_id: newBranchId ?? current.branch_id,
              department_id: newDeptId ?? current.department_id,
              position_id: newPosId ?? current.position_id,
            },
            userId,
          );

          ordersCreated++;
        }

        updateData = {};
        if (employeeNumber !== null)
          updateData.employee_number = employeeNumber;
        if (lastName !== null) updateData.last_name = lastName;
        if (firstName !== null) updateData.first_name = firstName;
        if (middleName !== null)
          updateData.middle_name = String(middleName).trim() || null;
        if (dob) updateData.date_of_birth = dob;
        if (gender !== null) updateData.gender = gender;
        if (pinfl !== null) updateData.pinfl = pinfl;
        if (passport !== null) updateData.passport = passport;
        if (passportExpiry) updateData.passport_expiry_date = passportExpiry;
        if (phone !== null) updateData.phone = phone;
        if (address !== null)
          updateData.address = String(address).trim() || null;
        if (statusRaw === "true") updateData.status = true;
        else if (statusRaw === "false") updateData.status = false;
        if (newWsId) updateData.work_schedule_id = newWsId;

        const hasOrderChange = branchChanged || deptChanged || posChanged;

        const diffData = {};
        for (const [key, val] of Object.entries(updateData)) {
          const cur = current[key];
          if (cur instanceof Date || val instanceof Date) {
            const curTime = cur instanceof Date ? cur.getTime() : null;
            const valTime = val instanceof Date ? val.getTime() : null;
            if (curTime !== valTime) diffData[key] = val;
          } else if (cur !== val) {
            diffData[key] = val;
          }
        }

        if (Object.keys(diffData).length > 0) {
          await prisma.employees.update({
            where: { id: employeeId },
            data: diffData,
          });
          updated++;
        } else if (hasOrderChange) {
          updated++;
        } else {
          unchanged++;
        }
      } catch (err) {
        if (err.code === "P2002") {
          const fieldLabels = { employee_number: "Таб. номер", pinfl: "ПИНФЛ" };
          const target = Array.isArray(err.meta?.target) ? err.meta.target : [];
          const matched = target.filter((f) => fieldLabels[f]);
          const fields = matched.length
            ? matched
            : Object.keys(fieldLabels).filter((f) => updateData[f] != null);
          const conflicting =
            fields.map((f) => fieldLabels[f]).join(", ") || "уникальное поле";
          errors.push({
            row: rowNum,
            code: "DUPLICATE",
            error: `Дублирующееся значение в: ${conflicting}`,
          });
        } else {
          errors.push({ row: rowNum, code: "UNKNOWN" });
        }
      }
    }

    return { updated, created, unchanged, ordersCreated, errors };
  },
};
