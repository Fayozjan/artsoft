import { prismaContext } from "../../utils/prismaContext.js";

export const CategoryAttributeModel = {
  findByCategory: async (categoryId) => {
    const prisma = prismaContext.get();
    return prisma.category_attributes.findMany({
      where: { category_id: Number(categoryId) },
      orderBy: { id: "asc" },
      include: {
        attribute: { select: { id: true, name: true, status: true } },
      },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.category_attributes.findUnique({ where: { id: Number(id) } });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.category_attributes.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.category_attributes.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.category_attributes.delete({ where: { id: Number(id) } });
  },
};
