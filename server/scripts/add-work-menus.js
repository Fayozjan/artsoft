import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant } from "../utils/prismaForTenant.js";

// Добавляет пункт меню "work-acceptance" (Производство) всем существующим
// тенантам и открывает доступ всем текущим пользователям с доступом к
// "production" (наследуют те же права can_add/can_update).
// Запускать ОДИН раз после `npm run migrate:tenants`.

console.log("Adding 'work-acceptance' menu to all tenants...\n");

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

    const children = [{ name: "work-acceptance", path: "/work-acceptance" }];

    const menus = [];
    for (const [i, item] of children.entries()) {
      menus.push(
        await prisma.menus.upsert({
          where: { name: item.name },
          update: {},
          create: { ...item, parent_id: production.id, sort_order: 100 + i },
        }),
      );
    }

    const productionAccess = await prisma.user_menu_access.findMany({
      where: { menu_id: production.id },
    });

    let grantCount = 0;
    for (const access of productionAccess) {
      for (const menu of menus) {
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
