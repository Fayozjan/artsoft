import { UserModel } from "../users/users.model.js";
import { buildDepartmentAccess } from "./departments.helpers.js";
import { DepartmentsModel } from "./departments.model.js";

export const DepartmentsService = {
  getDepartments: async ({ userId, page = 1, pageSize = 20, filters }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const where = buildDepartmentAccess(user);

    if (filters?.search)
      where.name = { contains: filters.search, mode: "insensitive" };
    if (filters?.branch_id) where.branch_id = Number(filters.branch_id);
    if (filters?.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const skip = (page - 1) * pageSize;

    const records = await DepartmentsModel.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        branch: true,
        _count: { select: { employees: true } },
      },
    });

    const totalItems = await DepartmentsModel.count(where);

    const data = records.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      branch: d.branch,
      employees_count: d._count.employees,
    }));

    return {
      data,
      pagination: {
        totalItems,
        currentPage: page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },

  getActiveDepartments: async ({ userId }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const where = buildDepartmentAccess(user);
    where.status = true;

    const records = await DepartmentsModel.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { employees: { where: { status: true } } } },
      },
    });

    const data = records.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      branchId: d.branch_id,
      branchName: d.branch?.name || null,
      activeEmployeesCount: d._count.employees,
    }));

    return { data };
  },

  getDepartmentById: async (id) => {
    return DepartmentsModel.findUnique(id);
  },

  createDepartment: async (data) => {
    return DepartmentsModel.create(data);
  },

  editDepartment: async (id, data) => {
    return DepartmentsModel.update(id, data);
  },

  deleteDepartment: async (id) => {
    return DepartmentsModel.delete(id);
  },
};
