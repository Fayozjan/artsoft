import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";

// Полная очистка истории выплат одного тенанта: логи выплат, авансы и долги.
// Производные поля строк ведомости сбрасываются, чтобы остатки не разъехались.
//
//   node scripts/wipe-payroll-payments.js <schema>          — только показать
//   node scripts/wipe-payroll-payments.js <schema> --yes    — удалить
//
// После удаления прогнать «Пересчитать остатки» на странице выплат за каждый
// год: перенос зарплатных остатков собирается заново по месяцам.

const schema = process.argv[2];
const confirmed = process.argv.includes("--yes");

if (!schema || !/^[a-z0-9_]+$/i.test(schema)) {
  console.error("Usage: node scripts/wipe-payroll-payments.js <schema> [--yes]");
  process.exit(1);
}

const { rowCount: tenantExists } = await pool.query(
  "SELECT 1 FROM public.tenants WHERE schema = $1",
  [schema],
);
if (!tenantExists) {
  console.error(`Tenant with schema "${schema}" not found`);
  await pool.end();
  process.exit(1);
}

const q = async (sql) => (await pool.query(sql)).rows[0];

const before = await q(`
  SELECT
    (SELECT count(*) FROM "${schema}".payroll_payment_logs)                          AS logs,
    (SELECT count(*) FROM "${schema}".payroll_payment_logs WHERE is_advance)         AS advances,
    (SELECT count(*) FROM "${schema}".employee_debts)                                AS loans,
    (SELECT coalesce(sum(amount), 0) FROM "${schema}".payroll_payment_logs)          AS total,
    (SELECT count(*) FROM "${schema}".payroll_sheet_items WHERE paid_amount <> 0
        OR debt_balance <> 0 OR salary_balance <> 0 OR debt_deduction <> 0)          AS dirty_items
`);

console.log(`Схема: ${schema}`);
console.log(`  записей о выплатах: ${before.logs} (авансов ${before.advances})`);
console.log(`  займов:             ${before.loans}`);
console.log(`  на сумму:           ${before.total}`);
console.log(`  строк ведомости под сброс: ${before.dirty_items}`);

if (!confirmed) {
  console.log("\nНичего не удалено. Повтори с флагом --yes, чтобы применить.");
  await pool.end();
  process.exit(0);
}

const client = await pool.connect();
try {
  await client.query("BEGIN");

  const del = await client.query(`DELETE FROM "${schema}".payroll_payment_logs`);
  const delDebts = await client.query(`DELETE FROM "${schema}".employee_debts`);

  // paid_amount, статус выплаты и вся связка долгов — производные от логов
  const upd = await client.query(`
    UPDATE "${schema}".payroll_sheet_items
       SET paid_amount    = 0,
           payout_status  = 'unpaid',
           salary_balance = 0,
           debt_balance   = 0,
           debt_deduction = 0,
           debt_mode      = 'skip',
           debt_comment   = NULL
     WHERE paid_amount    <> 0
        OR payout_status  <> 'unpaid'
        OR salary_balance <> 0
        OR debt_balance   <> 0
        OR debt_deduction <> 0
  `);

  await client.query("COMMIT");
  console.log(`\n✅ Удалено записей: ${del.rowCount}`);
  console.log(`✅ Сброшено строк ведомости: ${upd.rowCount}`);
  console.log("\nДальше: «Пересчитать остатки» на странице выплат за каждый год.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("\n❌ Откат:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
