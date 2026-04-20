import { prismaContext } from "../../utils/prismaContext.js";

export const EmployeeSalaryHistoryModel = {
  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employee_salary_history.create({ data });
  },

  // Create new record and auto-close any open/overlapping previous records
  createWithAutoClose: async (employeeId, data) => {
    const prisma = prismaContext.get();

    return prisma.$transaction(async (tx) => {
      const newDateFrom = data.date_from instanceof Date
        ? data.date_from
        : new Date(data.date_from);

      const endDate = new Date(newDateFrom);
      endDate.setUTCDate(endDate.getUTCDate() - 1);

      const overlapping = await tx.employee_salary_history.findMany({
        where: {
          employee_id: employeeId,
          OR: [{ date_to: null }, { date_to: { gte: newDateFrom } }],
        },
        orderBy: { date_from: "asc" },
      });

      for (const rec of overlapping) {
        if (rec.date_from < newDateFrom) {
          await tx.employee_salary_history.update({
            where: { id: rec.id },
            data: { date_to: endDate },
          });
        } else {
          await tx.employee_salary_history.delete({ where: { id: rec.id } });
        }
      }

      return tx.employee_salary_history.create({ data });
    });
  },

  findById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.employee_salary_history.findUnique({
      where: { id: Number(id) },
    });
  },

  findAllByEmployeeId: async (employeeId) => {
    const prisma = prismaContext.get();
    return prisma.employee_salary_history.findMany({
      where: { employee_id: Number(employeeId) },
      orderBy: { date_from: "desc" },
      include: {
        addedBy: {
          select: {
            id: true,
            employee: {
              select: { first_name: true, last_name: true, middle_name: true },
            },
          },
        },
      },
    });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.employee_salary_history.update({
      where: { id: Number(id) },
      data,
    });
  },

  deleteById: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employee_salary_history.delete({
      where: { id: Number(id) },
    });
  },

  // Employees with their latest salary record
  getEmployeesWithCurrentSalary: async ({
    skip = 0,
    take = 50,
    where = {},
    orderBy = [{ last_name: "asc" }],
    sortByAmount = false,
    sortOrder = "asc",
  }) => {
    const prisma = prismaContext.get();

    const include = {
      branch: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      employeeSalaryHistory: {
        orderBy: { date_from: "desc" },
        take: 1,
      },
    };

    if (sortByAmount) {
      // Lightweight: get all matching IDs + latest amount, sort in JS, then paginate
      const lightweight = await prisma.employees.findMany({
        where,
        select: {
          id: true,
          employeeSalaryHistory: {
            orderBy: { date_from: "desc" },
            take: 1,
            select: { amount: true },
          },
        },
      });

      lightweight.sort((a, b) => {
        const aAmt =
          a.employeeSalaryHistory[0]?.amount != null
            ? Number(a.employeeSalaryHistory[0].amount)
            : null;
        const bAmt =
          b.employeeSalaryHistory[0]?.amount != null
            ? Number(b.employeeSalaryHistory[0].amount)
            : null;
        if (aAmt === null && bAmt === null) return 0;
        if (aAmt === null) return 1;  // nulls last
        if (bAmt === null) return -1;
        return sortOrder === "asc" ? aAmt - bAmt : bAmt - aAmt;
      });

      const total = lightweight.length;
      const pageIds = lightweight.slice(skip, skip + take).map((e) => e.id);

      if (pageIds.length === 0) return { data: [], total };

      const rows = await prisma.employees.findMany({
        where: { id: { in: pageIds } },
        include,
      });

      const idOrder = new Map(pageIds.map((id, i) => [id, i]));
      rows.sort((a, b) => idOrder.get(a.id) - idOrder.get(b.id));

      return { data: rows, total };
    }

    const [data, total] = await Promise.all([
      prisma.employees.findMany({ where, skip, take, orderBy, include }),
      prisma.employees.count({ where }),
    ]);

    return { data, total };
  },
};
