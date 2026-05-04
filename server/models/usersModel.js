import { prismaContext } from "../utils/prismaContext.js";

export const createUser = async ({
  username,
  password,
  employee_id,
  access_level,
  branches,
  departments,
  status,
  menu,
}) => {
  const prisma = prismaContext.get();
  return prisma.users.create({
    data: {
      username,
      password,
      employee_id,
      access_level,
      branches,
      departments,
      status,
      menu,
    },
  });
};

export const updateUser = async (id, data) => {
  const prisma = prismaContext.get();
  return prisma.users.update({
    where: { id: Number(id) },
    data,
  });
};

export const getUsers = async (page = 1, limit = 50) => {
  const prisma = prismaContext.get();
  const pageNumber = Math.max(parseInt(page, 10), 1);
  const limitNumber = Math.max(parseInt(limit, 10), 1);
  const skip = (pageNumber - 1) * limitNumber;

  const data = await prisma.users.findMany({
    skip,
    take: limitNumber,
    orderBy: { id: "asc" },
    include: {
      employee: true,
    },
  });

  const total = await prisma.users.count();

  return {
    data,
    pagination: {
      totalItems: total,
      currentPage: pageNumber,
      pageSize: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

export const getUserById = async (id) => {
  const prisma = prismaContext.get();
  return prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      employee_id: true,
      status: true,
      access_level: true,
      branches: true,
      departments: true,
      menu: true,
    },
  });
};

export const getUserMenu = async (userId) => {
  const prisma = prismaContext.get();
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { menu: true },
  });
  return user ? user.menu : null;
};
