import { prismaContext } from "../../utils/prismaContext.js";

export const UnitModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.units.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.units.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.units.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.units.findUnique({ where: { id: Number(id) } });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.units.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.units.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.units.delete({ where: { id: Number(id) } });
  },
};
