import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { Bot } from "grammy";
import { DateTime } from "luxon";

import { CronTasksModel } from "../../../modules/cronTasks/cronTasks.model.js";
import { getChatIds, sendDocumentToChats } from "./chatIds.js";

const execFilePromise = promisify(execFile);

export async function runDatabaseBackupTask(row) {
  const chatIds = getChatIds(row.config);
  const { DB_NAME, DB_USER, DB_PASSWORD, PG_DUMP_PATH, SERVER_TYPE } = process.env;

  const date = DateTime.now().setZone("Asia/Tashkent").toFormat("yyyy-MM-dd");
  const backupFileName = `backup-${row.id}-${date}.sql`;
  const backupPath = path.resolve(process.cwd(), backupFileName);

  const env = {
    ...process.env,
    PGPASSWORD: DB_PASSWORD,
    PATH: SERVER_TYPE === "WINDOWS" ? `${process.env.PATH};${PG_DUMP_PATH}` : process.env.PATH,
  };

  const args = ["-U", DB_USER, "-F", "c", "-f", backupPath, DB_NAME];

  try {
    if (!process.env.BOT_TOKEN) {
      throw new Error("BOT_TOKEN не задан");
    }

    await execFilePromise("pg_dump", args, { env });

    const bot = new Bot(process.env.BOT_TOKEN);
    const failed = await sendDocumentToChats(bot, chatIds, backupPath, backupFileName, {
      caption: `📦 <b>${row.name}</b>\n📅 ${date}`,
      parse_mode: "HTML",
    });

    await CronTasksModel.update(row.id, {
      last_run_at: new Date(),
      last_run_status: "success",
      last_run_error: failed.length ? failed.join("; ") : null,
    });

    return { success: true, error: failed.length ? failed.join("; ") : null };
  } catch (err) {
    await CronTasksModel.update(row.id, {
      last_run_at: new Date(),
      last_run_status: "error",
      last_run_error: err.message,
    });
    throw err;
  } finally {
    if (fs.existsSync(backupPath)) {
      await fs.promises.unlink(backupPath);
    }
  }
}
