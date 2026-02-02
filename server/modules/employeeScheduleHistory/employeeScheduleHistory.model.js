import prisma from "../../prisma/client.js";

export const EmployeeWorkScheduleHistoryModel = {
  findById: async (id) => {
    return prisma.employee_schedule_history.findUnique({
      where: { id: Number(id) },
    });
  },

  deleteById: async (id) => {
    return prisma.employee_schedule_history.delete({
      where: { id: Number(id) },
    });
  },

  // Можно добавить другие методы для работы с историей
  findAllByEmployeeId: async (employeeId) => {
    return prisma.employee_schedule_history.findMany({
      where: { employee_id: Number(employeeId) },
      orderBy: { date_from: "desc" },
    });
  },
};
