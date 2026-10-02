import { prismaContext } from "../../utils/prismaContext.js";
import { startOfMonth, endOfMonth } from "date-fns";

// Переопределения производственного календаря за месяц указанной даты
export async function getCalendarOverrides(dateString) {
  const prisma = prismaContext.get();

  const start = startOfMonth(new Date(dateString));
  const end = endOfMonth(new Date(dateString));

  return prisma.production_calendar.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
}

// Получить проходы сотрудников за диапазон месяца
export async function getEmployeeFacePassesByMonthRange({
  startOfMonth,
  endOfMonth,
  employeeIds,
}) {
  if (!employeeIds?.length) throw new Error("Нет пользователей для выборки");

  const prisma = prismaContext.get();

  const where = {
    employee_id: { in: employeeIds.map(Number) },
  };

  if (startOfMonth && endOfMonth) {
    where.event_time = {
      gte: new Date(startOfMonth),
      lte: new Date(endOfMonth),
    };
  }

  const records = await prisma.face_passes.findMany({
    where,
    orderBy: { event_time: "asc" },
    include: {
      employee: {
        include: {
          branch: true,
          department: true,
          position: true,
          work_schedule: true,
        },
      },
    },
  });

  return { data: records };
}
