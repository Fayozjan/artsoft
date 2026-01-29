import prisma from "../../prisma/client.js";

export async function getHolidays({ where }) {
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
  return prisma.holidays.findUnique({ where: { id: Number(id) } });
}

// Создать праздник
export async function createHoliday(data) {
  return prisma.holidays.create({
    data,
  });
}

// Обновить праздник
export async function updateHoliday(id, data) {
  return prisma.holidays.update({
    where: { id: Number(id) },
    data,
  });
}

// Удалить праздник
export async function deleteHoliday(id) {
  return prisma.holidays.delete({
    where: { id: Number(id) },
  });
}
