import { ProductModel } from "./products.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const ProductsService = {
  getProducts: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { sku: { contains: filters.search, mode: "insensitive" } },
        { barcode: { contains: filters.search, mode: "insensitive" } },
      ];
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";
    if (filters.category_id)
      where.category_id = Number(filters.category_id);

    const [products, total] = await Promise.all([
      ProductModel.findMany({ where, skip, take: limit }),
      ProductModel.count(where),
    ]);

    return {
      data: products,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getActiveProducts: async () => {
    return ProductModel.findActive();
  },

  getProductById: async (id) => {
    return ProductModel.findUnique(id);
  },

  addProduct: async ({ name, category_id, unit_id, sku, barcode, description, min_stock, status = true, attribute_ids }, userId) => {
    const result = await ProductModel.create({
      name,
      category_id: category_id ? Number(category_id) : null,
      unit_id: Number(unit_id),
      sku: sku || null,
      barcode: barcode || null,
      description: description || null,
      min_stock: min_stock !== undefined && min_stock !== "" ? parseInt(min_stock, 10) : null,
      status,
    });
    await ProductModel.setAttributes(result.id, attribute_ids || []);
    await createAuditLog({ userId, action: "create", entity: "products", recordId: result.id, newData: result });
    return result;
  },

  editProductById: async (id, { name, category_id, unit_id, sku, barcode, description, min_stock, status, attribute_ids }, userId) => {
    const old = await ProductModel.findUnique(id);
    const result = await ProductModel.update(id, {
      name,
      category_id: category_id ? Number(category_id) : null,
      unit_id: Number(unit_id),
      sku: sku || null,
      barcode: barcode || null,
      description: description || null,
      min_stock: min_stock !== undefined && min_stock !== "" ? parseInt(min_stock, 10) : null,
      status: status !== undefined ? status === true || status === "true" : undefined,
    });
    if (attribute_ids !== undefined) await ProductModel.setAttributes(id, attribute_ids || []);
    await createAuditLog({ userId, action: "update", entity: "products", recordId: id, oldData: old, newData: result });
    return result;
  },

  deleteProductById: async (id, userId) => {
    const productId = parseInt(id, 10);
    const old = await ProductModel.findUnique(productId);
    if (!old) return null;
    const result = await ProductModel.delete(productId);
    await createAuditLog({ userId, action: "delete", entity: "products", recordId: productId, oldData: old });
    return result;
  },
};
