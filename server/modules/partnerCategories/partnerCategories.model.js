import { prismaContext } from "../../utils/prismaContext.js";

export const PartnerCategoryModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.partner_categories.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.partner_categories.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: { _count: { select: { partners: true } } },
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.partner_categories.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.partner_categories.findUnique({ where: { id: Number(id) } });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.partner_categories.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.partner_categories.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.partner_categories.delete({ where: { id: Number(id) } });
  },
};
