import path from "path";
import fs from "fs";
import {
  createEmployee,
  getEmployees,
  getEmployee,
  getActiveEmployeesModel,
  editEmployee,
} from "./employees.model.js";

import { UserModel } from "../users/users.model.js";
import { buildAccessWhere } from "../../utils/accessFilter.js";

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

export const getEmployeeService = async (id) => {
  const employee = await getEmployee(id);

  if (!employee) return null;

  // Преобразуем даты, если они есть
  const dateFields = ["date_of_birth", "passport_expiry_date", "order_date"];

  for (const field of dateFields) {
    if (employee[field]) {
      const date = new Date(employee[field]);
      employee[field] = date.toISOString().split("T")[0];
    }
  }

  return employee;
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

export const updateEmployeeService = async (id, data) => {
  try {
    if (!data || Object.keys(data).length === 0) {
      throw new Error("Нет данных для обновления");
    }

    const updatedEmployee = await editEmployee(id, data);

    return updatedEmployee;
  } catch (error) {
    console.error("Ошибка при обновлении сотрудника:", error.message);
    throw error;
  }
};
