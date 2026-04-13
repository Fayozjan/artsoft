import { prismaContext } from "../../utils/prismaContext.js";

export const BranchModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.branches.create({ data });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.branches.findMany({
      where,
      include: {
        director: true,
        departments: { include: { _count: { select: { employees: true } } } },
        addedBy: {
          select: {
            id: true,
            employee: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                middle_name: true,
              },
            },
          },
        },
      },
      skip,
      take,
      orderBy: { name: "asc" },
    });
  },

  findByName: async (name) => {
    const prisma = prismaContext.get();
    return prisma.branches.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
  },

  findById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.branches.findUnique({
      where: { id },
      include: { director: true },
    });
  },

  findActive: async (where) => {
    const prisma = prismaContext.get();
    return prisma.branches.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        departments: {
          where: { status: true },
          select: { id: true, name: true },
        },
        _count: { select: { employees: { where: { status: true } } } },
      },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.branches.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.branches.update({ where: { id }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.branches.delete({ where: { id } });
  },

  isBranchInUse: async (branchId) => {
    const prisma = prismaContext.get();
    const branch = await prisma.branches.findUnique({
      where: { id: branchId },
      include: { departments: true },
    });
    return branch?.departments?.length > 0;
  },
};
