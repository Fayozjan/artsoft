import { PartnerModel } from "./partners.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const PartnersService = {
  getPartners: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
        { tax_number: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search, mode: "insensitive" } },
        { contact_person: { contains: filters.search, mode: "insensitive" } },
      ];
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";
    if (filters.type)
      where.type = filters.type;
    if (filters.category_id)
      where.category_id = Number(filters.category_id);

    const [partners, total] = await Promise.all([
      PartnerModel.findMany({ where, skip, take: limit }),
      PartnerModel.count(where),
    ]);

    return {
      data: partners,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getActivePartners: async () => {
    return PartnerModel.findActive();
  },

  getPartnerById: async (id) => {
    return PartnerModel.findUnique(id);
  },

  addPartner: async (
    {
      name,
      category_id,
      type = "supplier",
      code,
      tax_number,
      contact_person,
      phone,
      email,
      address,
      note,
      supplier_location_id,
      customer_location_id,
      status = true,
    },
    userId,
  ) => {
    const result = await PartnerModel.create({
      name,
      category_id: category_id ? Number(category_id) : null,
      type,
      code: code || null,
      tax_number: tax_number || null,
      contact_person: contact_person || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      note: note || null,
      supplier_location_id: supplier_location_id ? Number(supplier_location_id) : null,
      customer_location_id: customer_location_id ? Number(customer_location_id) : null,
      status,
    });
    await createAuditLog({ userId, action: "create", entity: "partners", recordId: result.id, newData: result });
    return result;
  },

  editPartnerById: async (
    id,
    {
      name,
      category_id,
      type,
      code,
      tax_number,
      contact_person,
      phone,
      email,
      address,
      note,
      supplier_location_id,
      customer_location_id,
      status,
    },
    userId,
  ) => {
    const old = await PartnerModel.findUnique(id);
    const result = await PartnerModel.update(id, {
      name,
      category_id: category_id ? Number(category_id) : null,
      type,
      code: code || null,
      tax_number: tax_number || null,
      contact_person: contact_person || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      note: note || null,
      supplier_location_id: supplier_location_id ? Number(supplier_location_id) : null,
      customer_location_id: customer_location_id ? Number(customer_location_id) : null,
      status,
    });
    await createAuditLog({ userId, action: "update", entity: "partners", recordId: id, oldData: old, newData: result });
    return result;
  },

  deletePartnerById: async (id, userId) => {
    const partnerId = parseInt(id, 10);
    const old = await PartnerModel.findUnique(partnerId);
    if (!old) return null;
    const result = await PartnerModel.delete(partnerId);
    await createAuditLog({ userId, action: "delete", entity: "partners", recordId: partnerId, oldData: old });
    return result;
  },
};
