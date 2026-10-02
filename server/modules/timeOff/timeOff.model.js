import { prismaContext } from "../../utils/prismaContext.js";

export const TimeOffModel = {
  get: async ({ where, skip = 0, take = 50 }) => {
    const prisma = prismaContext.get();

    const [records, total] = await Promise.all([
      prisma.time_off.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
        include: {
          employee: {
            include: { branch: true, department: true, position: true },
          },
          addedBy: {
            select: {
              employee: true,
            },
          },
        },
      }),
      prisma.time_off.count({ where }),
    ]);

    return { records, total };
  },

  getAll: async ({ where }) => {
    const prisma = prismaContext.get();

    return prisma.time_off.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        employee: {
          include: { branch: true, department: true, position: true },
        },
        addedBy: true,
      },
    });
  },

  // Табель: без include employee/branch/addedBy — только поля, которые реально
  // читает generateAttendanceReport.
  getAllLean: async ({ where }) => {
    const prisma = prismaContext.get();

    return prisma.time_off.findMany({
      where,
      orderBy: { id: "desc" },
      select: {
        id: true,
        employee_id: true,
        date_from: true,
        date_to: true,
        type: true,
        reason: true,
        is_company_paid: true,
        credited_hours: true,
      },
    });
  },

  getById: async (id) => {
    const prisma = prismaContext.get();

    return prisma.time_off.findUnique({
      where: { id: Number(id) },
    });
  },

  create: (data, tx = null) => {
    const prisma = tx || prismaContext.get();

    return prisma.time_off.create({ data });
  },

  createMany: (data, tx = null) => {
    const prisma = tx || prismaContext.get();

    return prisma.time_off.createMany({
      data,
      skipDuplicates: true,
    });
  },

  update: async (id, data, tx = null) => {
    const prisma = tx || prismaContext.get();

    return prisma.time_off.update({
      where: { id: Number(id) },
      data,
    });
  },

  delete: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();

    return prisma.time_off.delete({
      where: { id: Number(id) },
    });
  },
};
