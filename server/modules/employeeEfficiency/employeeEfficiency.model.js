import { prismaContext } from "../../utils/prismaContext.js";

// Выборки для расчёта эффективности. Всё сужено до одного сотрудника —
// сервисы посещаемости работают со списками и тянут лишнее.
export const EmployeeEfficiencyModel = {
  // Сотрудник + история графиков в форме, которую ждёт generateAttendanceReport
  getEmployeeWithSchedule: async (employeeId) => {
    const prisma = prismaContext.get();
    const id = Number(employeeId);

    const [employee, scheduleHistory] = await Promise.all([
      prisma.employees.findUnique({
        where: { id },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          middle_name: true,
          employee_number: true,
          photo: true,
          pinfl: true,
          status: true,
          added_at: true,
          branch: { select: { name: true } },
          department: { select: { name: true } },
          position: { select: { name: true } },
          workSchedule: { select: { id: true, name: true, type: true } },
        },
      }),

      prisma.employee_schedule_history.findMany({
        where: { employee_id: id },
        include: { workSchedule: true },
        orderBy: { date_from: "asc" },
      }),
    ]);

    if (!employee) return null;

    return { employee, scheduleHistory };
  },

  // Дата приёма — по самому раннему приказу типа hire, иначе создание записи
  getHireDate: async (employeeId) => {
    const prisma = prismaContext.get();

    const order = await prisma.employment_orders.findFirst({
      where: { employee_id: Number(employeeId), type: "hire", date: { not: null } },
      orderBy: { date: "asc" },
      select: { date: true },
    });

    return order?.date ?? null;
  },

  getFacePasses: async (employeeId, from, to) => {
    const prisma = prismaContext.get();

    return prisma.face_passes.findMany({
      where: {
        employee_id: Number(employeeId),
        date: { gte: from, lte: to },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        identifier: true,
        direction: true,
        door_id: true,
        photo: true,
        door: { select: { name: true } },
      },
    });
  },

  // Пересечение с диапазоном, а не вложенность — отпуск может начаться
  // до периода и закончиться внутри него
  getTimeOff: async (employeeId, from, to) => {
    const prisma = prismaContext.get();

    return prisma.time_off.findMany({
      where: {
        employee_id: Number(employeeId),
        date_from: { lte: to },
        date_to: { gte: from },
      },
      orderBy: { date_from: "asc" },
    });
  },

  getCalendarOverrides: async (from, to) => {
    const prisma = prismaContext.get();

    return prisma.production_calendar.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
  },

  // Задачи, назначенные лично сотруднику и выданные в работу внутри периода.
  // draft не считается — задача ещё не доведена до исполнителя.
  getTasks: async (employeeId, from, to) => {
    const prisma = prismaContext.get();

    return prisma.tasks.findMany({
      where: {
        assignee_employee_id: Number(employeeId),
        status: { not: "draft" },
        OR: [
          { published_at: { gte: from, lte: to } },
          { completed_at: { gte: from, lte: to } },
          { deadline: { gte: from, lte: to } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        deadline: true,
        completed_at: true,
        confirmed_at: true,
        published_at: true,
      },
      orderBy: { deadline: "asc" },
    });
  },
};
