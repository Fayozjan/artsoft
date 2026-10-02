import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant } from "../utils/prismaForTenant.js";

// Удаляет пункт меню "work-distribution" из всех тенантов.
// Права в user_menu_access удалятся каскадом (onDelete: Cascade).
// Запускать ОДИН раз после `npm run migrate:tenants`.

console.log("Removing 'work-distribution' menu from all tenants...\n");

const { rows } = await pool.query("SELECT id, name, schema FROM public.tenants ORDER BY id");
const results = [];

for (const tenant of rows) {
  const prisma = getPrismaForTenant(tenant.schema);
  try {
    const { count } = await prisma.menus.deleteMany({ where: { name: "work-distribution" } });
    results.push({ name: tenant.name, schema: tenant.schema, status: "ok", count });
  } catch (err) {
    results.push({ name: tenant.name, schema: tenant.schema, status: "error", error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}

for (const r of results) {
  const mark = r.status === "ok" ? "✅" : "❌";
  const detail = r.error ? ` — ${r.error}` : ` — удалено записей: ${r.count}`;
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter((r) => r.status === "error").length;
console.log(`\nDone. ${results.length - failed}/${results.length} succeeded.`);

await pool.end();
