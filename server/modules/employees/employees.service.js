import path from "path";
import fs from "fs";

import prisma from "../../prisma/client.js";

import { EmployeeModel } from "./employees.model.js";
import { UserModel } from "../users/users.model.js";
import { buildAccessWhere } from "../../utils/accessFilter.js";
import { FaceDeviceService } from "../faceDevices/faceDevice.service.js";
import { removeUndefined } from "./employee.helpers.js";
import { EmploymentOrdersModel } from "../employmentOrders/employmentOrders.model.js";
import { EmployeeWorkScheduleHistoryModel } from "../employeeScheduleHistory/employeeScheduleHistory.model.js";
import { EmploymentOrdersService } from "../employmentOrders/employmentOrders.service.js";

export const EmployeeService = {
  create: async (userId, rawData, file) => {
    const user = await UserModel.getUserById(Number(userId));

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

    // Если передан файл сохраняем
    let photoPath;

    if (file) {
      const ext = path.extname(file.originalname);
      const newFileName = `${rawData.pinfl}${ext}`;
      const newPath = path.join(file.destination, newFileName);

      await fs.promises.rename(file.path, newPath);

      photoPath = `/api/uploads/employees/${newFileName}`;
    }

    const employeeData = removeUndefined({
      employee_number: rawData.employee_number
        ? Number(rawData.employee_number)
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

    // Добавляем двери, если есть
    if (Array.isArray(rawData.door_ids)) {
      const doorIds = rawData.door_ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (doorIds.length) {
        employeeData.doors = {
          connect: doorIds.map((id) => ({ id })),
        };
      }
    }

    return prisma.$transaction(async (tx) => {
      const newEmployee = await EmployeeModel.create(employeeData, tx);

      // Создание приказа
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

          employee: { connect: { id: newEmployee.id } },
        });

        await EmploymentOrdersModel.create(orderData, tx);
      }

      // Создание истории графика
      if (rawData.work_schedule_id) {
        await EmployeeWorkScheduleHistoryModel.create(
          {
            employee: { connect: { id: newEmployee.id } },
            workSchedule: {
              connect: { id: Number(rawData.work_schedule_id) },
            },
            date_from: rawData.order_date
              ? new Date(rawData.order_date)
              : new Date(),
            date_to: null,
            addedBy: { connect: { id: Number(userId) } },
          },
          tx,
        );
      }
      return newEmployee;
    });
  },

  getAll: async ({ userId, page, pageSize, filters = {} }) => {
    const {
      branch_id,
      department_id,
      employee_id,
      position_id,
      search,
      status,
    } = filters;

    const user = await UserModel.getUserById(Number(userId));

    if (!user) throw new Error("Пользователь не найден");

    const { access_level, branches, departments } = user;
    const where = { AND: [] };

    // --- фильтры ---
    if (branch_id) where.branch_id = Number(branch_id);
    if (department_id) where.department_id = Number(department_id);
    if (employee_id) where.id = Number(employee_id);
    if (position_id) where.position_id = Number(position_id);
    if (status) where.status = status;

    if (status !== undefined && status !== null && status !== "") {
      // если пришло "true"/"false" — приводим к boolean
      if (typeof status === "string") {
        where.status = status === "true";
      } else {
        where.status = Boolean(status);
      }
    }

    if (search && search.trim() !== "") {
      const s = search.trim();

      let exactNumericFilters = [];

      // --- безопасный разбор числа ---
      const numericValue = Number(s);
      const isSafeInteger =
        Number.isInteger(numericValue) &&
        numericValue >= -2147483648 &&
        numericValue <= 2147483647;

      if (isSafeInteger) {
        exactNumericFilters = [
          { id: numericValue },
          { employee_number: numericValue },
        ];
      }

      // --- точный поиск по паспортам и ПИНФЛ ---
      const exactStringFilters = [{ passport: s }, { pinfl: s }];

      // --- разбор ФИО по словам ---
      const parts = s
        .split(" ")
        .map((p) => p.trim())
        .filter(Boolean);

      const fioSearch = {
        AND: parts.map((part) => ({
          OR: [
            { first_name: { contains: part, mode: "insensitive" } },
            { last_name: { contains: part, mode: "insensitive" } },
            { middle_name: { contains: part, mode: "insensitive" } },
          ],
        })),
      };

      // Добавляем в WHERE
      where.AND = [
        {
          OR: [...exactNumericFilters, ...exactStringFilters, fioSearch],
        },
      ];
    }

    // --- права доступа ---
    if (access_level === "branch" && branches?.length) {
      where.AND.push({ branch_id: { in: branches } });
    } else if (access_level === "department" && departments?.length) {
      where.AND.push({ department_id: { in: departments } });
    } else if (access_level !== "absolute") {
      where.AND.push({ id: -1 });
    }

    const currentPage = Math.max(parseInt(page) || 1, 1);
    const size = Math.max(parseInt(pageSize) || 50, 1);
    const skip = (currentPage - 1) * size;

    const { data, total } = await EmployeeModel.getAll(where, skip, size);

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

  getActive: async ({ userId, filters = {} }) => {
    const { branch_id, department_id } = filters;

    const user = await UserModel.getUserById(userId);

    if (!user) {
      throw new Error("Пользователь не найден");
    }

    const accessWhere = buildAccessWhere(user);

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
      photo: emp.photo || null,
      branchName: emp.branch?.name || null,
      departmentName: emp.department?.name || null,
      positionName: emp.position?.name || null,
    }));

    return {
      data: formatted,
    };
  },

  // update: async (id, rawData, file, userId) => {
  //   if (!rawData || Object.keys(rawData).length === 0) {
  //     throw new Error("Нет данных для обновления");
  //   }

  //   const raw = { ...rawData };
  //   delete raw.id;

  //   Object.keys(raw).forEach((k) => {
  //     if (Array.isArray(raw[k])) return;
  //     if (raw[k] === "") delete raw[k];
  //   });

  //   const orderFields = [
  //     "order_id",
  //     "order_number",
  //     "order_date",
  //     "branch_id",
  //     "department_id",
  //     "position_id",
  //   ];

  //   const orderDataToUpdate = {};
  //   let orderId = null;

  //   orderFields.forEach((field) => {
  //     if (raw[field] !== undefined) {
  //       if (field === "order_id") {
  //         orderId = Number(raw[field]);
  //       } else if (field === "order_date") {
  //         orderDataToUpdate.date = new Date(raw[field]);
  //       } else {
  //         orderDataToUpdate[field] = raw[field];
  //       }

  //       delete raw[field];
  //     }
  //   });

  //   const data = {};

  //   if (raw.employee_number !== undefined)
  //     data.employee_number = Number(raw.employee_number);

  //   const scalarFields = [
  //     "first_name",
  //     "last_name",
  //     "middle_name",
  //     "gender",
  //     "passport",
  //     "pinfl",
  //     "education",
  //     "phone",
  //     "email",
  //     "address",
  //     "education_specialty",
  //     "photo",
  //   ];

  //   const yesterday = new Date();
  //   yesterday.setDate(yesterday.getDate() - 1);

  //   // 2️⃣ Получаем текущий график
  //   const currentWorkSchedule = await EmployeeModel.getCurrentWorkSchedule(id);

  //   const newScheduleId =
  //     raw.work_schedule_id !== undefined ? Number(raw.work_schedule_id) : null;

  //   const oldScheduleId = currentWorkSchedule?.work_schedule_id ?? null;

  //   const scheduleChanged =
  //     newScheduleId !== null && newScheduleId !== oldScheduleId;

  //   // 3.1 История графиков
  //   if (scheduleChanged) {
  //     await EmployeeModel.updateWorkSchedule(
  //       Number(id),
  //       newScheduleId,
  //       userId,
  //       raw.work_schedule_start_date,
  //     );
  //   }

  //   // 3.2 Работа с фото
  //   if (file) {
  //     const ext = path.extname(file.originalname);
  //     const newFileName = `${id}${ext}`;
  //     const newPath = path.join(file.destination, newFileName);

  //     await fs.promises.rename(file.path, newPath);
  //     raw.photo = `/api/uploads/employees/${newFileName}`;
  //   }

  //   // 3.3 Удаляем пустые строки

  //   scalarFields.forEach((f) => {
  //     if (raw[f] !== undefined) data[f] = raw[f];
  //   });

  //   if (raw.date_of_birth) data.date_of_birth = new Date(raw.date_of_birth);

  //   if (raw.document_validity_period)
  //     data.document_validity_period = new Date(raw.document_validity_period);

  //   if (raw.status !== undefined) {
  //     if (["true", "active", true, 1, "1"].includes(raw.status))
  //       data.status = true;
  //     else if (["false", "inactive", false, 0, "0"].includes(raw.status))
  //       data.status = false;
  //   }

  //   // Связи
  //   if (raw.branch_id !== undefined) {
  //     data.branch =
  //       raw.branch_id === null
  //         ? { disconnect: true }
  //         : { connect: { id: Number(raw.branch_id) } };
  //   }

  //   if (raw.department_id !== undefined) {
  //     data.department =
  //       raw.department_id === null
  //         ? { disconnect: true }
  //         : { connect: { id: Number(raw.department_id) } };
  //   }

  //   if (raw.position_id !== undefined) {
  //     data.position =
  //       raw.position_id === null
  //         ? { disconnect: true }
  //         : { connect: { id: Number(raw.position_id) } };
  //   }

  //   if (Array.isArray(raw.door_ids)) {
  //     const doorIds = raw.door_ids
  //       .map((id) => Number(id))
  //       .filter((id) => Number.isInteger(id) && id > 0);

  //     data.doors = { set: doorIds.map((id) => ({ id })) };
  //   }

  //   if (scheduleChanged)
  //     data.workSchedule = {
  //       connect: { id: newScheduleId },
  //     };

  //   const oldData = await EmployeeModel.getById(id);

  //   // 3.4 Обновляем сотрудника

  //   const updatedEmployee = await EmployeeModel.update(id, data);

  //   if (orderId && Object.keys(orderDataToUpdate).length > 0) {
  //     await EmploymentOrdersService.update(orderId, orderDataToUpdate);
  //   }

  //   const photoChanged = file !== undefined;
  //   const oldDoorIds = oldData.doors?.map((d) => Number(d.id)) || [];
  //   const newDoorIds = Array.isArray(raw.door_ids)
  //     ? raw.door_ids.map((id) => Number(id))
  //     : null;

  //   const doorsChanged =
  //     newDoorIds !== null &&
  //     (newDoorIds.length !== oldDoorIds.length ||
  //       !newDoorIds.every((id) => oldDoorIds.includes(id)));

  //   if (photoChanged || doorsChanged) {
  //     FaceDeviceService.syncEmployee(id);
  //   }

  //   return updatedEmployee;
  // },

  update: async (id, rawData, file, userId) => {
    if (!rawData || Object.keys(rawData).length === 0) {
      throw new Error("Нет данных для обновления");
    }

    const raw = { ...rawData };
    delete raw.id;

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
      data.employee_number = Number(raw.employee_number);
    }

    const scalarFields = [
      "first_name",
      "last_name",
      "middle_name",
      "gender",
      "passport",
      "pinfl",
      "education",
      "phone",
      "email",
      "address",
      "education_specialty",
    ];

    for (const field of scalarFields) {
      if (raw[field] !== undefined) {
        data[field] = raw[field];
      }
    }

    if (raw.date_of_birth) {
      data.date_of_birth = new Date(raw.date_of_birth);
    }

    if (raw.document_validity_period) {
      data.document_validity_period = new Date(raw.document_validity_period);
    }

    if (raw.status !== undefined) {
      data.status = ["true", "active", true, 1, "1"].includes(raw.status);
    }

    // -------------------------------------------------
    // 4️⃣ СВЯЗИ СОТРУДНИКА
    // -------------------------------------------------

    if (raw.branch_id !== undefined) {
      data.branch =
        raw.branch_id === null
          ? { disconnect: true }
          : { connect: { id: Number(raw.branch_id) } };
    }

    if (raw.department_id !== undefined) {
      data.department =
        raw.department_id === null
          ? { disconnect: true }
          : { connect: { id: Number(raw.department_id) } };
    }

    if (raw.position_id !== undefined) {
      data.position =
        raw.position_id === null
          ? { disconnect: true }
          : { connect: { id: Number(raw.position_id) } };
    }

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

    // -------------------------------------------------
    // 6️⃣ ФОТО (после логики, перед update)
    // -------------------------------------------------

    if (file) {
      const ext = path.extname(file.originalname);
      const newFileName = `${id}${ext}`;
      const newPath = path.join(file.destination, newFileName);

      await fs.promises.rename(file.path, newPath);

      data.photo = `/api/uploads/employees/${newFileName}`;
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
      await FaceDeviceService.syncEmployee(id);
    }

    return updatedEmployee;
  },
};
