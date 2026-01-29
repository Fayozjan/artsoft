import prisma from "../../prisma/client.js";

export async function getDoors(page, limit, filters = {}) {
  const currentPage = Math.max(parseInt(page) || 1, 1);
  const pageSize = Math.max(parseInt(limit) || 50, 1);
  const skip = (currentPage - 1) * pageSize;

  const where = {};

  const { search, status } = filters || {};

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  if (status !== undefined && status !== "") {
    where.status = status === "true";
  }

  const [doors, total] = await Promise.all([
    prisma.doors.findMany({
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      where,
      include: {
        _count: {
          select: { employees: true },
        },
      },
    }),
    prisma.doors.count({
      where,
    }),
  ]);

  const doorsWithCounts = doors.map((door) => ({
    ...door,
    employeesCount: door._count.employees,
  }));

  return {
    data: doorsWithCounts,
    pagination: {
      totalItems: total,
      currentPage: currentPage,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getActiveDoors() {
  return prisma.doors.findMany({
    where: { status: true },
    orderBy: { name: "asc" },
  });
}

export async function getDoorById(id) {
  return prisma.doors.findUnique({
    where: { id: Number(id) },
    include: { employees: true },
  });
}

export async function createDoor(data) {
  return prisma.doors.create({ data });
}

export const updateDoor = async (id, data) => {
  return prisma.doors.update({
    where: { id: Number(id) },
    data,
  });
};
