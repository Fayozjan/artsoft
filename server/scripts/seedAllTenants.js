import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant } from "../utils/prismaForTenant.js";
import { seedTenantData } from "../utils/seedTenant.js";

console.log("Seeding menus/data for all tenants...\n");

const { rows } = await pool.query("SELECT id, name, schema FROM public.tenants ORDER BY id");
const results = [];

for (const tenant of rows) {
  try {
    const prisma = getPrismaForTenant(tenant.schema);
    await seedTenantData(prisma);
    await prisma.$disconnect();
    results.push({ name: tenant.name, schema: tenant.schema, status: "ok" });
  } catch (err) {
    results.push({ name: tenant.name, schema: tenant.schema, status: "error", error: err.message });
  }
}

for (const r of results) {
  const mark = r.status === "ok" ? "✅" : "❌";
  const detail = r.error ? ` — ${r.error}` : "";
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter(r => r.status === "error").length;
console.log(`\nDone. ${results.length - failed}/${results.length} succeeded.`);

await pool.end();
