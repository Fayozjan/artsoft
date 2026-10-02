import { PartnerCategoryModel } from "./partnerCategories.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const PartnerCategoriesService = {
  getPartnerCategories: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.name = { contains: filters.search, mode: "insensitive" };
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const [categories, total] = await Promise.all([
      PartnerCategoryModel.findMany({ where, skip, take: limit }),
      PartnerCategoryModel.count(where),
    ]);

    const formatted = categories.map((c) => ({
      ...c,
      partners_count: c._count.partners,
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

  getActivePartnerCategories: async () => {
    return PartnerCategoryModel.findActive();
  },

  getPartnerCategoryById: async (id) => {
    return PartnerCategoryModel.findUnique(id);
  },

  addPartnerCategory: async ({ name, status = true }, userId) => {
    const result = await PartnerCategoryModel.create({ name, status });
    await createAuditLog({ userId, action: "create", entity: "partner_categories", recordId: result.id, newData: result });
    return result;
  },

  editPartnerCategoryById: async (id, { name, status }, userId) => {
    const old = await PartnerCategoryModel.findUnique(id);
    const result = await PartnerCategoryModel.update(id, { name, status });
    await createAuditLog({ userId, action: "update", entity: "partner_categories", recordId: id, oldData: old, newData: result });
    return result;
  },

  deletePartnerCategoryById: async (id, userId) => {
    const categoryId = parseInt(id, 10);
    const old = await PartnerCategoryModel.findUnique(categoryId);
    if (!old) return null;
    const result = await PartnerCategoryModel.delete(categoryId);
    await createAuditLog({ userId, action: "delete", entity: "partner_categories", recordId: categoryId, oldData: old });
    return result;
  },
};
