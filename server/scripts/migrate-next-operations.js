import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant, disconnectAll } from "../utils/prismaForTenant.js";

// Таблица создаётся здесь же (а не только через `db push`), чтобы копирование не
// зависело от того, когда именно применится новая схема — CREATE TABLE IF NOT
// EXISTS безопасен и до, и после push; `db push` потом лишь доставит FK/индекс.
const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS operation_type_next_operations (
  operation_type_id      INTEGER NOT NULL,
  next_operation_type_id INTEGER NOT NULL,
  PRIMARY KEY (operation_type_id, next_operation_type_id)
);
`;

async function migrateTenant(schema) {
  const prisma = getPrismaForTenant(schema);

  await prisma.$executeRawUnsafe(SQL_CREATE_TABLE);

  // Старую колонку читаем сырым SQL — сгенерированный Prisma Client её уже не
  // знает (схема обновлена на operation_type_next_operations).
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, next_operation_type_id FROM operation_types WHERE next_operation_type_id IS NOT NULL`,
  );

  let migrated = 0;
  for (const row of rows) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO operation_type_next_operations (operation_type_id, next_operation_type_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      row.id,
      row.next_operation_type_id,
    );
    migrated++;
  }

  return migrated;
}

console.log("Copying operation_types.next_operation_type_id into operation_type_next_operations...\n");
console.log("Run this BEFORE `npm run migrate:tenants` on the updated schema — that push drops the old column.\n");

const { rows } = await pool.query("SELECT id, name, schema FROM public.tenants ORDER BY id");
const results = [];

for (const tenant of rows) {
  try {
    const migrated = await migrateTenant(tenant.schema);
    results.push({ ...tenant, status: "ok", migrated });
  } catch (err) {
    results.push({ ...tenant, status: "error", error: err.message });
  }
}

for (const r of results) {
  const mark = r.status === "ok" ? "✅" : "❌";
  const detail = r.status === "ok" ? ` — ${r.migrated} row(s)` : ` — ${r.error}`;
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter((r) => r.status === "error").length;
console.log(`\nDone. ${results.length - failed}/${results.length} tenants succeeded.`);

await disconnectAll();
await pool.end();
