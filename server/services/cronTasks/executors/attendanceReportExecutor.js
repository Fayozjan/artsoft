import fs from "node:fs";
import { Bot } from "grammy";
import { DateTime } from "luxon";

import { buildAttendanceExcelReport } from "../../../modules/attendance/attendance.excel.js";
import { buildAttendancePdfReport } from "../../../modules/attendance/attendance.pdf.js";
import { CronTasksModel } from "../../../modules/cronTasks/cronTasks.model.js";
import { getChatIds, sendDocumentToChats } from "./chatIds.js";
import { CRON_ACTOR_ID } from "../../../utils/cronActor.js";

export async function runAttendanceReportTask(row) {
  const date = DateTime.now().setZone("Asia/Tashkent").toFormat("yyyy-MM-dd");
  const { display_mode, filter, language, format } = row.config;
  const chatIds = getChatIds(row.config);
  let filePath;

  try {
    if (!process.env.BOT_TOKEN) {
      throw new Error("BOT_TOKEN не задан");
    }

    const buildReport = format === "pdf" ? buildAttendancePdfReport : buildAttendanceExcelReport;

    let fileName;
    ({ filePath, fileName } = await buildReport({
      id: row.id,
      name: row.name,
      userId: CRON_ACTOR_ID,
      date,
      displayMode: display_mode,
      filter,
      language,
    }));

    const bot = new Bot(process.env.BOT_TOKEN);
    const failed = await sendDocumentToChats(bot, chatIds, filePath, fileName, {
      caption: `📊 <b>${row.name}</b>\n📅 ${date}`,
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
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }
}
