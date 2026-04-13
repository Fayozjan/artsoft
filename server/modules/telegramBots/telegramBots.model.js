import { prismaContext } from "../../utils/prismaContext.js";

// Получение телеграм-ботов с фильтром и пагинацией
export async function getBots(page, limit, filters) {
  const prisma = prismaContext.get();

  const currentPage = Math.max(parseInt(page) || 1, 1);
  const pageSize = Math.max(parseInt(limit) || 50, 1);
  const skip = (currentPage - 1) * pageSize;

  const where = {};
  const { search, status } = filters || {};

  if (search) {
    const searchValue = search.toString();
    where.OR = [
      { id: { equals: parseInt(searchValue) || 0 } },
      { name: { contains: searchValue, mode: "insensitive" } },
      { chat_id: { contains: searchValue, mode: "insensitive" } },
    ];
  }

  if (status !== undefined && status !== "") {
    where.status = status === "true";
  }

  const [data, total] = await Promise.all([
    prisma.telegram_bots.findMany({
      skip,
      take: pageSize,
      where,
      orderBy: { name: "asc" },
    }),
    prisma.telegram_bots.count({ where }),
  ]);

  return {
    data,
    pagination: {
      totalItems: total,
      currentPage,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// Получить бота по ID
export async function getBotById(id) {
  const prisma = prismaContext.get();
  return prisma.telegram_bots.findUnique({
    where: { id: Number(id) },
  });
}

// Создать бота
export async function createBot(data, tx = null) {
  const prisma = tx || prismaContext.get();
  return prisma.telegram_bots.create({ data });
}

// Обновить бота
export async function updateBot(id, data, tx = null) {
  const prisma = tx || prismaContext.get();
  return prisma.telegram_bots.update({
    where: { id: Number(id) },
    data,
  });
}

// Модель для специфичных выборок
export const telegramBotsModel = {
  getEventAlertBots: async () => {
    const prisma = prismaContext.get();

    try {
      return await prisma.telegram_bots.findMany({
        where: {
          status: true,
          receive_event_alerts: true,
        },
        select: {
          chat_id: true,
          selectedEmployeeIds: true,
        },
      });
    } catch (err) {
      console.error("Ошибка при получении телеграм ботов из модели:", err);
      throw err;
    }
  },
};
