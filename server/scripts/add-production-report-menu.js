import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant } from "../utils/prismaForTenant.js";

// Добавляет пункт меню "production-report" (Производство → Отчёт по производству)
// всем существующим тенантам и открывает доступ всем текущим пользователям с
// доступом к "production" (наследуют те же права).
// Запускать ОДИН раз. Миграция БД не нужна — отчёт читает существующие таблицы.

console.log("Adding 'production-report' menu to all tenants...\n");

const { rows } = await pool.query("SELECT id, name, schema FROM public.tenants ORDER BY id");
const results = [];

for (const tenant of rows) {
  const prisma = getPrismaForTenant(tenant.schema);
  try {
    const production = await prisma.menus.findUnique({ where: { name: "production" } });
    if (!production) {
      results.push({ name: tenant.name, schema: tenant.schema, status: "ok", count: 0 });
      continue;
    }

    const menu = await prisma.menus.upsert({
      where: { name: "production-report" },
      update: {},
      create: {
        name: "production-report",
        path: "/production-report",
        parent_id: production.id,
        sort_order: 102,
      },
    });

    const productionAccess = await prisma.user_menu_access.findMany({
      where: { menu_id: production.id },
    });

    let grantCount = 0;
    for (const access of productionAccess) {
      await prisma.user_menu_access.upsert({
        where: { user_id_menu_id: { user_id: access.user_id, menu_id: menu.id } },
        update: {},
        create: {
          user_id: access.user_id,
          menu_id: menu.id,
          can_view: access.can_view,
          can_add: access.can_add,
          can_update: access.can_update,
          can_delete: access.can_delete,
        },
      });
      grantCount++;
    }

    results.push({ name: tenant.name, schema: tenant.schema, status: "ok", count: grantCount });
  } catch (err) {
    results.push({ name: tenant.name, schema: tenant.schema, status: "error", error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}

for (const r of results) {
  const mark = r.status === "ok" ? "✅" : "❌";
  const detail = r.error ? ` — ${r.error}` : ` — прав выдано: ${r.count}`;
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter((r) => r.status === "error").length;
console.log(`\nDone. ${results.length - failed}/${results.length} succeeded.`);

await pool.end();
