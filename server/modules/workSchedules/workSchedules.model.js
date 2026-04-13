import { prismaContext } from "../../utils/prismaContext.js";

export const workScheduleModel = {
  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.work_schedules.create({ data });
  },

  findAll: async ({ skip = 0, take = 50, where = {} } = {}, tx = null) => {
    const prisma = tx || prismaContext.get();
    const [schedules, total] = await Promise.all([
      prisma.work_schedules.findMany({
        skip,
        take,
        where,
        orderBy: { name: "asc" },
        include: { _count: { select: { employees: true } } },
      }),
      prisma.work_schedules.count({ where }),
    ]);
    return { schedules, total };
  },

  findById: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.work_schedules.findUnique({
      where: { id: Number(id) },
      include: { employees: { select: { id: true } } },
    });
  },

  findActive: async (tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.work_schedules.findMany({ where: { status: true } });
  },

  updateById: async (id, data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.work_schedules.update({
      where: { id: Number(id) },
      data,
    });
  },

  deleteById: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.work_schedules.delete({
      where: { id: Number(id) },
    });
  },
};
