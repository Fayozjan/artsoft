import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant, disconnectAll } from "../utils/prismaForTenant.js";

// Состояние "cancelled" у stock_pickings больше не используется (кнопку/статус
// убрали из UI) — старые документы в этом статусе просто возвращаем в черновик.
async function migrateTenant(schema) {
  const prisma = getPrismaForTenant(schema);
  const result = await prisma.stock_pickings.updateMany({
    where: { state: "cancelled" },
    data: { state: "draft" },
  });
  return result.count;
}

console.log("Reverting cancelled stock_pickings to draft...\n");

const { rows } = await pool.query("SELECT id, name, schema FROM public.tenants ORDER BY id");
const results = [];

for (const tenant of rows) {
  try {
    const reverted = await migrateTenant(tenant.schema);
    results.push({ ...tenant, status: "ok", reverted });
  } catch (err) {
    results.push({ ...tenant, status: "error", error: err.message });
  }
}

for (const r of results) {
  const mark = r.status === "ok" ? "✅" : "❌";
  const detail = r.status === "ok" ? ` — ${r.reverted} document(s)` : ` — ${r.error}`;
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter((r) => r.status === "error").length;
console.log(`\nDone. ${results.length - failed}/${results.length} tenants succeeded.`);

await disconnectAll();
await pool.end();
