import { prismaContext } from "../../utils/prismaContext.js";

export const ProductCategoryModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.product_categories.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.product_categories.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true, children: true } },
      },
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.product_categories.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parent_id: true },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.product_categories.findUnique({
      where: { id: Number(id) },
      include: { parent: { select: { id: true, name: true } } },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.product_categories.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.product_categories.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.product_categories.delete({ where: { id: Number(id) } });
  },
};
