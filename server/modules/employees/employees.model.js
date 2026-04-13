import { prismaContext } from "../../utils/prismaContext.js";
import dotenv from "dotenv";
import { parseDateOnly } from "./employee.helpers.js";

dotenv.config();

export async function addEmployeeRaw(body) {
  const prisma = prismaContext.get();

  const { id, first_name, branch_id, status } = body;

  await prisma.$executeRaw`
    INSERT INTO employees (id, first_name, branch_id, status)
    VALUES (${id}, ${first_name}, ${branch_id}, ${status})
  `;
}

export const EmployeeModel = {
  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employees.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();

    return prisma.employees.update({
      where: { id: Number(id) },
      data,
    });
  },

  getAll: async (where = {}, skip = 0, take = 50) => {
    const prisma = prismaContext.get();

    const [data, total] = await Promise.all([
      prisma.employees.findMany({
        where,
        skip,
        take,
        orderBy: { last_name: "asc" },
        include: {
          branch: true,
          department: true,
          position: true,
          workSchedule: true,
        },
      }),
      prisma.employees.count({ where }),
    ]);

    return { data, total };
  },

  getById: async (id) => {
    const prisma = prismaContext.get();

    return prisma.employees.findUnique({
      where: { id: Number(id) },
      include: {
        branch: true,
        department: true,
        position: true,
        employmentOrders: true,
        employeeScheduleHistory: {
          orderBy: { date_from: "asc" },
          include: {
            workSchedule: true,
            addedBy: {
              select: {
                id: true,
                employee: {
                  select: {
                    first_name: true,
                    last_name: true,
                    middle_name: true,
                  },
                },
              },
            },
          },
        },
        doors: {
          include: { faceDevices: true },
        },
      },
    });
  },

  getActive: async (where) => {
    const prisma = prismaContext.get();

    return prisma.employees.findMany({
      where,
      orderBy: { last_name: "asc" },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        middle_name: true,
        employee_number: true,
        photo: true,
        branch: { select: { name: true } },
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    });
  },

  getAllIds: async () => {
    const prisma = prismaContext.get();

    try {
      const employees = await prisma.employees.findMany({
        select: { id: true },
      });

      return employees.map((emp) => emp.id);
    } catch (err) {
      console.error("Ошибка при получении всех ID сотрудников:", err);
      throw err;
    }
  },

  getCurrentWorkSchedule: async (employeeId) => {
    const prisma = prismaContext.get();

    return prisma.employees.findUnique({
      where: { id: Number(employeeId) },
      select: {
        work_schedule_id: true,
        workSchedule: true,
      },
    });
  },

  updateWorkSchedule: async (
    employeeId,
    newScheduleId,
    userId,
    workScheduleStartDate,
  ) => {
    const prisma = prismaContext.get();

    const startDate = parseDateOnly(workScheduleStartDate);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() - 1);

    return prisma.$transaction(async (tx) => {
      const histories = await tx.employee_schedule_history.findMany({
        where: {
          employee_id: employeeId,
          OR: [{ date_to: null }, { date_to: { gte: startDate } }],
        },
        orderBy: { date_from: "asc" },
      });

      for (const h of histories) {
        if (h.date_to && h.date_to < startDate) continue;

        if (h.date_from < startDate && (!h.date_to || h.date_to >= startDate)) {
          await tx.employee_schedule_history.update({
            where: { id: h.id },
            data: { date_to: endDate },
          });
        } else if (h.date_from >= startDate) {
          await tx.employee_schedule_history.delete({
            where: { id: h.id },
          });
        }
      }

      return tx.employee_schedule_history.create({
        data: {
          employee_id: employeeId,
          work_schedule_id: newScheduleId,
          date_from: startDate,
          added_by: userId,
        },
      });
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();

    return prisma.employees.delete({
      where: { id: Number(id) },
    });
  },
};
