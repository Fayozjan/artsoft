import prisma from "../../prisma/client.js";

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

export const getUsers = async (page, limit, filters = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const limitNumber = Math.max(parseInt(limit, 10) || 50, 1);
  const skip = (pageNumber - 1) * limitNumber;

  // Фильтры
  const where = {};

  const { search, status } = filters || {};

  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      {
        employee: {
          OR: [
            { first_name: { contains: search, mode: "insensitive" } },
            { last_name: { contains: search, mode: "insensitive" } },
            { middle_name: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  if (status !== undefined && status !== "") {
    where.status = status === "true";
  }

  // Получение данных
  const [data, total] = await Promise.all([
    prisma.users.findMany({
      skip,
      take: limitNumber,
      orderBy: { id: "asc" },
      where,
      select: {
        id: true,
        username: true,
        access_level: true,
        status: true,
        employee: {
          select: {
            first_name: true,
            last_name: true,
            middle_name: true,
          },
        },
      },
    }),

    prisma.users.count({ where }),
  ]);

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

export const getUserInfo = async (id) => {
  const user = await prisma.users.findUnique({
    where: { id },
    select: {
      employee: {
        select: {
          last_name: true,
          first_name: true,
          photo: true,
          position: {
            select: { name: true },
          },
        },
      },
    },
  });

  return {
    first_name: user?.employee?.first_name,
    last_name: user?.employee?.last_name,
    photo: user?.employee?.photo,
    position: user?.employee?.position?.name || undefined,
  };
};

export const UserModel = {
  getUserById: async (id) => {
    return await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        employee_id: true,
        access_level: true,
        branch_access: true,
        department_access: true,
        status: true,
      },
    });
  },

  getUserWithPasswordById: async (id) => {
    return await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
      },
    });
  },

  editUserById: async (userId, dataToUpdate, menuAccessOperations) => {
    return prisma.$transaction(async (tx) => {
      // 1. Обновляем пользователя
      const updatedUser = await tx.users.update({
        where: { id: Number(userId) },
        data: dataToUpdate,
      });

      // 2. Удаляем старые права доступа
      await tx.user_menu_access.deleteMany({
        where: { user_id: Number(userId) },
      });

      // 3. Создаем новые права доступа (если есть)
      if (menuAccessOperations.length > 0) {
        await tx.user_menu_access.createMany({
          data: menuAccessOperations,
        });
      }

      return updatedUser;
    });
  },

  findUsers: async ({
    skip = 0,
    take = 50,
    where = {},
    orderBy = { id: "asc" },
  }) => {
    const data = await prisma.users.findMany({
      skip,
      take,
      orderBy,
      where,
      select: {
        id: true,
        username: true,
        access_level: true,
        status: true,
        employee: {
          select: {
            first_name: true,
            last_name: true,
            middle_name: true,
          },
        },
      },
    });

    return data;
  },

  countUsers: async (where = {}) => {
    return prisma.users.count({ where });
  },

  getUserMenuAccesses: async (userId) => {
    return prisma.user_menu_access.findMany({
      where: { user_id: Number(userId) },
    });
  },

  updateProfile: async (userId, data) => {
    return await prisma.users.update({
      where: { id: userId },
      data,
    });
  },
};
