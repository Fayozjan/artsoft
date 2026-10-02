import { UnitModel } from "./units.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const UnitsService = {
  getUnits: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.name = { contains: filters.search, mode: "insensitive" };
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const [units, total] = await Promise.all([
      UnitModel.findMany({ where, skip, take: limit }),
      UnitModel.count(where),
    ]);

    const formatted = units.map((u) => ({
      ...u,
      products_count: u._count.products,
    }));

    return {
      data: formatted,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getActiveUnits: async () => {
    return UnitModel.findActive();
  },

  getUnitById: async (id) => {
    return UnitModel.findUnique(id);
  },

  addUnit: async ({ name, short_name, status = true }, userId) => {
    const result = await UnitModel.create({
      name,
      short_name: short_name || null,
      status,
    });
    await createAuditLog({ userId, action: "create", entity: "units", recordId: result.id, newData: result });
    return result;
  },

  editUnitById: async (id, { name, short_name, status }, userId) => {
    const old = await UnitModel.findUnique(id);
    const result = await UnitModel.update(id, {
      name,
      short_name: short_name || null,
      status,
    });
    await createAuditLog({ userId, action: "update", entity: "units", recordId: id, oldData: old, newData: result });
    return result;
  },

  deleteUnitById: async (id, userId) => {
    const unitId = parseInt(id, 10);
    const old = await UnitModel.findUnique(unitId);
    if (!old) return null;
    const result = await UnitModel.delete(unitId);
    await createAuditLog({ userId, action: "delete", entity: "units", recordId: unitId, oldData: old });
    return result;
  },
};
