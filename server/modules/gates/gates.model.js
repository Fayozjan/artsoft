import { prismaContext } from "../../utils/prismaContext.js";

export const GateModel = {
  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();

    return prisma.gates.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        branch: {
          where: { status: true },
          select: {
            name: true,
          },
        },
        cameras: {
          where: { status: true },
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            cameras: true,
          },
        },
      },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.gates.count({ where });
  },

  findActive: async () => {
    const prisma = prismaContext.get();

    return prisma.gates.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      include: {
        cameras: {
          where: { status: true },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();

    return prisma.gates.findUnique({
      where: { id: Number(id) },
      include: {
        cameras: true,
      },
    });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.gates.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();

    return prisma.gates.update({
      where: { id: Number(id) },
      data,
    });
  },
};
