import { prismaContext } from "../../utils/prismaContext.js";

export const ProductModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.products.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.products.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, short_name: true } },
      },
    });
  },

  setAttributes: async (productId, attributeIds) => {
    const prisma = prismaContext.get();
    return prisma.$transaction([
      prisma.product_attributes.deleteMany({ where: { product_id: Number(productId) } }),
      ...(attributeIds.length
        ? [
            prisma.product_attributes.createMany({
              data: attributeIds.map((attributeId) => ({
                product_id: Number(productId),
                attribute_id: Number(attributeId),
              })),
            }),
          ]
        : []),
    ]);
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.products.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, short_name: true } },
        productAttributes: {
          include: {
            attribute: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.products.findUnique({
      where: { id: Number(id) },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, short_name: true } },
        productAttributes: {
          include: {
            attribute: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.products.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.products.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.products.delete({ where: { id: Number(id) } });
  },
};
