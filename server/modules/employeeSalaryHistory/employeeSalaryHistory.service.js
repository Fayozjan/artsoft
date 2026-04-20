import { EmployeeSalaryHistoryModel } from "./employeeSalaryHistory.model.js";

const VALID_TYPES = ["monthly", "hourly", "piecework"];

export const EmployeeSalaryHistoryService = {
  getByEmployee: async (employeeId) => {
    if (!employeeId) {
      return { success: false, message: "Не указан employee_id" };
    }
    try {
      const data = await EmployeeSalaryHistoryModel.findAllByEmployeeId(employeeId);
      return { success: true, data };
    } catch (error) {
      console.error("Ошибка при получении истории зарплат:", error);
      return { success: false, message: "Ошибка сервера" };
    }
  },

  create: async (userId, body) => {
    const { employee_id, salary_type, amount, date_from, date_to, note } = body;

    if (!employee_id || !salary_type || !amount || !date_from) {
      return { success: false, message: "Не указаны обязательные поля" };
    }

    if (!VALID_TYPES.includes(salary_type)) {
      return { success: false, message: "Недопустимый тип оплаты" };
    }

    try {
      const empId = Number(employee_id);
      const newDateFrom = new Date(date_from);
      const record = await EmployeeSalaryHistoryModel.createWithAutoClose(empId, {
        employee: { connect: { id: empId } },
        salary_type,
        amount: parseFloat(amount),
        date_from: newDateFrom,
        date_to: date_to ? new Date(date_to) : null,
        note: note || null,
        addedBy: { connect: { id: Number(userId) } },
      });
      return { success: true, data: record };
    } catch (error) {
      console.error("Ошибка при создании записи зарплаты:", error);
      return { success: false, message: "Ошибка сервера" };
    }
  },

  update: async (id, body) => {
    const { salary_type, amount, date_from, date_to, note } = body;

    if (!id) return { success: false, message: "Не указан ID" };

    if (salary_type && !VALID_TYPES.includes(salary_type)) {
      return { success: false, message: "Недопустимый тип оплаты" };
    }

    try {
      const existing = await EmployeeSalaryHistoryModel.findById(id);
      if (!existing) return { success: false, message: "Запись не найдена" };

      const data = {};
      if (salary_type !== undefined) data.salary_type = salary_type;
      if (amount !== undefined) data.amount = parseFloat(amount);
      if (date_from !== undefined) data.date_from = new Date(date_from);
      if (date_to !== undefined) data.date_to = date_to ? new Date(date_to) : null;
      if (note !== undefined) data.note = note || null;

      const updated = await EmployeeSalaryHistoryModel.update(id, data);
      return { success: true, data: updated };
    } catch (error) {
      console.error("Ошибка при обновлении записи зарплаты:", error);
      return { success: false, message: "Ошибка сервера" };
    }
  },

  getEmployeesWithSalary: async ({
    page = 1,
    pageSize = 50,
    search,
    branch_id,
    department_id,
    position_id,
    status,
    salary_type,
    amount_from,
    amount_to,
    no_salary,
    sort_by = "last_name",
    sort_order = "asc",
  } = {}) => {
    try {
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const where = { AND: [] };

      if (branch_id) where.branch_id = Number(branch_id);
      if (department_id) where.department_id = Number(department_id);
      if (position_id) where.position_id = Number(position_id);

      if (status !== undefined && status !== "") {
        where.status = status === "true";
      }

      if (search && search.trim()) {
        const words = search.trim().split(/\s+/).filter(Boolean);
        if (words.length > 1) {
          // Each word must appear in at least one name field
          where.AND.push({
            AND: words.map((w) => ({
              OR: [
                { last_name: { contains: w, mode: "insensitive" } },
                { first_name: { contains: w, mode: "insensitive" } },
                { middle_name: { contains: w, mode: "insensitive" } },
              ],
            })),
          });
        } else {
          const s = words[0];
          const numVal = parseInt(s, 10);
          const conds = [
            { last_name: { contains: s, mode: "insensitive" } },
            { first_name: { contains: s, mode: "insensitive" } },
            { middle_name: { contains: s, mode: "insensitive" } },
          ];
          if (!isNaN(numVal) && numVal > 0) {
            conds.push({ employee_number: numVal });
            conds.push({ id: numVal });
          }
          where.AND.push({ OR: conds });
        }
      }

      if (no_salary === "true") {
        where.employeeSalaryHistory = { none: {} };
      } else {
        const salaryFilter = {};
        if (salary_type) salaryFilter.salary_type = salary_type;
        if (amount_from) salaryFilter.amount = { gte: parseFloat(amount_from) };
        if (amount_to) {
          salaryFilter.amount = {
            ...(salaryFilter.amount || {}),
            lte: parseFloat(amount_to),
          };
        }
        if (no_salary === "false" || salary_type || amount_from || amount_to) {
          where.employeeSalaryHistory = { some: salaryFilter };
        }
      }

      if (where.AND.length === 0) delete where.AND;

      // Build orderBy
      const SORTABLE = {
        last_name: { last_name: sort_order },
        first_name: { first_name: sort_order },
        employee_number: { employee_number: sort_order },
        branch: { branch: { name: sort_order } },
        department: { department: { name: sort_order } },
        position: { position: { name: sort_order } },
        status: { status: sort_order },
      };

      const sortByAmount = sort_by === "amount";
      const orderBy = !sortByAmount && SORTABLE[sort_by]
        ? [SORTABLE[sort_by]]
        : [{ last_name: "asc" }];

      const { data, total } =
        await EmployeeSalaryHistoryModel.getEmployeesWithCurrentSalary({
          skip,
          take,
          where,
          orderBy,
          sortByAmount,
          sortOrder: sort_order,
        });

      const totalPages = Math.ceil(total / take);

      return {
        success: true,
        data,
        pagination: { total, totalPages, page: Number(page), pageSize: take },
      };
    } catch (error) {
      console.error("Ошибка при получении сотрудников с зарплатами:", error);
      return { success: false, message: "Ошибка сервера" };
    }
  },

  deleteById: async (id) => {
    if (!id) return { success: false, message: "Не указан ID" };
    try {
      const existing = await EmployeeSalaryHistoryModel.findById(id);
      if (!existing) return { success: false, message: "Запись не найдена" };

      await EmployeeSalaryHistoryModel.deleteById(id);
      return { success: true, message: "Запись удалена" };
    } catch (error) {
      console.error("Ошибка при удалении записи зарплаты:", error);
      return { success: false, message: "Ошибка сервера" };
    }
  },
};
