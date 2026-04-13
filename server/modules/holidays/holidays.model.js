import { prismaContext } from "../../utils/prismaContext.js";

// Получить список праздников
export async function getHolidays({ where }) {
  const prisma = prismaContext.get();

  return prisma.holidays.findMany({
    where,
    orderBy: { date_from: "asc" },
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

// Получить праздник по ID
export async function getHolidayById(id) {
  const prisma = prismaContext.get();

  return prisma.holidays.findUnique({
    where: { id: Number(id) },
  });
}

// Создать праздник
export async function createHoliday(data, tx = null) {
  const prisma = tx || prismaContext.get();

  return prisma.holidays.create({ data });
}

// Обновить праздник
export async function updateHoliday(id, data, tx = null) {
  const prisma = tx || prismaContext.get();

  return prisma.holidays.update({
    where: { id: Number(id) },
    data,
  });
}

// Удалить праздник
export async function deleteHoliday(id, tx = null) {
  const prisma = tx || prismaContext.get();

  return prisma.holidays.delete({
    where: { id: Number(id) },
  });
}
