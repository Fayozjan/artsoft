import { DateTime } from "luxon";

import * as timeOffModel from "./timeOff.model.js";
import { UserModel } from "../users/users.model.js";

import { buildAccessWhere } from "../../utils/accessFilter.js";

const getFullName = (person) => {
  if (!person) return null;
  return [person.last_name, person.first_name, person.middle_name, person.id]
    .filter(Boolean)
    .join(" ");
};

export const formatRecords = (records) =>
  records.map((r) => {
    const formatted = {
      ...r,
      date_from: r.date_from
        ? DateTime.fromJSDate(new Date(r.date_from))
            .setZone("Asia/Tashkent")
            .toFormat("dd-MM-yyyy HH:mm")
        : null,
      date_to: r.date_to
        ? DateTime.fromJSDate(new Date(r.date_to))
            .setZone("Asia/Tashkent")
            .toFormat("dd-MM-yyyy HH:mm")
        : null,
      employeeFullName: getFullName(r.employee),
      creatorFullName: getFullName(r.creator?.employee),
    };

    // Убираем объекты employee и creator
    delete formatted.creator;

    return formatted;
  });

export const createTimeOff = async (data, creator_id) => {
  const {
    selectedEmployeeIds,
    type,
    reason,
    date_from,
    date_to,
    credited_hours = 0,
    is_company_paid = false,
  } = data;

  if (!Array.isArray(selectedEmployeeIds) || !selectedEmployeeIds.length) {
    throw new Error("Сотрудники не выбраны");
  }

  if (!reason || !date_from || !date_to) {
    throw new Error("Обязательные поля отсутствуют");
  }

  const from = new Date(date_from);
  const to = new Date(date_to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Некорректная дата");
  }

  if (from > to) {
    throw new Error("date_from не может быть больше date_to");
  }

  const payloadBase = {
    type,
    reason: reason.trim(),
    date_from: from,
    date_to: to,
    credited_hours,
    is_company_paid,
    creator_id,
  };

  // 👉 создаём записи для каждого сотрудника
  return timeOffModel.createManyTimeOffs(
    selectedEmployeeIds.map((employee_id) => ({
      ...payloadBase,
      employee_id,
    })),
  );
};

export async function getTimeOffs({ userId, page, pageSize, filters }) {
  const user = await UserModel.getUserById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");

  const accessWhere = buildAccessWhere(user);
  const where = { ...accessWhere };

  const { date_from, date_to, branch_id, department_id, position_id, search } =
    filters || {};

  // --- фильтры по датам ---
  if (date_from) {
    const fromDate = new Date(date_from);
    if (!isNaN(fromDate.getTime())) {
      where.date_from = { gte: fromDate.toISOString() };
    }
  }

  if (date_to) {
    const toDate = new Date(date_to);
    if (!isNaN(toDate.getTime())) {
      where.date_to = { lte: toDate.toISOString() };
    }
  }

  // --- фильтры по подразделениям / филиалам / должности ---
  if (branch_id || department_id || position_id || search) {
    where.employee = where.employee || {};

    if (branch_id) where.employee.branch_id = Number(branch_id);
    if (department_id) where.employee.department_id = Number(department_id);
    if (position_id) where.employee.position_id = Number(position_id);

    // --- универсальный search ---
    if (search) {
      const searchStr = search.toString().trim();

      if (/^\d+$/.test(searchStr)) {
        const num = Number(searchStr);

        where.OR = [
          { id: num },
          {
            employee: {
              OR: [{ id: num }, { pinfl: searchStr }, { employee_number: num }],
            },
          },
        ];
      } else {
        where.employee = {
          OR: [
            { first_name: { contains: searchStr, mode: "insensitive" } },
            { last_name: { contains: searchStr, mode: "insensitive" } },
            { middle_name: { contains: searchStr, mode: "insensitive" } },
          ],
        };
      }
    }
  }

  // --- пагинация ---
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.max(parseInt(pageSize, 10) || 50, 1);
  const skip = (currentPage - 1) * size;

  const { records, total } = await timeOffModel.getTimeOff({
    where,
    skip,
    take: size,
  });

  const formattedData = formatRecords(records);

  return {
    data: formattedData,
    pagination: {
      totalItems: total,
      currentPage,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    },
  };
}

export async function getTimeOffsAllService({ userId, filters }) {
  const user = await UserModel.getUserById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");

  const accessWhere = buildAccessWhere(user);
  const where = { ...accessWhere };

  const { date_from, date_to, branch_id, department_id, position_id, search } =
    filters || {};

  // --- фильтры по датам ---
  if (date_from) {
    const fromDate = new Date(date_from);
    if (!isNaN(fromDate.getTime())) {
      where.date_from = { gte: fromDate.toISOString() };
    }
  }

  if (date_to) {
    const toDate = new Date(date_to);
    if (!isNaN(toDate.getTime())) {
      where.date_to = { lte: toDate.toISOString() };
    }
  }

  // --- фильтры по сотруднику / подразделению ---
  if (branch_id || department_id || position_id || search) {
    where.employee = where.employee || {};

    if (branch_id) where.employee.branch_id = Number(branch_id);
    if (department_id) where.employee.department_id = Number(department_id);
    if (position_id) where.employee.position_id = Number(position_id);

    // --- универсальный поиск ---
    if (search) {
      const searchStr = search.toString().trim();

      if (/^\d+$/.test(searchStr)) {
        const num = Number(searchStr);

        where.OR = [
          { id: num }, // поиск по ID записи
          {
            employee: {
              OR: [
                { id: num },
                { pinfl: searchStr },
                { employee_number: num }, // Int поле
              ],
            },
          },
        ];
      } else {
        where.employee = {
          OR: [
            { first_name: { contains: searchStr, mode: "insensitive" } },
            { last_name: { contains: searchStr, mode: "insensitive" } },
            { middle_name: { contains: searchStr, mode: "insensitive" } },
          ],
        };
      }
    }
  }

  // --- получение всех записей без пагинации ---
  const records = await timeOffModel.getTimeOffAll({ where });
  const formattedData = formatRecords(records);

  return { data: formattedData };
}

export const getTimeOffByIdService = async (id) => {
  const record = await timeOffModel.getTimeOffById(id);

  if (!record) {
    throw new Error("Time off не найден");
  }

  return record;
};

export const updateTimeOffService = async (id, data) => {
  try {
    const updated = await timeOffModel.updateTimeOff(id, data);

    if (!updated) {
      throw new Error("Time off не найден для обновления");
    }

    return updated;
  } catch (err) {
    // Можно ловить специфические ошибки Prisma, например, если запись не существует
    throw err;
  }
};

export const deleteTimeOffService = async (id) => {
  try {
    const deleted = await timeOffModel.deleteTimeOff(id);
    return deleted;
  } catch (err) {
    // Prisma ошибка P2025 — запись не найдена
    if (err.code === "P2025") {
      throw new Error("Time off не найден для удаления");
    }
    throw err;
  }
};
