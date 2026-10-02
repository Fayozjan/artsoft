import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import pool from "../db.js";
import { getPrismaForTenant, disconnectAll } from "../utils/prismaForTenant.js";

async function migrateTenant(schema) {
  const prisma = getPrismaForTenant(schema);

  const users = await prisma.users.findMany({
    select: { id: true, settings: true },
  });

  const existing = await prisma.attendance_filter_presets.findMany({
    select: { name: true, created_by: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.created_by}:${e.name}`));

  let migrated = 0;

  for (const user of users) {
    const presets = user.settings?.attendanceFilterPresets;
    if (!Array.isArray(presets) || presets.length === 0) continue;

    for (const preset of presets) {
      if (!preset?.name || !preset?.filter) continue;

      const key = `${user.id}:${preset.name}`;
      if (existingKeys.has(key)) continue;

      await prisma.attendance_filter_presets.create({
        data: {
          name: preset.name,
          filter: preset.filter,
          created_by: user.id,
        },
      });
      existingKeys.add(key);
      migrated++;
    }
  }

  return migrated;
}

console.log("Migrating attendance filter presets from users.settings to attendance_filter_presets...\n");
console.log("Old data in users.settings is left untouched.\n");

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
  const detail = r.status === "ok" ? ` — ${r.migrated} preset(s)` : ` — ${r.error}`;
  console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
}

const failed = results.filter((r) => r.status === "error").length;
console.log(`\nDone. ${results.length - failed}/${results.length} tenants succeeded.`);

await disconnectAll();
await pool.end();
