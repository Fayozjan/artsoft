import { StockPickingTypeModel } from "./stockPickingTypes.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

// code — определяет логику движения документа: какая сторона (src/dest)
// виртуальная (поставщик/клиент/цех/расходы), какая — физический склад.
export const PICKING_TYPE_CODES = ["incoming", "outgoing", "internal"];

const trim = (value, max) =>
  typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;

const toInt = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
};

const buildData = ({ name, code, sequence_prefix, default_location_src_id, default_location_dest_id, status }) => {
  const trimmedName = trim(name, 255);
  const trimmedPrefix = trim(sequence_prefix, 20)?.toUpperCase() ?? null;

  if (!trimmedName) {
    const err = new Error("Не заполнено название типа документа");
    err.code = "NAME_REQUIRED";
    throw err;
  }
  if (!PICKING_TYPE_CODES.includes(code)) {
    const err = new Error("Некорректная логика типа документа");
    err.code = "INVALID_CODE";
    throw err;
  }
  if (!trimmedPrefix) {
    const err = new Error("Не заполнен префикс номера документа");
    err.code = "PREFIX_REQUIRED";
    throw err;
  }

  return {
    name: trimmedName,
    code,
    sequence_prefix: trimmedPrefix,
    default_location_src_id: toInt(default_location_src_id),
    default_location_dest_id: toInt(default_location_dest_id),
    ...(status !== undefined ? { status: status === true || status === "true" } : {}),
  };
};

export const StockPickingTypesService = {
  getAll: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { sequence_prefix: { contains: filters.search, mode: "insensitive" } },
      ];
    if (filters.code) where.code = filters.code;
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const [data, total] = await Promise.all([
      StockPickingTypeModel.findMany({ where, skip, take: limit }),
      StockPickingTypeModel.count(where),
    ]);

    return {
      data,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getActive: async () => StockPickingTypeModel.findActive(),

  getById: async (id) => StockPickingTypeModel.findUnique(id),

  create: async (body, userId) => {
    const data = buildData(body);
    const result = await StockPickingTypeModel.create(data);
    await createAuditLog({ userId, action: "create", entity: "stock_picking_types", recordId: result.id, newData: result });
    return result;
  },

  update: async (id, body, userId) => {
    const old = await StockPickingTypeModel.findUnique(id);
    if (!old) return null;

    const data = buildData({ ...old, ...body });
    const result = await StockPickingTypeModel.update(id, data);
    await createAuditLog({ userId, action: "update", entity: "stock_picking_types", recordId: id, oldData: old, newData: result });
    return result;
  },

  remove: async (id, userId) => {
    const old = await StockPickingTypeModel.findUnique(id);
    if (!old) return null;
    const result = await StockPickingTypeModel.delete(id);
    await createAuditLog({ userId, action: "delete", entity: "stock_picking_types", recordId: id, oldData: old });
    return result;
  },
};
