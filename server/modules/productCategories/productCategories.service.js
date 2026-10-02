import { ProductCategoryModel } from "./productCategories.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const ProductCategoriesService = {
  getProductCategories: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.name = { contains: filters.search, mode: "insensitive" };
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";
    if (filters.parent_id !== undefined && filters.parent_id !== "")
      where.parent_id = filters.parent_id === "null" ? null : Number(filters.parent_id);

    const [categories, total] = await Promise.all([
      ProductCategoryModel.findMany({ where, skip, take: limit }),
      ProductCategoryModel.count(where),
    ]);

    const formatted = categories.map((c) => ({
      ...c,
      products_count: c._count.products,
      children_count: c._count.children,
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

  getActiveProductCategories: async () => {
    return ProductCategoryModel.findActive();
  },

  getProductCategoryById: async (id) => {
    return ProductCategoryModel.findUnique(id);
  },

  addProductCategory: async ({ name, parent_id, status = true }, userId) => {
    const result = await ProductCategoryModel.create({
      name,
      parent_id: parent_id ? Number(parent_id) : null,
      status,
    });
    await createAuditLog({ userId, action: "create", entity: "product_categories", recordId: result.id, newData: result });
    return result;
  },

  editProductCategoryById: async (id, { name, parent_id, status }, userId) => {
    const old = await ProductCategoryModel.findUnique(id);
    if (parent_id !== undefined && parent_id !== null && Number(parent_id) === Number(id)) {
      throw new Error("Категория не может быть родителем самой себе");
    }
    const result = await ProductCategoryModel.update(id, {
      name,
      parent_id: parent_id ? Number(parent_id) : null,
      status: status !== undefined ? status === true || status === "true" : undefined,
    });
    await createAuditLog({ userId, action: "update", entity: "product_categories", recordId: id, oldData: old, newData: result });
    return result;
  },

  deleteProductCategoryById: async (id, userId) => {
    const categoryId = parseInt(id, 10);
    const old = await ProductCategoryModel.findUnique(categoryId);
    if (!old) return null;
    const result = await ProductCategoryModel.delete(categoryId);
    await createAuditLog({ userId, action: "delete", entity: "product_categories", recordId: categoryId, oldData: old });
    return result;
  },
};
