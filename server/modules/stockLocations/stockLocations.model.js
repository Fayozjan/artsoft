import { prismaContext } from "../../utils/prismaContext.js";

export const StockLocationModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.findMany({
      where,
      skip,
      take,
      orderBy: { complete_name: "asc" },
      include: {
        parent: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { children: true } },
      },
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.findMany({
      where: { status: true },
      orderBy: { complete_name: "asc" },
      select: { id: true, name: true, complete_name: true, parent_id: true, type: true, branch_id: true },
    });
  },

  findByCode: async (code) => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.findFirst({ where: { code } });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.findUnique({
      where: { id: Number(id) },
      include: {
        parent: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  },

  findChildren: async (parentId) => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.findMany({ where: { parent_id: Number(parentId) } });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.count({ where });
  },

  countAll: async () => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.count();
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.delete({ where: { id: Number(id) } });
  },
};
