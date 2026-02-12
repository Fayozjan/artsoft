import { buildAccessWhere } from "../../utils/accessFilter.js";
import { UserModel } from "../users/users.model.js";
import { BranchModel } from "./branches.model.js";

export const BranchService = {
  create: async (data, userId) => {
    if (!data.name) throw new Error("Name is required");
    if (!userId) throw new Error("User is required");

    const duplicate = await BranchModel.findByName(data.name);

    if (duplicate) {
      const error = new Error("Branch name already exists");
      error.code = "DUPLICATE_NAME";
      throw error;
    }

    const branchData = {
      name: data.name,
      region: data.region || null,
      address: data.address || null,
      bank_name: data.bank_name || null,
      bank_account: data.bank_account || null,
      inn: data.inn || null,
      mfo: data.mfo || null,
      status: data.status ?? true,
      addedBy: { connect: { id: Number(userId) } },
    };

    if (data.director_id) {
      branchData.director = { connect: { id: Number(data.director_id) } };
    }

    return BranchModel.create(branchData);
  },

  listActive: async ({ userId }) => {
    const user = await UserModel.getUserById(userId);
    if (!user) throw new Error("Пользователь не найден");

    const where = buildAccessWhere(user);
    const records = await BranchModel.findActive(where);

    return {
      data: records.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        departments: b.departments,
        activeEmployeesCount: b._count.employees,
      })),
    };
  },

  list: async ({ page, pageSize, filters, userId }) => {
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

    const records = await BranchModel.findMany({
      where,
      skip,
      take: limit,
    });

    const data = records.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      director: b.director
        ? `${b.director?.last_name || ""} ${b.director?.first_name || ""} ${b.director?.middle_name || ""} (${b.director?.id})`.trim()
        : "",
      address: b.address,
      region: b.region,
      bank_name: b.bank_name,
      bank_account: b.bank_account,
      inn: b.inn,
      mfo: b.mfo,
      addedBy: b.addedBy?.employee
        ? `${b.addedBy.employee.last_name || ""} ${b.addedBy.employee.first_name || ""} ${b.addedBy.employee.middle_name || ""} (${b.addedBy.employee.id})`.trim()
        : "",
      departmentsCount: b.departments?.length,
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

  getById: async (id) => {
    if (!id) throw new Error("ID is required");
    const branchId = parseInt(id, 10);
    return BranchModel.findById(branchId);
  },

  update: async (id, data) => {
    const branchId = parseInt(id, 10);
    if (isNaN(branchId)) throw new Error("Invalid branch ID");

    if (!data.name || data.name.trim() === "") {
      throw new Error("Name is required");
    }

    // Проверяем дубликат имени у других филиалов
    const duplicate = await BranchModel.findByName(data.name);
    if (duplicate && duplicate.id !== branchId) {
      const error = new Error("Branch name already exists");
      error.code = "DUPLICATE_NAME";
      throw error;
    }

    const updateData = {
      name: data.name,
      region: data.region || null,
      address: data.address || null,
      bank_name: data.bank_name || null,
      bank_account: data.bank_account || null,
      inn: data.inn || null,
      mfo: data.mfo || null,
      status: data.status ?? true,
    };

    if (data.director_id && data.director_id.trim() !== "") {
      updateData.director = {
        connect: { id: parseInt(data.director_id, 10) },
      };
    } else {
      updateData.director = {
        disconnect: true,
      };
    }

    return BranchModel.update(branchId, updateData);
  },

  remove: async (id) => {
    if (!id) throw new Error("ID is required");
    return BranchModel.delete(id);
  },

  isInUse: async (branchId) => {
    if (!branchId) throw new Error("Branch ID is required");
    return BranchModel.isBranchInUse(branchId);
  },
};
