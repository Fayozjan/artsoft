import { buildAccessWhere } from "../../utils/accessFilter.js";
import { UserModel } from "../users/users.model.js";
import * as facePassesModel from "./facePasses.model.js";

function formatDates(records) {
  return records.map((r) => ({
    ...r,
    date: new Date(r.date).toLocaleString("ru-RU", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  }));
}

export async function getFacePasses({ userId, page, pageSize, filters = {} }) {
  const {
    start_date,
    end_date,
    branch_id,
    department_id,
    position_id,
    direction,
    door_id,
    search,
  } = filters;

  // --- получаем пользователя ---
  const user = await UserModel.getUserById(userId);
  if (!user) throw new Error("Пользователь не найден");

  const accessWhere = buildAccessWhere(user);

  // --- формируем условия запроса ---
  const where = { ...accessWhere };

  // Дата
  if (start_date || end_date) {
    where.date = {};
    if (start_date) where.date.gte = new Date(start_date);
    if (end_date) where.date.lte = new Date(end_date);
  }

  // Фильтры по сотруднику
  const employeeWhere = {};
  if (branch_id) employeeWhere.branch_id = Number(branch_id);
  if (department_id) employeeWhere.department_id = Number(department_id);
  if (position_id) employeeWhere.position_id = Number(position_id);
  if (Object.keys(employeeWhere).length) where.employee = employeeWhere;
  if (search) {
    where.OR = [
      { employee_id: isNaN(Number(search)) ? undefined : Number(search) },
      { employee: { first_name: { contains: search, mode: "insensitive" } } },
      { employee: { last_name: { contains: search, mode: "insensitive" } } },
      { employee: { middle_name: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Остальные фильтры
  if (direction) where.direction = direction;
  if (door_id) where.door_id = Number(door_id);

  // --- пагинация ---
  const currentPage = Math.max(parseInt(page) || 1, 1);
  const size = Math.max(parseInt(pageSize) || 50, 1);
  const skip = (currentPage - 1) * size;

  const { records, total } = await facePassesModel.getFacePasses({
    where,
    skip,
    take: size,
  });

  return {
    data: formatDates(records),
    pagination: {
      totalItems: total,
      currentPage,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    },
  };
}

export async function getAllFacePasses({ userId, filters = {} }) {
  const {
    start_date,
    end_date,
    branch_id,
    department_id,
    position_id,
    direction,
    door_id,
    employeeIds,
    search,
  } = filters;

  // --- получаем пользователя ---
  const user = await UserModel.getUserById(userId);
  if (!user) throw new Error("Пользователь не найден");

  const accessWhere = buildAccessWhere(user);

  // --- базовый where ---
  const where = { ...accessWhere };

  // --- Фильтр по дате ---
  if (start_date || end_date) {
    where.date = {};
    if (start_date) where.date.gte = new Date(start_date);
    if (end_date) where.date.lte = new Date(end_date);
  }

  // --- Фильтры по сотруднику (branch, dep, position) ---
  const employeeWhere = {};
  if (branch_id) employeeWhere.branch_id = Number(branch_id);
  if (department_id) employeeWhere.department_id = Number(department_id);
  if (position_id) employeeWhere.position_id = Number(position_id);

  if (Object.keys(employeeWhere).length > 0) {
    where.employee = employeeWhere;
  }

  // --- Поиск search ---
  if (search) {
    const searchNumber = Number(search);
    const orConditions = [];

    // если search – число → ищем по employee_id
    if (!isNaN(searchNumber)) {
      orConditions.push({ employee_id: searchNumber });
    }

    // поиск по ФИО
    orConditions.push(
      { employee: { first_name: { contains: search, mode: "insensitive" } } },
      { employee: { last_name: { contains: search, mode: "insensitive" } } },
      { employee: { middle_name: { contains: search, mode: "insensitive" } } },
    );

    where.OR = orConditions;
  }

  // --- Фильтр по выбранным employeeIds ---
  if (Array.isArray(employeeIds) && employeeIds.length > 0) {
    if (!where.employee) where.employee = {};
    where.employee.id = { in: employeeIds.map(Number) };
  }

  // --- Остальные фильтры ---
  if (direction) where.direction = direction;
  if (door_id) where.door_id = Number(door_id);

  // --- получаем данные ---
  const { records } = await facePassesModel.getFacePasses({ where });

  const formatted = formatDates(records);

  formatted.sort((a, b) => a.employee_id - b.employee_id);

  // --- группируем по сотрудникам ---
  const grouped = Object.values(
    formatted.reduce((acc, item) => {
      const id = item.employee_id;

      if (!acc[id]) {
        const emp = item.employee || {};

        acc[id] = {
          employeeId: id,
          employeeNumber: emp.employee_number,
          employeeFullName:
            [emp.last_name, emp.first_name, emp.middle_name]
              .filter(Boolean)
              .join(" ") + ` (${emp.id})`,
          employeePhoto: emp.photo,
          branchName: emp.branch?.name || null,
          departmentName: emp.department?.name || null,
          positionName: emp.position?.name || null,
          workSchedule: emp.work_schedule || null,

          events: [],
        };
      }

      acc[id].events.push({
        id: item.id,
        date: item.date,
        direction: item.direction,
        doorId: item.door_id,
        doorName: item.door?.name || null,
        photo: item.photo || null,
      });

      return acc;
    }, {}),
  );

  return grouped;
}

export const addFacePass = async (payload) => {
  const data = {
    date: payload.date ? new Date(payload.date) : new Date(),
    identifier: payload.identifier,
    photo: payload.photo ?? null,
    employee_id: payload.employee_id,
    door_id: payload.door_id,
    face_devices_id: payload.face_devices_id,
    direction: payload.direction ?? null,
  };

  return facePassesModel.createFacePass(data);
};
