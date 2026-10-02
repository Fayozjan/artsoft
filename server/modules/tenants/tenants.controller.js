import { TenantsModel } from "./tenants.model.js";
import { tenantCache } from "../../middlewares/tenantMiddleware.js";
import { provisionTenant, migrateAllTenants } from "../../utils/provisionTenant.js";
import { prismaPublic, getPrismaForTenant } from "../../utils/prismaForTenant.js";
import { seedTenantData } from "../../utils/seedTenant.js";

export const getTenants = async (req, res) => {
  try {
    const data = await TenantsModel.getAll();
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении тенантов" });
  }
};

export const getTenantById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = await TenantsModel.getById(id);
    if (!data) return res.status(404).json({ error: "Тенант не найден" });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении тенанта" });
  }
};

export const createTenant = async (req, res) => {
  try {
    const { name, subdomain, schema } = req.body;

    if (!name || !subdomain || !schema) {
      return res.status(400).json({ error: "name, subdomain, schema обязательны" });
    }

    const tenant = await prismaPublic.tenants.create({
      data: { name, subdomain, schema },
    });

    await provisionTenant(schema, { runSeed: true });

    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Тенант с таким subdomain или schema уже существует" });
    }
    console.error(err);
    res.status(500).json({ error: "Ошибка при создании тенанта" });
  }
};

export const migrateAll = async (req, res) => {
  try {
    const results = await migrateAllTenants();
    const hasErrors = results.some((r) => r.status === "error");
    res.status(hasErrors ? 207 : 200).json({ success: !hasErrors, data: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при миграции" });
  }
};

export const reseedTenant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenant = await TenantsModel.getById(id);
    if (!tenant) return res.status(404).json({ error: "Тенант не найден" });

    const prisma = getPrismaForTenant(tenant.schema);
    await seedTenantData(prisma);
    tenantCache.delete(tenant.subdomain);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при ресиде" });
  }
};
