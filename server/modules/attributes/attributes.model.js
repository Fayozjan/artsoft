import { prismaContext } from "../../utils/prismaContext.js";

export const AttributeModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.attributes.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.attributes.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { values: true, categoryAttributes: true } },
      },
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.attributes.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.attributes.findUnique({ where: { id: Number(id) } });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.attributes.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.attributes.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.attributes.delete({ where: { id: Number(id) } });
  },
};

export const AttributeValueModel = {
  findByAttribute: async (attributeId) => {
    const prisma = prismaContext.get();
    return prisma.attribute_values.findMany({
      where: { attribute_id: Number(attributeId) },
      orderBy: { value: "asc" },
    });
  },

  findActiveByAttribute: async (attributeId) => {
    const prisma = prismaContext.get();
    return prisma.attribute_values.findMany({
      where: { attribute_id: Number(attributeId), status: true },
      orderBy: { value: "asc" },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.attribute_values.findUnique({ where: { id: Number(id) } });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.attribute_values.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.attribute_values.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.attribute_values.delete({ where: { id: Number(id) } });
  },
};
