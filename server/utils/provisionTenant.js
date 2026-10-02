import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../db.js";
import { getPrismaForTenant } from "./prismaForTenant.js";
import { seedTenantData } from "./seedTenant.js";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "..");
const CLIENT_SCHEMA_PATH = path.join(SERVER_ROOT, "prisma", "schema.client.prisma");

async function dbPushForSchema(schemaName) {
  const baseUrl = process.env.CLIENT_DATABASE_URL;
  const url = `${baseUrl}?schema=${schemaName}`;

  const { stdout, stderr } = await execAsync(
    `npx prisma db push --schema="${CLIENT_SCHEMA_PATH}" --skip-generate --accept-data-loss`,
    {
      cwd: SERVER_ROOT,
      env: { ...process.env, CLIENT_DATABASE_URL: url },
    }
  );

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

export async function provisionTenant(schemaName, { runSeed = true } = {}) {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  await dbPushForSchema(schemaName);

  if (runSeed) {
    const prisma = getPrismaForTenant(schemaName);
    await seedTenantData(prisma);
  }
}

export async function migrateAllTenants() {
  const { rows } = await pool.query('SELECT id, name, schema FROM public.tenants ORDER BY id');
  const results = [];

  for (const tenant of rows) {
    try {
      await dbPushForSchema(tenant.schema);
      results.push({ id: tenant.id, name: tenant.name, schema: tenant.schema, status: "ok" });
    } catch (err) {
      results.push({ id: tenant.id, name: tenant.name, schema: tenant.schema, status: "error", error: err.message });
    }
  }

  return results;
}
