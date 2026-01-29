import prisma from "../../prisma/client.js";

export async function getPositions({ page, limit, filters = {} }) {
  const currentPage = Math.max(parseInt(page) || 1, 1);
  const pageSize = Math.max(parseInt(limit) || 50, 1);
  const skip = (currentPage - 1) * pageSize;

  // Формируем объект фильтрации
  const where = {};

  const { search, status } = filters || {};

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  if (status !== undefined && status !== "") {
    where.status = status === "true";
  }

  // Параллельные запросы
  const [positions, total] = await Promise.all([
    prisma.positions.findMany({
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      where,
      include: {
        _count: { select: { employees: true } },
      },
    }),

    prisma.positions.count({ where }),
  ]);

  const formatted = positions.map((p) => ({
    ...p,
    employees_count: p._count.employees,
  }));

  return {
    data: formatted,
    pagination: {
      totalItems: total,
      currentPage,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getActivePositions() {
  const records = await prisma.positions.findMany({
    where: { status: true },
    orderBy: { name: "asc" },
  });

  const data = records.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
  }));

  return { data };
}

export const getPositionById = async (id) => {
  return prisma.positions.findUnique({
    where: { id: Number(id) },
    include: { employees: true },
  });
};

export const addPosition = async ({ name, status }) => {
  return prisma.positions.create({
    data: { name, status },
  });
};

export const editPositionById = async (id, { name, status }) => {
  return prisma.positions.update({
    where: { id: Number(id) },
    data: { name, status },
  });
};
