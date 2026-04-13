import { prismaContext } from "../../utils/prismaContext.js";

// Получить праздники на конкретную дату
export async function getHolidays(date) {
  const prisma = prismaContext.get();

  return prisma.holidays.findMany({
    where: {
      date_from: { lte: new Date(date) },
      date_to: { gte: new Date(date) },
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
