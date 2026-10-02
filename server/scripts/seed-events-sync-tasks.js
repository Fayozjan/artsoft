import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant, disconnectAll } from "../utils/prismaForTenant.js";

// Тиры бывшего scheduleEventsChecker из utils/hikEventChecker.js.
// Теперь это обычные строки cron_tasks — их можно править и выключать из UI.
const TIERS = [
  { name: "Синхронизация событий — live", interval_minutes: 30, window_minutes: 60 },
  { name: "Синхронизация событий — recovery", interval_minutes: 180, window_minutes: 720 },
  { name: "Синхронизация событий — deep sync", interval_minutes: 1440, window_minutes: 1440 },
  { name: "Синхронизация событий — weekly sync", interval_minutes: 10080, window_minutes: 43200 },
];

async function seedTenant(schema) {
  const prisma = getPrismaForTenant(schema);

  const existing = await prisma.cron_tasks.findMany({
    where: { task_type: "events_sync" },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((e) => e.name));

  const owner = await prisma.users.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  if (!owner) return { created: 0, skipped: TIERS.length, note: "нет пользователей" };

  let created = 0;
  let skipped = 0;

  for (const tier of TIERS) {
    if (existingNames.has(tier.name)) {
      skipped++;
      continue;
    }

    await prisma.cron_tasks.create({
      data: {
        name: tier.name,
        task_type: "events_sync",
        config: { window_minutes: tier.window_minutes },
        schedule_kind: "interval",
        interval_minutes: tier.interval_minutes,
        days_of_week: [],
        status: true,
        created_by: owner.id,
      },
    });
    created++;
  }

  return { created, skipped };
}

console.log("Создание стандартных крон-задач events_sync для всех тенантов...\n");
console.log("Задачи с такими же названиями пропускаются — скрипт можно запускать повторно.\n");

const { rows } = await pool.query("SELECT id, name, schema FROM public.tenants ORDER BY id");
const results = [];

for (const tenant of rows) {
  try {
    const res = await seedTenant(tenant.schema);
    results.push({ ...tenant, status: "ok", ...res });
  } catch (err) {
    results.push({ ...tenant, status: "error", error: err.message });
  }
}

for (const r of results) {
  const mark = r.status === "ok" ? "✅" : "❌";
  const detail =
    r.status === "ok"
      ? ` — создано ${r.created}, пропущено ${r.skipped}${r.note ? ` (${r.note})` : ""}`
      : ` — ${r.error}`;
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter((r) => r.status === "error").length;
console.log(`\nГотово. Успешно ${results.length - failed}/${results.length} тенантов.`);

await disconnectAll();
await pool.end();
