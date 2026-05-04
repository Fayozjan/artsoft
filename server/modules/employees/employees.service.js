import { prismaContext } from "../../utils/prismaContext.js";

import { EmployeeModel } from "./employees.model.js";
import { UserModel } from "../users/users.model.js";
import { FaceDevicesService } from "../faceDevices/faceDevices.service.js";
import { buildEmployeeAccess, removeUndefined } from "./employee.helpers.js";
import { EmploymentOrdersModel } from "../employmentOrders/employmentOrders.model.js";
import { EmployeeWorkScheduleHistoryModel } from "../employeeScheduleHistory/employeeScheduleHistory.model.js";
import { EmploymentOrdersService } from "../employmentOrders/employmentOrders.service.js";

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

    if (rawData.door_ids) {
      Promise.resolve()
        .then(() => FaceDevicesService.syncEmployee(newEmployee.id))
        .catch((err) =>
          console.error("Ошибка синхронизации с FaceDevice:", err),
        );
    }

    return newEmployee;
  },

  getAll: async ({ userId, page, pageSize, filters = {} }) => {
    const {
      branch_id,
      department_id,
      employee_id,
      employee_ids,
      not_employee_ids,
      position_id,
      search,
      gender,
      status,
      sort_by,
      sort_order,
    } = filters;

    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const where = { AND: [] };

    // --- фильтры ---
    if (branch_id) where.branch_id = Number(branch_id);
    if (department_id) where.department_id = Number(department_id);
    if (employee_id) where.id = Number(employee_id);
    if (employee_ids?.length) where.id = { in: employee_ids.map(Number) };
    if (not_employee_ids?.length)
      where.id = { notIn: not_employee_ids.map(Number) };
    if (position_id) where.position_id = Number(position_id);
    if (gender) where.gender = gender;

    if (status !== undefined && status !== null && status !== "") {
      if (typeof status === "string") {
        where.status = status === "true";
      } else {
        where.status = Boolean(status);
      }
    }

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

      // 3. Строковые фильтры (ПИНФЛ и Паспорт — всегда строки)
      const stringFilters = [
        { pinfl: { contains: s } },
        { passport: { contains: s, mode: "insensitive" } },
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

    const currentPage = Math.max(parseInt(page) || 1, 1);
    const size = Math.max(parseInt(pageSize) || 50, 1);
    const skip = (currentPage - 1) * size;

    const { data, total } = await EmployeeModel.getAll(
      where,
      skip,
      size,
      sort_by,
      sort_order,
    );

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

    // Week month/day pairs
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
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

    if (raw.employee_number !== undefined) {
      data.employee_number = String(raw.employee_number);
    }

    const scalarFields = [
      "first_name",
      "last_name",
      "middle_name",
      "gender",
      "passport",
      "passport_expiry_date",
      "pinfl",
      "education",
      "phone",
      "email",
      "address",
      "education_specialty",
      "branch_id",
      "department_id",
      "position_id",
    ];

    for (const field of scalarFields) {
      if (raw[field] !== undefined) {
        data[field] = raw[field];
      }
    }

    if (raw.date_of_birth) {
      data.date_of_birth = new Date(raw.date_of_birth);
    }

    if (raw.passport_expiry_date) {
      data.passport_expiry_date = new Date(raw.passport_expiry_date);
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
      data.photo = file?.filename;
    }

    // -------------------------------------------------
    // 7️⃣ ОБНОВЛЯЕМ СОТРУДНИКА
    // -------------------------------------------------

    const oldEmployee = await EmployeeModel.getById(id);

    const updatedEmployee = await EmployeeModel.update(id, data);

    // -------------------------------------------------
    // 8️⃣ ОБНОВЛЯЕМ ПРИКАЗ (если нужно)
    // -------------------------------------------------

    if (orderId) {
      await EmploymentOrdersService.update(orderId, orderUpdateData);
    }

    // -------------------------------------------------
    // 9️⃣ СИНХРОНИЗАЦИЯ FACE-УСТРОЙСТВ
    // -------------------------------------------------

    const photoChanged = !!file;

    const oldDoorIds = oldEmployee.doors?.map((d) => Number(d.id)) || [];
    const newDoorIds = Array.isArray(raw.door_ids)
      ? raw.door_ids.map((d) => Number(d))
      : null;

    const doorsChanged =
      newDoorIds &&
      (newDoorIds.length !== oldDoorIds.length ||
        !newDoorIds.every((id) => oldDoorIds.includes(id)));

    if (photoChanged || doorsChanged) {
      Promise.resolve()
        .then(() => FaceDevicesService.syncEmployee(id))
        .catch((err) =>
          console.error("Ошибка синхронизации с FaceDevice:", err),
        );
    }

    return updatedEmployee;
  },
};
