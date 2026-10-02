import { AttributeModel, AttributeValueModel } from "./attributes.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const AttributesService = {
  getAttributes: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.name = { contains: filters.search, mode: "insensitive" };
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const [attributes, total] = await Promise.all([
      AttributeModel.findMany({ where, skip, take: limit }),
      AttributeModel.count(where),
    ]);

    const formatted = attributes.map((a) => ({
      ...a,
      values_count: a._count.values,
      categories_count: a._count.categoryAttributes,
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

  getActiveAttributes: async () => {
    return AttributeModel.findActive();
  },

  getAttributeById: async (id) => {
    return AttributeModel.findUnique(id);
  },

  addAttribute: async ({ name, status = true }, userId) => {
    const result = await AttributeModel.create({ name, status });
    await createAuditLog({ userId, action: "create", entity: "attributes", recordId: result.id, newData: result });
    return result;
  },

  editAttributeById: async (id, { name, status }, userId) => {
    const old = await AttributeModel.findUnique(id);
    const result = await AttributeModel.update(id, {
      name,
      status: status !== undefined ? status === true || status === "true" : undefined,
    });
    await createAuditLog({ userId, action: "update", entity: "attributes", recordId: id, oldData: old, newData: result });
    return result;
  },

  deleteAttributeById: async (id, userId) => {
    const attributeId = parseInt(id, 10);
    const old = await AttributeModel.findUnique(attributeId);
    if (!old) return null;
    const result = await AttributeModel.delete(attributeId);
    await createAuditLog({ userId, action: "delete", entity: "attributes", recordId: attributeId, oldData: old });
    return result;
  },

  getAttributeValues: async (attributeId) => {
    return AttributeValueModel.findByAttribute(attributeId);
  },

  addAttributeValue: async (attributeId, { value }, userId) => {
    const result = await AttributeValueModel.create({
      attribute_id: Number(attributeId),
      value,
    });
    await createAuditLog({ userId, action: "create", entity: "attribute_values", recordId: result.id, newData: result });
    return result;
  },

  editAttributeValue: async (valueId, { value, status }, userId) => {
    const old = await AttributeValueModel.findUnique(valueId);
    const result = await AttributeValueModel.update(valueId, {
      value,
      status: status !== undefined ? status === true || status === "true" : undefined,
    });
    await createAuditLog({ userId, action: "update", entity: "attribute_values", recordId: valueId, oldData: old, newData: result });
    return result;
  },

  deleteAttributeValue: async (valueId, userId) => {
    const id = parseInt(valueId, 10);
    const old = await AttributeValueModel.findUnique(id);
    if (!old) return null;
    const result = await AttributeValueModel.delete(id);
    await createAuditLog({ userId, action: "delete", entity: "attribute_values", recordId: id, oldData: old });
    return result;
  },
};
