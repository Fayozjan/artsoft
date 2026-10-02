import cron from "node-cron";
import { DateTime } from "luxon";

import { prismaPublic, getPrismaForTenant } from "../../utils/prismaForTenant.js";
import { tenantContext } from "../../utils/tenantContext.js";
import { prismaContext } from "../../utils/prismaContext.js";
import { CronTasksModel } from "../../modules/cronTasks/cronTasks.model.js";
import { cronTaskTypes } from "../../modules/cronTasks/cronTasks.taskTypes.js";

// Задачи, выполняющиеся прямо сейчас: `${schema}:${id}`.
// Нужен, потому что задача может идти дольше минуты (events_sync — минуты),
// а тик планировщика приходит каждую минуту.
const runningTasks = new Set();

// Идемпотентность daily-задач: если задача уже отмечена выполненной в текущую минуту —
// пропускаем повторный запуск (защита от гонок/двойного тика в рамках одной минуты).
function isDueThisMinute(row, now) {
  if (!row.last_run_at) return true;
  const last = DateTime.fromJSDate(row.last_run_at).setZone("Asia/Tashkent");
  return !last.hasSame(now, "minute");
}

// Интервал отсчитывается от last_run_at, который планировщик обновляет и на старте,
// и на финише задачи — как старый setTimeout(run, intervalMs) в finally.
function isDueByInterval(row, now) {
  if (!row.interval_minutes) return false;
  if (!row.last_run_at) return true;
  return now.toMillis() - row.last_run_at.getTime() >= row.interval_minutes * 60_000;
}

async function startTask(schema, row) {
  const key = `${schema}:${row.id}`;
  if (runningTasks.has(key)) {
    console.warn(`⏳ [cronTasks] Задача "${row.name}" (id=${row.id}) ещё выполняется — пропуск`);
    return;
  }

  const taskType = cronTaskTypes[row.task_type];
  if (!taskType) {
    console.error(`❌ [cronTasks] Неизвестный тип задачи: ${row.task_type} (id=${row.id})`);
    return;
  }

  runningTasks.add(key);
  await CronTasksModel.markRun(row.id, { status: "running" });

  // Без await: тик не должен ждать задачу, иначе одна долгая блокирует
  // остальные задачи и остальных тенантов. Контекст тенанта наследуется через ALS.
  (async () => {
    try {
      const result = await taskType.execute(row);
      await CronTasksModel.markRun(row.id, { status: "success", error: result?.error ?? null });
      console.log(`✅ [cronTasks] Выполнена задача "${row.name}" (id=${row.id})`);
    } catch (err) {
      await CronTasksModel.markRun(row.id, { status: "error", error: err.message }).catch(
        (e) => console.error(`❌ [cronTasks] Не записан статус (id=${row.id}):`, e.message),
      );
      console.error(`❌ [cronTasks] Ошибка задачи "${row.name}" (id=${row.id}):`, err.message);
    } finally {
      runningTasks.delete(key);
    }
  })();
}

async function runDueTasksForTenant(schema, now) {
  const [dailyRows, intervalRows] = await Promise.all([
    CronTasksModel.findDueDaily({
      hour: now.hour,
      minute: now.minute,
      weekday: now.weekday, // luxon: ISO 1(Пн)..7(Вс) — совпадает с days_of_week
    }),
    CronTasksModel.findActiveInterval(),
  ]);

  for (const row of dailyRows) {
    if (!isDueThisMinute(row, now)) continue;
    await startTask(schema, row);
  }

  for (const row of intervalRows) {
    if (!isDueByInterval(row, now)) continue;
    await startTask(schema, row);
  }
}

async function tick() {
  const now = DateTime.now().setZone("Asia/Tashkent");
  const tenants = await prismaPublic.tenants.findMany();

  for (const tenant of tenants) {
    const prisma = getPrismaForTenant(tenant.schema);
    try {
      await prismaContext.run(prisma, () =>
        tenantContext.run(tenant, () => runDueTasksForTenant(tenant.schema, now)),
      );
    } catch (err) {
      console.error(`❌ [cronTasks] [${tenant.schema}] Ошибка тика:`, err.message);
    }
  }
}

export function startCronTasksScheduler() {
  cron.schedule(
    "* * * * *",
    () => {
      tick().catch((err) => console.error("❌ [cronTasks] Ошибка планировщика:", err.message));
    },
    { timezone: "Asia/Tashkent" },
  );

  console.log("📅 Планировщик крон-задач запущен");
}
