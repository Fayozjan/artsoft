import prisma from "../../prisma/client.js";
import { buildAccessWhere } from "../../utils/accessFilter.js";

export async function getBranches({ userId, page, pageSize, filters }) {
  const limit = pageSize ? parseInt(pageSize, 10) : null;
  const currentPage = Math.max(parseInt(page || 1, 10), 1);
  const skip = limit ? (currentPage - 1) * limit : undefined;

  const user = await prisma.users.findUnique({
    where: { id: Number(userId) },
    select: {
      access_level: true,
      branches: true,
      departments: true,
    },
  });

  if (!user) throw new Error("Пользователь не найден");

  const where = buildAccessWhere(user);

  const { search, status } = filters || {};

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  if (status !== undefined && status !== "") {
    where.status = status === "true";
  }

  const records = await prisma.branches.findMany({
    where,
    include: {
      departments: { include: { _count: { select: { employees: true } } } },
    },
    skip,
    take: limit,
    orderBy: { name: "asc" },
  });

  const data = records.map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status,
    departments_count: b.departments.length,
    employees_count: b.departments.reduce(
      (sum, d) => sum + (d._count.employees || 0),
      0,
    ),
  }));

  const totalItems = await prisma.branches.count({ where });

  return {
    data,
    pagination: {
      totalItems,
      currentPage,
      pageSize: limit,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
}

export function findActiveBranches(where) {
  return prisma.branches.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      departments: {
        where: { status: true },
        select: { id: true, name: true },
      },
      _count: {
        select: {
          employees: {
            where: { status: true },
          },
        },
      },
    },
  });
}

export const getBranchById = async (id) => {
  return prisma.branches.findUnique({
    where: { id: Number(id) },
    select: {
      name: true,
      status: true,
    },
  });
};

export const createBranch = async (data) => {
  return prisma.branches.create({ data });
};

export const editBranchById = async (id, data) => {
  try {
    return prisma.branches.update({
      where: { id: Number(id) },
      data,
    });
  } catch {
    return null;
  }
};

export const deleteBranchById = async (id) => {
  try {
    return prisma.branches.delete({
      where: { id: Number(id) },
    });
  } catch {
    return null;
  }
};

export const isBranchInUse = async (id) => {
  const depCount = await prisma.departments.count({
    where: { branch_id: Number(id) },
  });
  const empCount = await prisma.employees.count({
    where: { branch_id: Number(id) },
  });
  return depCount + empCount > 0;
};

export const BranchModel = {
  create: async (data) => {
    return prisma.branches.create({
      data: {
        name: data.name,
        director_id: data.director_id || null,
        status: data.status ?? true,
      },
    });
  },

  findAll: async () => {
    return prisma.branches.findMany({
      include: {
        director: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
          },
        },
        addedBy: {
          select: {
            id: true,
            employee: {
              select: {
                first_name: true,
                last_name: true,
                middle_name: true,
              },
            },
          },
        },
      },
    });
  },

  findMany({ where, skip, take }) {
    return prisma.branches.findMany({
      where,
      include: {
        director: true,
        departments: {
          include: {
            _count: { select: { employees: true } },
          },
        },
        addedBy: {
          select: {
            id: true,
            employee: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                middle_name: true,
              },
            },
          },
        },
      },
      skip,
      take,
      orderBy: { name: "asc" },
    });
  },

  findByName(name) {
    return prisma.branches.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
      },
    });
  },

  findById: async (id) => {
    return prisma.branches.findUnique({
      where: { id },
      include: { director: true },
    });
  },

  count(where) {
    return prisma.branches.count({ where });
  },

  update: async (id, data) => {
    return prisma.branches.update({
      where: { id },
      data: {
        name: data.name,
        director_id: data.director_id || null,
        status: data.status,
      },
    });
  },

  delete: async (id) => {
    return prisma.branches.delete({ where: { id } });
  },
};
