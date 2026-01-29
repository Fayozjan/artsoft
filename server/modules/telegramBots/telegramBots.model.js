import prisma from "../../prisma/client.js";

export async function getBots(page, limit, filters) {
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

export async function getBotById(id) {
  return prisma.telegram_bots.findUnique({
    where: { id: Number(id) },
  });
}

export async function createBot(data) {
  return prisma.telegram_bots.create({ data });
}

export async function updateBot(id, data) {
  return prisma.telegram_bots.update({
    where: { id: Number(id) },
    data,
  });
}
