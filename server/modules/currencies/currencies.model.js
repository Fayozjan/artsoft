import { prismaContext } from "../../utils/prismaContext.js";

export const CurrencyModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.currencies.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.currencies.findMany({
      where,
      skip,
      take,
      orderBy: { code: "asc" },
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.currencies.findMany({
      where: { status: true },
      orderBy: { code: "asc" },
    });
  },

  findBase: async () => {
    const prisma = prismaContext.get();
    return prisma.currencies.findFirst({ where: { is_base: true } });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.currencies.findUnique({ where: { id: Number(id) } });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.currencies.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.currencies.update({ where: { id: Number(id) }, data });
  },

  unsetOtherBase: async (tx, exceptId) => {
    await tx.currencies.updateMany({
      where: { is_base: true, ...(exceptId ? { id: { not: Number(exceptId) } } : {}) },
      data: { is_base: false },
    });
  },

  createWithBaseSwap: async (data) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      if (data.is_base) await CurrencyModel.unsetOtherBase(tx);
      return tx.currencies.create({ data });
    });
  },

  updateWithBaseSwap: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      if (data.is_base) await CurrencyModel.unsetOtherBase(tx, id);
      return tx.currencies.update({ where: { id: Number(id) }, data });
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.currencies.delete({ where: { id: Number(id) } });
  },
};
