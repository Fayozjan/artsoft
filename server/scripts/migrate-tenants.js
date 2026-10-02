import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import { migrateAllTenants } from "../utils/provisionTenant.js";
import pool from "../db.js";

console.log("Running db push on all tenant schemas...\n");

migrateAllTenants()
  .then((results) => {
    for (const r of results) {
      const mark = r.status === "ok" ? "✅" : "❌";
      const detail = r.error ? ` — ${r.error}` : "";
      console.log(`${mark} [${r.schema}] ${r.name}${detail}`);
    }
    const failed = results.filter((r) => r.status === "error").length;
    console.log(`\nDone. ${results.length - failed}/${results.length} succeeded.`);
  })
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
