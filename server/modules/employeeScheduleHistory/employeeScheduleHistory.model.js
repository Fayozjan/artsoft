import { prismaContext } from "../../utils/prismaContext.js";

export const EmployeeWorkScheduleHistoryModel = {
  // Создать запись истории графика
  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employee_schedule_history.create({ data });
  },

  // Найти запись по ID
  findById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.employee_schedule_history.findUnique({
      where: { id: Number(id) },
    });
  },

  // Получить все записи по сотруднику
  findAllByEmployeeId: async (employeeId) => {
    const prisma = prismaContext.get();
    return prisma.employee_schedule_history.findMany({
      where: { employee_id: Number(employeeId) },
      orderBy: { date_from: "desc" },
    });
  },

  // Получить истории по списку сотрудников
  findByEmployeeIds: async (employeeIds) => {
    const prisma = prismaContext.get();
    return prisma.employee_schedule_history.findMany({
      where: { employee_id: { in: employeeIds.map(Number) } },
      include: { workSchedule: true },
      orderBy: { date_from: "asc" },
    });
  },

  // Удалить запись по ID
  deleteById: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employee_schedule_history.delete({
      where: { id: Number(id) },
    });
  },
};
