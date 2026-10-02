import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant } from "../utils/prismaForTenant.js";
import { seedStickerTemplates } from "../utils/seedTenant.js";

// Добавляет готовые дизайны стикера во все существующие тенанты. Идемпотентно и
// только добавляет: имеющиеся варианты не меняются, активный остаётся прежним.
// Запускать ПОСЛЕ migrate:tenants (нужны колонки name/is_active).
console.log("Seeding sticker templates for all tenants...\n");

const { rows } = await pool.query("SELECT id, name, schema FROM public.tenants ORDER BY id");
const results = [];

for (const tenant of rows) {
  const prisma = getPrismaForTenant(tenant.schema);
  try {
    await seedStickerTemplates(prisma);
    results.push({ name: tenant.name, schema: tenant.schema, status: "ok" });
  } catch (err) {
    results.push({ name: tenant.name, schema: tenant.schema, status: "error", error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}

for (const r of results) {
  const mark = r.status === "ok" ? "✅" : "❌";
  const detail = r.error ? ` — ${r.error}` : "";
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter((r) => r.status === "error").length;
console.log(`\nDone. ${results.length - failed}/${results.length} succeeded.`);

await pool.end();
