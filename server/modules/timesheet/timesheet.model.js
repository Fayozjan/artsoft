import { prismaContext } from "../../utils/prismaContext.js";
import { startOfMonth, endOfMonth } from "date-fns";

// Получить праздники на конкретную дату
export async function getHolidays(dateString) {
  const prisma = prismaContext.get();

  const start = startOfMonth(new Date(dateString));
  const end = endOfMonth(new Date(dateString));

  return prisma.holidays.findMany({
    where: {
      OR: [
        {
          // Holiday starts within the month
          date_from: { gte: start, lte: end },
        },
        {
          // Holiday ends within the month
          date_to: { gte: start, lte: end },
        },
        {
          // Holiday spans across the entire month
          AND: [{ date_from: { lte: start } }, { date_to: { gte: end } }],
        },
      ],
    },
    orderBy: { date_from: "asc" },
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
