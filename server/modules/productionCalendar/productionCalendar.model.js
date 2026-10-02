import { prismaContext } from "../../utils/prismaContext.js";

// Переопределения дней в диапазоне [start, end] (обе границы включительно)
export async function getDaysInRange(start, end) {
  const prisma = prismaContext.get();

  return prisma.production_calendar.findMany({
    where: {
      date: {
        gte: new Date(start),
        lte: new Date(end),
      },
    },
    orderBy: { date: "asc" },
  });
}

// То же, но с автором изменения — для таблицы/истории на странице
export async function getDaysInRangeWithAuthor(start, end) {
  const prisma = prismaContext.get();

  return prisma.production_calendar.findMany({
    where: {
      date: {
        gte: new Date(start),
        lte: new Date(end),
      },
    },
    orderBy: { date: "asc" },
    include: {
      addedBy: {
        select: {
          id: true,
          username: true,
          employee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              middle_name: true,
              photo: true,
            },
          },
        },
      },
    },
  });
}

export async function getDayByDate(date) {
  const prisma = prismaContext.get();

  return prisma.production_calendar.findUnique({
    where: { date: new Date(date) },
  });
}

// Upsert по дате — день либо создаётся, либо переопределяется
export async function upsertDay({ date, day_type, name, short_minutes, added_by }, tx = null) {
  const prisma = tx || prismaContext.get();

  return prisma.production_calendar.upsert({
    where: { date: new Date(date) },
    update: { day_type, name, short_minutes, added_by },
    create: { date: new Date(date), day_type, name, short_minutes, added_by },
  });
}

// Удаление переопределения — день возвращается к правилу по умолчанию
export async function deleteDays(dates, tx = null) {
  const prisma = tx || prismaContext.get();

  return prisma.production_calendar.deleteMany({
    where: { date: { in: dates.map((d) => new Date(d)) } },
  });
}

export async function deleteYear(year, tx = null) {
  const prisma = tx || prismaContext.get();

  return prisma.production_calendar.deleteMany({
    where: {
      date: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lte: new Date(Date.UTC(year, 11, 31)),
      },
    },
  });
}
