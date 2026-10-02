import { StockLocationModel } from "./stockLocations.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const LOCATION_TYPES = [
  "view",
  "internal",
  "supplier",
  "customer",
  "production",
  "expense",
  "inventory",
  "transit",
];

// Технический код singleton-корня "Физические склады" (см. seedStockLocations).
// Резолвится по code, не по имени/айди с клиента — исключает случай, когда
// склад при создании уедет не под тот родитель.
const PHYSICAL_ROOT_CODE = "PHYS_ROOT";

const buildCompleteName = async (name, parentId) => {
  if (!parentId) return name;
  const parent = await StockLocationModel.findUnique(parentId);
  return parent ? `${parent.complete_name} / ${name}` : name;
};

// complete_name денормализован (хранится в строке) — при переименовании или
// смене родителя пересчитываем весь путь у потомков рекурсивно.
const recalcDescendants = async (id) => {
  const children = await StockLocationModel.findChildren(id);
  for (const child of children) {
    const parent = await StockLocationModel.findUnique(id);
    const completeName = `${parent.complete_name} / ${child.name}`;
    await StockLocationModel.update(child.id, { complete_name: completeName });
    await recalcDescendants(child.id);
  }
};

export const StockLocationsService = {
  getStockLocations: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { complete_name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
      ];
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";
    if (filters.type)
      where.type = filters.type;
    if (filters.branch_id)
      where.branch_id = Number(filters.branch_id);
    if (filters.parent_id !== undefined && filters.parent_id !== "")
      where.parent_id = filters.parent_id === "null" ? null : Number(filters.parent_id);

    const [locations, total] = await Promise.all([
      StockLocationModel.findMany({ where, skip, take: limit }),
      StockLocationModel.count(where),
    ]);

    const formatted = locations.map((l) => ({
      ...l,
      children_count: l._count.children,
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

  getActiveStockLocations: async () => {
    return StockLocationModel.findActive();
  },

  getStockLocationById: async (id) => {
    return StockLocationModel.findUnique(id);
  },

  addStockLocation: async ({ name, parent_id, type, branch_id, code, note, is_scrap = false, status = true }, userId) => {
    if (!LOCATION_TYPES.includes(type)) throw new Error("Некорректный тип локации");
    status = status === true || status === "true";

    let parentId = parent_id ? Number(parent_id) : null;

    // Склад (type=internal) без явного родителя — всегда под singleton "Физические
    // склады", резолвим на сервере по code. Клиент для складов parent_id не шлёт вовсе.
    if (type === "internal" && !parentId) {
      const physicalRoot = await StockLocationModel.findByCode(PHYSICAL_ROOT_CODE);
      if (physicalRoot) parentId = physicalRoot.id;
    }

    const complete_name = await buildCompleteName(name, parentId);

    const result = await StockLocationModel.create({
      name,
      parent_id: parentId,
      complete_name,
      type,
      branch_id: branch_id ? Number(branch_id) : null,
      code: code || null,
      note: note || null,
      is_scrap,
      status,
    });
    await createAuditLog({ userId, action: "create", entity: "stock_locations", recordId: result.id, newData: result });
    return result;
  },

  editStockLocationById: async (id, { name, parent_id, type, branch_id, code, note, is_scrap, status }, userId) => {
    if (type && !LOCATION_TYPES.includes(type)) throw new Error("Некорректный тип локации");
    if (status !== undefined) status = status === true || status === "true";

    const old = await StockLocationModel.findUnique(id);
    if (!old) throw new Error("Локация не найдена");

    const parentId = parent_id ? Number(parent_id) : null;
    if (parentId === Number(id)) throw new Error("Локация не может быть родителем самой себе");

    const nameChanged = name !== undefined && name !== old.name;
    const parentChanged = parentId !== old.parent_id;
    const complete_name =
      nameChanged || parentChanged ? await buildCompleteName(name ?? old.name, parentId) : undefined;

    const result = await StockLocationModel.update(id, {
      name,
      parent_id: parentId,
      ...(complete_name !== undefined ? { complete_name } : {}),
      type,
      branch_id: branch_id ? Number(branch_id) : null,
      code: code || null,
      note: note || null,
      is_scrap,
      status,
    });

    if (nameChanged || parentChanged) await recalcDescendants(id);

    await createAuditLog({ userId, action: "update", entity: "stock_locations", recordId: id, oldData: old, newData: result });
    return result;
  },

  deleteStockLocationById: async (id, userId) => {
    const locationId = parseInt(id, 10);
    const old = await StockLocationModel.findUnique(locationId);
    if (!old) return null;
    const result = await StockLocationModel.delete(locationId);
    await createAuditLog({ userId, action: "delete", entity: "stock_locations", recordId: locationId, oldData: old });
    return result;
  },
};
