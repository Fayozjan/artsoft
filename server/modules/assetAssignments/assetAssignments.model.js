import { prismaContext } from "../../utils/prismaContext.js";

const employeeInclude = {
  select: {
    id: true,
    last_name: true,
    first_name: true,
    middle_name: true,
    photo: true,
    employee_number: true,
    branch: { select: { id: true, name: true } },
    department: { select: { id: true, name: true } },
    position: { select: { id: true, name: true } },
  },
};

export const AssetAssignmentModel = {
  findMany: async ({ where, skip, take, orderBy }) => {
    const prisma = prismaContext.get();
    return prisma.asset_assignments.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || { assigned_date: "desc" },
      include: { employee: employeeInclude },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.asset_assignments.count({ where });
  },

  // режим «по сотрудникам»: страница — это сотрудники, внутри их имущество
  findEmployeesWithAssignments: async ({ where, skip, take, assignmentWhere }) => {
    const prisma = prismaContext.get();
    return prisma.employees.findMany({
      where,
      skip,
      take,
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
      select: {
        ...employeeInclude.select,
        assetAssignments: {
          where: assignmentWhere,
          orderBy: { assigned_date: "desc" },
        },
      },
    });
  },

  countEmployeesWithAssignments: async (where) => {
    const prisma = prismaContext.get();
    return prisma.employees.count({ where });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.asset_assignments.findUnique({
      where: { id: Number(id) },
      include: { employee: employeeInclude },
    });
  },

  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.asset_assignments.create({ data });
  },

  // Массовая выдача: все позиции создаются в одной транзакции
  createMany: async (items) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(
      items.map((data) => prisma.asset_assignments.create({ data })),
    );
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.asset_assignments.update({
      where: { id: Number(id) },
      data,
      include: { employee: employeeInclude },
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.asset_assignments.delete({ where: { id: Number(id) } });
  },

  // Уникальные ранее введённые значения поля — для подсказок в форме выдачи
  findDistinctValues: async (field, take = 200) => {
    const prisma = prismaContext.get();
    // null-ы отсекаем в JS: у non-nullable колонок Prisma не принимает { not: null }
    const rows = await prisma.asset_assignments.findMany({
      distinct: [field],
      select: { [field]: true },
      orderBy: { [field]: "asc" },
      take,
    });
    return rows.map((r) => r[field]).filter(Boolean);
  },

  countDistinctEmployees: async (where) => {
    const prisma = prismaContext.get();
    const rows = await prisma.asset_assignments.groupBy({
      by: ["employee_id"],
      where,
    });
    return rows.length;
  },
};
