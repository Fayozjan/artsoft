import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant, disconnectAll } from "../utils/prismaForTenant.js";

// Бэкофилл партий (stock_lots) для остатков/движений склада, заведённых до
// появления партий — см. план в docs/data-models.md (stock_lots). Схема уже
// должна быть на сервере (lot_id nullable на stock_quants/stock_moves,
// npm run migrate:tenants) ДО запуска этого скрипта.
// На каждый продукт, у которого есть строки stock_quants или stock_moves без
// lot_id, создаём одну "партию без данных" (price_unit/note пустые, без
// характеристик) и проставляем её lot_id всем таким строкам этого продукта —
// текущий остаток не меняется, просто получает идентичность партии.
async function migrateTenant(schema) {
  const prisma = getPrismaForTenant(schema);

  const productIds = await prisma.$queryRaw`
    SELECT DISTINCT product_id FROM (
      SELECT product_id FROM stock_quants WHERE lot_id IS NULL
      UNION
      SELECT product_id FROM stock_moves WHERE lot_id IS NULL
    ) p
  `;

  let lotsCreated = 0;
  let quantsUpdated = 0;
  let movesUpdated = 0;

  for (const { product_id } of productIds) {
    const lot = await prisma.stock_lots.create({ data: { product_id } });
    lotsCreated++;

    const q = await prisma.stock_quants.updateMany({
      where: { product_id, lot_id: null },
      data: { lot_id: lot.id },
    });
    quantsUpdated += q.count;

    const m = await prisma.stock_moves.updateMany({
      where: { product_id, lot_id: null },
      data: { lot_id: lot.id },
    });
    movesUpdated += m.count;
  }

  // qty_packages — новая колонка на stock_quants (default 0), появилась позже
  // lot_id: для уже существующих строк остатка её не из чего было накопить
  // через applyQuantDelta задним числом, поэтому пересчитываем честно из
  // истории done-движений (как если бы колонка была всегда). Безопасно
  // перезапускать — каждый раз пересчитывает заново, не прибавляет.
  const packagesUpdated = await prisma.$executeRaw`
    WITH flows AS (
      SELECT product_id, lot_id, location_dest_id AS location_id, COALESCE(SUM(qty_packages), 0) AS delta
      FROM stock_moves
      WHERE state = 'done' AND lot_id IS NOT NULL
      GROUP BY product_id, lot_id, location_dest_id
      UNION ALL
      SELECT product_id, lot_id, location_src_id AS location_id, -COALESCE(SUM(qty_packages), 0) AS delta
      FROM stock_moves
      WHERE state = 'done' AND lot_id IS NOT NULL
      GROUP BY product_id, lot_id, location_src_id
    ),
    net AS (
      SELECT product_id, lot_id, location_id, SUM(delta) AS qty_packages
      FROM flows
      GROUP BY product_id, lot_id, location_id
    )
    UPDATE stock_quants q
    SET qty_packages = net.qty_packages
    FROM net
    WHERE q.product_id = net.product_id AND q.lot_id = net.lot_id AND q.location_id = net.location_id
  `;

  return { lotsCreated, quantsUpdated, movesUpdated, packagesUpdated };
}

console.log("Backfilling stock_lots for existing stock_quants/stock_moves...\n");

const { rows } = await pool.query("SELECT id, name, schema FROM public.tenants ORDER BY id");
const results = [];

for (const tenant of rows) {
  try {
    const stats = await migrateTenant(tenant.schema);
    results.push({ ...tenant, status: "ok", ...stats });
  } catch (err) {
    results.push({ ...tenant, status: "error", error: err.message });
  }
}

for (const r of results) {
  const mark = r.status === "ok" ? "✅" : "❌";
  const detail =
    r.status === "ok"
      ? ` — ${r.lotsCreated} lot(s), ${r.quantsUpdated} quant row(s), ${r.movesUpdated} move row(s), qty_packages recalculated on ${r.packagesUpdated} quant row(s)`
      : ` — ${r.error}`;
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter((r) => r.status === "error").length;
console.log(`\nDone. ${results.length - failed}/${results.length} tenants succeeded.`);

await disconnectAll();
await pool.end();
