import path from "path";
import fs from "fs";
import {
  createEmployee,
  getEmployees,
  getActiveEmployeesModel,
  EmployeeModel,
} from "./employees.model.js";

import { UserModel } from "../users/users.model.js";
import { buildAccessWhere } from "../../utils/accessFilter.js";
import { FaceDeviceService } from "../faceDevices/faceDevice.service.js";

export const getEmployeesService = async ({
  userId,
  page,
  pageSize,
  filters = {},
}) => {
  const { branch_id, department_id, employee_id, position_id, search, status } =
    filters;

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

  const { data, total } = await getEmployees(where, skip, size);

  return {
    data,
    pagination: {
      totalItems: total,
      currentPage,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    },
  };
};

export const addEmployeeService = async (req) => {
  const data = { ...req.body };

  data.status = true;

  // Преобразуем числовые поля
  if (data.employee_number) data.employee_number = Number(data.employee_number);

  // Преобразуем даты
  if (data.date_of_birth) data.date_of_birth = new Date(data.date_of_birth);
  if (data.passport_expiry_date)
    data.passport_expiry_date = new Date(data.passport_expiry_date);
  if (data.order_date) data.order_date = new Date(data.order_date);

  // Обработка файла (если загружен)
  if (req.file) {
    const ext = path.extname(req.file.originalname);
    const newFileName = `${data.last_name}_${
      data.first_name
    }_${Date.now()}${ext}`;
    const newPath = path.join(req.file.destination, newFileName);
    fs.renameSync(req.file.path, newPath);
    data.photo = `/api/uploads/employees/${newFileName}`;
  }

  // Связи Prisma (connect)
  if (data.branch_id) {
    data.branch = { connect: { id: Number(data.branch_id) } };
    delete data.branch_id;
  }
  if (data.department_id) {
    data.department = { connect: { id: Number(data.department_id) } };
    delete data.department_id;
  }
  if (data.position_id) {
    data.position = { connect: { id: Number(data.position_id) } };
    delete data.position_id;
  }
  if (data.work_schedule_id) {
    data.work_schedule = { connect: { id: Number(data.work_schedule_id) } };
    delete data.work_schedule_id;
  }

  // Передаём дальше в модель
  return await createEmployee(data);
};

export const getActiveEmployeesService = async ({ userId, filters = {} }) => {
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

  const records = await getActiveEmployeesModel(where);

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
};

export const EmployeeService = {
  update: async (id, rawData, file, userId) => {
    if (!rawData || Object.keys(rawData).length === 0) {
      throw new Error("Нет данных для обновления");
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // 1️⃣ Подготовка raw
    const raw = { ...rawData };
    delete raw.id;

    // 2️⃣ Получаем текущий график
    const currentWorkSchedule = await EmployeeModel.getCurrentWorkSchedule(id);

    const newScheduleId =
      raw.work_schedule_id !== undefined ? Number(raw.work_schedule_id) : null;

    const oldScheduleId = currentWorkSchedule?.work_schedule_id ?? null;

    const scheduleChanged =
      newScheduleId !== null && newScheduleId !== oldScheduleId;

    // 3.1 История графиков
    if (scheduleChanged) {
      await EmployeeModel.updateWorkSchedule(
        Number(id),
        newScheduleId,
        userId,
        raw.work_schedule_start_date,
      );
    }

    // 3.2 Работа с фото
    if (file) {
      const ext = path.extname(file.originalname);
      const newFileName = `${id}${ext}`;
      const newPath = path.join(file.destination, newFileName);

      await fs.promises.rename(file.path, newPath);
      raw.photo = `/api/uploads/employees/${newFileName}`;
    }

    // 3.3 Удаляем пустые строки
    Object.keys(raw).forEach((k) => {
      if (Array.isArray(raw[k])) return;
      if (raw[k] === "") delete raw[k];
    });

    const data = {};

    if (raw.employee_number !== undefined)
      data.employee_number = Number(raw.employee_number);

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
      "order_number",
      "address",
      "education_specialty",
      "photo",
    ];

    scalarFields.forEach((f) => {
      if (raw[f] !== undefined) data[f] = raw[f];
    });

    if (raw.date_of_birth) data.date_of_birth = new Date(raw.date_of_birth);

    if (raw.document_validity_period)
      data.document_validity_period = new Date(raw.document_validity_period);

    if (raw.status !== undefined) {
      if (["true", "active", true, 1, "1"].includes(raw.status))
        data.status = true;
      else if (["false", "inactive", false, 0, "0"].includes(raw.status))
        data.status = false;
    }

    // Связи
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
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      data.doors = { set: doorIds.map((id) => ({ id })) };
    }

    if (scheduleChanged)
      data.workSchedule = {
        connect: { id: newScheduleId },
      };

    const oldData = await EmployeeModel.getByid(id);

    // 3.4 Обновляем сотрудника

    const updatedEmployee = await EmployeeModel.update(id, data);

    const photoChanged = file !== undefined;
    const oldDoorIds = oldData.doors?.map((d) => Number(d.id)) || [];
    const newDoorIds = Array.isArray(raw.door_ids)
      ? raw.door_ids.map((id) => Number(id))
      : null;

    const doorsChanged =
      newDoorIds !== null &&
      (newDoorIds.length !== oldDoorIds.length ||
        !newDoorIds.every((id) => oldDoorIds.includes(id)));

    const statusChanged =
      raw.status !== undefined && Boolean(data.status) !== oldData.status;

    if (photoChanged || doorsChanged || statusChanged) {
      FaceDeviceService.syncEmployee(id);
    }

    return updatedEmployee;
  },

  getByid: async (id) => {
    const employee = await EmployeeModel.getByid(id);

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
};
