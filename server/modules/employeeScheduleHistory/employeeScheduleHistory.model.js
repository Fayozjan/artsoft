import prisma from "../../prisma/client.js";

export const EmployeeWorkScheduleHistoryModel = {
  create: async (data, tx = prisma) => {
    return tx.employee_schedule_history.create({ data });
  },

  findById: async (id) => {
    return prisma.employee_schedule_history.findUnique({
      where: { id: Number(id) },
    });
  },

  findAllByEmployeeId: async (employeeId) => {
    return prisma.employee_schedule_history.findMany({
      where: { employee_id: Number(employeeId) },
      orderBy: { date_from: "desc" },
    });
  },

  deleteById: async (id) => {
    return prisma.employee_schedule_history.delete({
      where: { id: Number(id) },
    });
  },
};
