import { prismaContext } from "../../utils/prismaContext.js";

export const EmployeeDoorTasksModel = {
  // Создает одну задачу
  create: (data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employee_door_tasks.create({ data });
  },

  // Создает несколько задач, пропуская дубликаты
  createMany: (data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employee_door_tasks.createMany({
      data,
      skipDuplicates: true,
    });
  },

  // Получает задачи с фильтром, можно включить связи с сотрудником и дверью
  findMany: (filter) => {
    const prisma = prismaContext.get();
    return prisma.employee_door_tasks.findMany({
      where: filter,
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            photo: true,
          },
        },
        door: {
          select: {
            id: true,
            name: true,
            faceDevices: true,
          },
        },
      },
      orderBy: { created_at: "asc" },
    });
  },

  // Обновление одной задачи по ID
  update: (id, data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employee_door_tasks.update({
      where: { id },
      data,
    });
  },

  // Обновление нескольких задач по фильтру
  updateMany: (filter, data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employee_door_tasks.updateMany({
      where: filter,
      data,
    });
  },

  // Удаление задач по фильтру
  deleteMany: (filter, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employee_door_tasks.deleteMany({ where: filter });
  },
};
