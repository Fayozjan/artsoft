import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant } from "../utils/prismaForTenant.js";

// Долг вынесен из `net`: раньше net = accrued − debt_deduction + ..., теперь
// удержание вычитается только из суммы к выплате. У строк, где удержание уже
// применяли, net остался заниженным — пересчитываем его по компонентам.
//
// Запускать ОДИН раз после деплоя, затем прогнать «Пересчитать остатки» за
// каждый затронутый год.

const round = (n) => parseFloat(Number(n).toFixed(2));

const netOf = (it) =>
  round(
    Number(it.accrued) +
      Number(it.manual_adjustment || 0) -
      (it.apply_late ? Number(it.late_amount || 0) : 0) +
      (it.apply_overtime ? Number(it.overtime_amount || 0) : 0),
  );

console.log("Recalculating payroll net without debt deduction...\n");

const { rows } = await pool.query("SELECT id, name, schema FROM public.tenants ORDER BY id");
const results = [];

for (const tenant of rows) {
  const prisma = getPrismaForTenant(tenant.schema);
  try {
    const items = await prisma.payroll_sheet_items.findMany({
      select: {
        id: true, net: true, accrued: true, manual_adjustment: true,
        apply_late: true, late_amount: true,
        apply_overtime: true, overtime_amount: true,
      },
    });

    let fixed = 0;
    for (const it of items) {
      const net = netOf(it);
      if (Math.abs(net - Number(it.net)) < 0.001) continue;
      await prisma.payroll_sheet_items.update({ where: { id: it.id }, data: { net } });
      fixed++;
    }

    results.push({ name: tenant.name, schema: tenant.schema, status: "ok", fixed, total: items.length });
  } catch (err) {
    results.push({ name: tenant.name, schema: tenant.schema, status: "error", error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}

for (const r of results) {
  const mark = r.status === "ok" ? "✅" : "❌";
  const detail = r.error ? ` — ${r.error}` : ` — пересчитано ${r.fixed} из ${r.total}`;
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter((r) => r.status === "error").length;
console.log(`\nDone. ${results.length - failed}/${results.length} succeeded.`);

await pool.end();
