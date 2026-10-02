import { prismaContext } from "../../utils/prismaContext.js";

export const PartnerModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.partners.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.partners.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.partners.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.partners.findUnique({
      where: { id: Number(id) },
      include: {
        category: { select: { id: true, name: true } },
        supplierLocation: { select: { id: true, name: true } },
        customerLocation: { select: { id: true, name: true } },
      },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.partners.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.partners.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.partners.delete({ where: { id: Number(id) } });
  },
};
