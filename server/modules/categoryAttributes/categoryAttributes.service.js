import { CategoryAttributeModel } from "./categoryAttributes.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const CategoryAttributesService = {
  getByCategory: async (categoryId) => {
    return CategoryAttributeModel.findByCategory(categoryId);
  },

  addCategoryAttribute: async ({ category_id, attribute_id, required = false }, userId) => {
    const result = await CategoryAttributeModel.create({
      category_id: Number(category_id),
      attribute_id: Number(attribute_id),
      required: !!required,
    });
    await createAuditLog({ userId, action: "create", entity: "category_attributes", recordId: result.id, newData: result });
    return result;
  },

  editCategoryAttributeById: async (id, { required }, userId) => {
    const old = await CategoryAttributeModel.findUnique(id);
    const result = await CategoryAttributeModel.update(id, { required: !!required });
    await createAuditLog({ userId, action: "update", entity: "category_attributes", recordId: id, oldData: old, newData: result });
    return result;
  },

  deleteCategoryAttributeById: async (id, userId) => {
    const linkId = parseInt(id, 10);
    const old = await CategoryAttributeModel.findUnique(linkId);
    if (!old) return null;
    const result = await CategoryAttributeModel.delete(linkId);
    await createAuditLog({ userId, action: "delete", entity: "category_attributes", recordId: linkId, oldData: old });
    return result;
  },
};
