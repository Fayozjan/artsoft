import { prismaContext } from "../../utils/prismaContext.js";

export const LateEmployeesFilterPresetModel = {
  getAll: async () => {
    const prisma = prismaContext.get();
    return prisma.late_employees_filter_presets.findMany({
      orderBy: { id: "asc" },
      include: { addedBy: { select: { id: true, username: true } } },
    });
  },

  getById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.late_employees_filter_presets.findUnique({ where: { id } });
  },

  create: async ({ name, filter, created_by }) => {
    const prisma = prismaContext.get();
    return prisma.late_employees_filter_presets.create({
      data: { name, filter, created_by },
      include: { addedBy: { select: { id: true, username: true } } },
    });
  },

  update: async ({ id, name, filter }) => {
    const prisma = prismaContext.get();
    return prisma.late_employees_filter_presets.update({
      where: { id },
      data: { name, filter },
      include: { addedBy: { select: { id: true, username: true } } },
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.late_employees_filter_presets.delete({ where: { id } });
  },
};
