import { UserModel } from "../users/users.model.js";
import { buildBranchAccess } from "./branches.helpers.js";
import { BranchModel } from "./branches.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

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
      sort_order:
        data.sort_order !== undefined && data.sort_order !== ""
          ? parseInt(data.sort_order, 10)
          : 0,
      addedBy: { connect: { id: Number(userId) } },
    };

    if (data.director_id) {
      branchData.director = { connect: { id: Number(data.director_id) } };
    }

    const result = await BranchModel.create(branchData);
    await createAuditLog({ userId, action: "create", entity: "branches", recordId: result.id, newData: result });
    return result;
  },

  listActive: async ({ userId }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const where = buildBranchAccess(user);
    const records = await BranchModel.findActive(where);

    return {
      data: records.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        status: b.status,
        sort_order: b.sort_order,
        departments: b.departments,
        activeEmployeesCount: b._count.employees,
      })),
    };
  },

  list: async ({ page, pageSize, filters, userId }) => {
    const limit = pageSize ? parseInt(pageSize, 10) : undefined;
    const currentPage = Math.max(parseInt(page || 1, 10), 1);
    const skip = limit ? (currentPage - 1) * limit : undefined;

    const user = await UserModel.getById(Number(userId));

    if (!user) throw new Error("Пользователь не найден");

    const where = buildBranchAccess(user);

    const { search, status } = filters || {};
    if (search) where.name = { contains: search, mode: "insensitive" };
    if (status !== undefined && status !== "") where.status = status === "true";

    const records = await BranchModel.findMany({ where, skip, take: limit });
    const data = records.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      director: b.director
        ? `${b.director.last_name || ""} ${b.director.first_name || ""} ${b.director.middle_name || ""}`.trim()
        : "",
      address: b.address,
      region: b.region,
      bank_name: b.bank_name,
      bank_account: b.bank_account,
      inn: b.inn,
      mfo: b.mfo,
      sort_order: b.sort_order,
      addedBy: b.addedBy?.employee
        ? `${b.addedBy.employee.last_name || ""} ${b.addedBy.employee.first_name || ""}`.trim()
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

  getById: async (id) => BranchModel.findById(parseInt(id, 10)),

  update: async (id, data, userId) => {
    const branchId = parseInt(id, 10);
    if (isNaN(branchId)) throw new Error("Invalid branch ID");
    if (!data.name || data.name.trim() === "")
      throw new Error("Name is required");

    const duplicate = await BranchModel.findByName(data.name);
    if (duplicate && duplicate.id !== branchId) {
      const error = new Error("Branch name already exists");
      error.code = "DUPLICATE_NAME";
      throw error;
    }

    const old = await BranchModel.findById(branchId);

    const updateData = {
      name: data.name,
      region: data.region || null,
      address: data.address || null,
      bank_name: data.bank_name || null,
      bank_account: data.bank_account || null,
      inn: data.inn || null,
      mfo: data.mfo || null,
      status: data.status ?? true,
      sort_order:
        data.sort_order !== undefined && data.sort_order !== ""
          ? parseInt(data.sort_order, 10)
          : 0,
    };

    if (data.director_id && data.director_id.trim() !== "") {
      updateData.director = { connect: { id: parseInt(data.director_id, 10) } };
    } else {
      updateData.director = { disconnect: true };
    }

    const result = await BranchModel.update(branchId, updateData);
    await createAuditLog({ userId, action: "update", entity: "branches", recordId: branchId, oldData: old, newData: result });
    return result;
  },

  remove: async (id, userId) => {
    const branchId = parseInt(id, 10);
    const old = await BranchModel.findById(branchId);
    const result = await BranchModel.delete(branchId);
    await createAuditLog({ userId, action: "delete", entity: "branches", recordId: branchId, oldData: old });
    return result;
  },

  isInUse: async (branchId) =>
    BranchModel.isBranchInUse(parseInt(branchId, 10)),
};
