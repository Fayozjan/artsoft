import { prismaContext } from "../../utils/prismaContext.js";

export const PositionModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.positions.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.positions.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.positions.findUnique({
      where: { id: Number(id) },
      include: { employees: true },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.positions.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.positions.update({
      where: { id: Number(id) },
      data,
    });
  },
};
