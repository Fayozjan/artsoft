import { prismaPublic } from "../../utils/prismaForTenant.js";

export const EmployeeDoorTasksModel = {
  create: (data, tx = null) => {
    const prisma = tx || prismaPublic;
    return prisma.employee_door_tasks.create({ data });
  },

  createMany: (data, tx = null) => {
    const prisma = tx || prismaPublic;
    return prisma.employee_door_tasks.createMany({ data, skipDuplicates: true });
  },

  findMany: (filter) => {
    return prismaPublic.employee_door_tasks.findMany({
      where: filter,
      orderBy: { created_at: "asc" },
    });
  },

  // Для воркера: все pending задачи всех тенантов с данными тенанта
  findPending: () => {
    return prismaPublic.employee_door_tasks.findMany({
      where: { status: "pending" },
      include: { tenant: true },
      orderBy: { created_at: "asc" },
    });
  },

  update: (id, data, tx = null) => {
    const prisma = tx || prismaPublic;
    return prisma.employee_door_tasks.update({ where: { id }, data });
  },

  updateMany: (filter, data, tx = null) => {
    const prisma = tx || prismaPublic;
    return prisma.employee_door_tasks.updateMany({ where: filter, data });
  },

  deleteMany: (filter, tx = null) => {
    const prisma = tx || prismaPublic;
    return prisma.employee_door_tasks.deleteMany({ where: filter });
  },
};
