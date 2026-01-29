import prisma from "../../prisma/client.js";
import { buildAccessWhere } from "../../utils/accessFilter.js";
import { UserModel } from "../users/users.model.js";

export async function getDepartments({ userId, page, pageSize, filters }) {
  const limit = pageSize ? parseInt(pageSize, 10) : null;
  const currentPage = Math.max(parseInt(page || 1, 10), 1);
  const skip = limit ? (currentPage - 1) * limit : undefined;

  const user = await UserModel.getUserById(userId);
  if (!user) throw new Error("Пользователь не найден");

  const { search, branch_id, status } = filters || {};

  const where = buildAccessWhere(user);

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  if (branch_id) {
    where.branch_id = Number(branch_id);
  }

  if (status !== undefined && status !== "") {
    where.status = status === "true";
  }

  const records = await prisma.departments.findMany({
    where,
    include: {
      branch: true,
      _count: { select: { employees: true } },
    },
    skip,
    take: limit,
    orderBy: { name: "asc" },
  });

  const data = records.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    branch: d.branch,
    employees_count: d._count.employees,
  }));

  const totalItems = await prisma.departments.count({ where });

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

export async function getActiveDepartments({ userId }) {
  const user = await UserModel.getUserById(userId);
  if (!user) throw new Error("Пользователь не найден");

  const where = buildAccessWhere(user);

  where.status = true;

  const records = await prisma.departments.findMany({
    where,
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = records.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    branch_id: d.branch_id,
    branch: d.branch?.name || null,
  }));

  return { data, pagination: null };
}

export function findActiveDepartments(where) {
  return prisma.departments.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
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

export const getDepartmentById = async (id) => {
  return prisma.departments.findUnique({
    where: { id: Number(id) },
    select: { name: true, branch_id: true, status: true },
  });
};

export const createDepartment = async (data) => {
  return prisma.departments.create({ data });
};

export const editDepartment = async (id, data) => {
  return prisma.departments.update({
    where: { id: Number(id) },
    data,
  });
};

export const deleteDepartment = async (id) => {
  const count = await prisma.employees.count({
    where: { department_id: Number(id) },
  });
  if (count > 0) throw new Error("Невозможно удалить отдел с сотрудниками");

  return prisma.departments.delete({ where: { id: Number(id) } });
};
