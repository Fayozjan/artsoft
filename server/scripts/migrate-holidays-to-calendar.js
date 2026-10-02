/**
 * Переезд «Праздники» → «Производственный календарь».
 *
 * Для каждой tenant-схемы:
 *   1. Создаёт таблицу production_calendar, если её ещё нет.
 *   2. Разворачивает holidays (date_from..date_to) в дни production_calendar
 *      с day_type = "holiday" (существующие переопределения не трогаются).
 *   3. Переименовывает пункт меню holidays → production-calendar,
 *      сохраняя выданные пользователям права (user_menu_access).
 *   4. Таблица holidays НЕ удаляется — её снесёт `npm run migrate:tenants`
 *      (prisma db push) после того, как данные перенесены.
 *
 * Порядок запуска:
 *   npx prisma generate --schema prisma/schema.client.prisma
 *   node scripts/migrate-holidays-to-calendar.js   ← перенос данных
 *   npm run migrate:tenants                        ← затем db push (дропнет holidays)
 *
 * Флаг --dry-run: только показать, что будет сделано.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

import pool from "../db.js";

const DRY_RUN = process.argv.includes("--dry-run");

function ymd(date) {
  const d = new Date(date);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

async function getTenantSchemas(client) {
  const { rows } = await client.query(
    `SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ('public', 'information_schema')
        AND schema_name NOT LIKE 'pg_%'
      ORDER BY schema_name`,
  );
  return rows.map((r) => r.schema_name);
}

async function tableExists(client, schema, table) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  return rows.length > 0;
}

// Таблица создаётся здесь же, чтобы перенос можно было выполнить ДО db push:
// db push дропает holidays, и данные было бы уже неоткуда брать.
// Структура совпадает с моделью production_calendar в schema.client.prisma.
async function ensureCalendarTable(client, schema) {
  if (await tableExists(client, schema, "production_calendar")) return false;

  await client.query(`
    CREATE TABLE "${schema}".production_calendar (
      id            SERIAL PRIMARY KEY,
      date          DATE NOT NULL,
      day_type      VARCHAR(20) NOT NULL,
      name          VARCHAR(255),
      short_minutes INTEGER,
      added_by      INTEGER NOT NULL REFERENCES "${schema}".users(id),
      added_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT now()
    )
  `);
  await client.query(
    `CREATE UNIQUE INDEX production_calendar_date_key ON "${schema}".production_calendar(date)`,
  );
  await client.query(
    `CREATE INDEX production_calendar_date_idx ON "${schema}".production_calendar(date)`,
  );

  return true;
}

async function migrateSchema(client, schema) {
  // Схема без users — не tenant-схема, пропускаем
  if (!(await tableExists(client, schema, "users"))) {
    return { schema, status: "skipped", detail: "не tenant-схема (нет users)" };
  }

  const hasHolidays = await tableExists(client, schema, "holidays");

  let tableCreated = false;
  if (!DRY_RUN) {
    tableCreated = await ensureCalendarTable(client, schema);
  } else if (!(await tableExists(client, schema, "production_calendar"))) {
    tableCreated = true;
  }

  let inserted = 0;

  if (hasHolidays) {
    const { rows: holidays } = await client.query(
      `SELECT id, name, date_from, date_to, added_by FROM "${schema}".holidays ORDER BY date_from`,
    );

    for (const holiday of holidays) {
      const from = new Date(holiday.date_from);
      const to = new Date(holiday.date_to);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue;

      for (
        let d = new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
        );
        d <= to;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const date = ymd(d);
        if (DRY_RUN) {
          inserted++;
          continue;
        }

        const res = await client.query(
          `INSERT INTO "${schema}".production_calendar
             (date, day_type, name, short_minutes, added_by, added_at, updated_at)
           VALUES ($1::date, 'holiday', $2, NULL, $3, now(), now())
           ON CONFLICT (date) DO NOTHING`,
          [date, holiday.name, holiday.added_by],
        );
        inserted += res.rowCount;
      }
    }
  }

  // Меню: переименование сохраняет user_menu_access (FK по menu_id)
  let menuRenamed = 0;
  const hasMenus = await tableExists(client, schema, "menus");
  if (hasMenus) {
    if (DRY_RUN) {
      const { rows } = await client.query(
        `SELECT id FROM "${schema}".menus WHERE name = 'holidays'`,
      );
      menuRenamed = rows.length;
    } else {
      const res = await client.query(
        `UPDATE "${schema}".menus
            SET name = 'production-calendar', path = '/production-calendar'
          WHERE name = 'holidays'`,
      );
      menuRenamed = res.rowCount;
    }
  }

  return {
    schema,
    status: "ok",
    detail: `${tableCreated ? "таблица создана, " : ""}дней перенесено: ${inserted}, меню обновлено: ${menuRenamed}${
      hasHolidays ? "" : " (таблицы holidays уже нет)"
    }`,
  };
}

async function run() {
  const client = await pool.connect();
  const results = [];

  try {
    const schemas = await getTenantSchemas(client);
    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}Схем найдено: ${schemas.length}\n`,
    );

    for (const schema of schemas) {
      try {
        results.push(await migrateSchema(client, schema));
      } catch (err) {
        results.push({ schema, status: "error", detail: err.message });
      }
    }
  } finally {
    client.release();
  }

  for (const r of results) {
    const mark = r.status === "ok" ? "✅" : r.status === "skipped" ? "⏭️" : "❌";
    console.log(`${mark} [${r.schema}] ${r.detail}`);
  }

  const failed = results.filter((r) => r.status === "error").length;
  console.log(`\nГотово. Ошибок: ${failed}/${results.length}`);
}

run()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
