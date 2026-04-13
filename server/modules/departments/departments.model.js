import { prismaContext } from "../../utils/prismaContext.js";

export const DepartmentsModel = {
  findMany: async ({ where, skip, take, include }) => {
    const prisma = prismaContext.get();
    return prisma.departments.findMany({
      where,
      skip,
      take,
      include,
      orderBy: { name: "asc" },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.departments.count({ where });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.departments.findUnique({
      where: { id: Number(id) },
      select: { name: true, branch_id: true, status: true },
    });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.departments.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.departments.update({
      where: { id: Number(id) },
      data,
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    const count = await prisma.employees.count({
      where: { department_id: Number(id) },
    });
    if (count > 0) throw new Error("Невозможно удалить отдел с сотрудниками");
    return prisma.departments.delete({ where: { id: Number(id) } });
  },
};
