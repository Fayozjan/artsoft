import { buildAccessWhere } from "../../utils/accessFilter.js";
import { UserModel } from "../users/users.model.js";
import { findActiveBranches, BranchModel } from "./branches.model.js";

export async function getActiveBranchesService({ userId }) {
  const user = await UserModel.getUserById(userId);
  if (!user) throw new Error("Пользователь не найден");

  const where = buildAccessWhere(user);
  const records = await findActiveBranches(where);

  return {
    data: records.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      departments: b.departments,
      activeEmployeesCount: b._count.employees,
    })),
  };
}

export const BranchService = {
  createBranch: async (data, userId) => {
    if (!data.name) throw new Error("Name is required");
    if (!userId) throw new Error("User is required");

    const directorId =
      data.director_id && data.director_id.trim() !== ""
        ? parseInt(data.director_id, 10)
        : null;

    const duplicate = await BranchModel.findByName(data.name);
    if (duplicate) {
      const error = new Error("Branch name already exists");
      error.code = "DUPLICATE_NAME";
      throw error;
    }

    return BranchModel.create({
      name: data.name,
      director_id: directorId,
      status: data.status ?? true,
      creator_id: Number(userId),
    });
  },

  getBranches: async ({ page, pageSize, filters, userId }) => {
    const limit = pageSize ? parseInt(pageSize, 10) : undefined;
    const currentPage = Math.max(parseInt(page || 1, 10), 1);
    const skip = limit ? (currentPage - 1) * limit : undefined;

    // 🔐 доступ пользователя
    const user = await UserModel.getUserById(userId);
    if (!user) throw new Error("Пользователь не найден");

    // 🧠 условия доступа
    const where = buildAccessWhere(user);

    // 🔍 фильтры
    const { search, status } = filters || {};

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    if (status !== undefined && status !== "") {
      where.status = status === "true";
    }

    // 📦 данные
    const records = await BranchModel.findMany({
      where,
      skip,
      take: limit,
    });

    // 🎯 маппинг под фронт
    const data = records.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      director: b.director
        ? `${b.director.last_name || ""} ${b.director.first_name || ""} ${b.director.middle_name || ""} (${b.director.id})`.trim()
        : "",
      addedBy: b.addedBy
        ? `${b.addedBy.employee.last_name || ""} ${b.addedBy.employee.first_name || ""} ${b.addedBy.employee.middle_name || ""} (${b.addedBy.employee.id})`.trim()
        : "",
      departmentsCount: b.departments.length,
      employeesCount: b.departments.reduce(
        (sum, d) => sum + (d._count.employees || 0),
        0,
      ),
    }));

    const totalItems = await BranchModel.count(where);

    return {
      data,
      pagination: {
        totalItems,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(totalItems / (limit || totalItems)),
      },
    };
  },

  getBranchById: async (id) => {
    if (!id) throw new Error("ID is required");
    const branchId = parseInt(id, 10);
    return BranchModel.findById(branchId);
  },

  updateBranch: async (id, data) => {
    const branchId = parseInt(id, 10);
    if (isNaN(branchId)) throw new Error("Invalid branch ID");

    if (!data.name || data.name.trim() === "") {
      throw new Error("Name is required");
    }

    // Преобразуем director_id в число или null
    const directorId =
      data.director_id && data.director_id.trim() !== ""
        ? parseInt(data.director_id, 10)
        : null;

    // Проверяем дубликат имени у других филиалов
    const duplicate = await BranchModel.findByName(data.name);
    if (duplicate && duplicate.id !== branchId) {
      const error = new Error("Branch name already exists");
      error.code = "DUPLICATE_NAME";
      throw error;
    }

    return BranchModel.update(branchId, {
      name: data.name,
      director_id: directorId,
      status: data.status ?? true,
    });
  },

  deleteBranch: async (id) => {
    if (!id) throw new Error("ID is required");
    return BranchModel.delete(id);
  },
};
