import { TimeOffModel } from "./timeOff.model.js";
import { UserModel } from "../users/users.model.js";
import { buildTimeOffEmployeeAccess } from "./timeOff.helpers.js";

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
      employeeFullName: getFullName(r.employee),
      creatorFullName: getFullName(r.addedBy?.employee),
      branch_name: r.employee?.branch?.name ?? null,
      department_name: r.employee?.department?.name ?? null,
      position_name: r.employee?.position?.name ?? null,
      employee_photo: r.employee?.photo ?? null,
      employee_number: r.employee?.employee_number ?? null,
      employee_status: r.employee?.status ?? null,
    };

    delete formatted.employee;
    delete formatted.creator;

    return formatted;
  });

export const TimeOffService = {
  create: async (data, creator_id) => {
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
      added_by: creator_id,
    };

    return TimeOffModel.createMany(
      selectedEmployeeIds.map((employee_id) => ({
        ...payloadBase,
        employee_id,
      })),
    );
  },

  get: async ({ userId, page, pageSize, filters }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const accessWhere = buildTimeOffEmployeeAccess(user);
    const where = { ...accessWhere };

    const {
      date_from,
      date_to,
      branch_id,
      department_id,
      position_id,
      search,
    } = filters || {};

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
                OR: [
                  { id: num },
                  { pinfl: searchStr },
                  { employee_number: searchStr },
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

    // --- пагинация ---
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const size = Math.max(parseInt(pageSize, 10) || 50, 1);
    const skip = (currentPage - 1) * size;

    const { records, total } = await TimeOffModel.get({
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
  },

  getAll: async ({ userId, filters }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const accessWhere = buildTimeOffEmployeeAccess(user);
    const where = { ...accessWhere };

    const {
      date_from,
      date_to,
      branch_id,
      department_id,
      position_id,
      employeeIds,
      search,
    } = filters || {};

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
        const s = search.toString().trim();

        const numericValue = Number(s);
        const isValidInt4 =
          /^\d+$/.test(s) &&
          Number.isInteger(numericValue) &&
          numericValue >= -2147483648 &&
          numericValue <= 2147483647;

        if (/^\d+$/.test(s)) {
          const orConditions = [];

          // ID записи и employee.id — только если влезает в INT4
          if (isValidInt4) {
            orConditions.push({ id: numericValue });
          }

          orConditions.push({
            employee: {
              OR: [
                ...(isValidInt4
                  ? [{ id: numericValue }, { employee_number: s }]
                  : []),
                { pinfl: s }, // pinfl — всегда строка
              ],
            },
          });

          where.OR = orConditions;
        } else {
          where.employee = {
            OR: [
              { first_name: { contains: s, mode: "insensitive" } },
              { last_name: { contains: s, mode: "insensitive" } },
              { middle_name: { contains: s, mode: "insensitive" } },
            ],
          };
        }
      }
    }

    // --- Фильтр по выбранным employeeIds ---
    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      if (!where.employee) where.employee = {};
      where.employee.id = { in: employeeIds.map(Number) };
    }

    // --- получение всех записей без пагинации ---
    const records = await TimeOffModel.getAll({ where });
    const formattedData = formatRecords(records);

    return { data: formattedData };
  },

  getById: async (id) => {
    const record = await TimeOffModel.getById(id);

    if (!record) {
      throw new Error("Time off не найден");
    }

    return record;
  },

  updateById: async (id, data) => {
    try {
      const { id: _, added_by: __, added_at: ___, ...cleanData } = data;

      const preparedData = {
        ...cleanData,
        employee_id: Number(cleanData.employee_id),
        credited_hours: cleanData.credited_hours
          ? Number(cleanData.credited_hours)
          : 0,
        date_from: cleanData.date_from
          ? new Date(cleanData.date_from)
          : undefined,
        date_to: cleanData.date_to ? new Date(cleanData.date_to) : undefined,
      };

      const updated = await TimeOffModel.update(Number(id), preparedData);

      if (!updated) {
        throw new Error("Time off не найден для обновления");
      }

      return updated;
    } catch (err) {
      throw err;
    }
  },

  deleteById: async (id) => {
    try {
      const deleted = await TimeOffModel.delete(id);
      return deleted;
    } catch (err) {
      if (err.code === "P2025") {
        throw new Error("Time off не найден для удаления");
      }
      throw err;
    }
  },
};
