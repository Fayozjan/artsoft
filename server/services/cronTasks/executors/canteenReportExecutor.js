import fs from "node:fs";
import { Bot } from "grammy";
import { DateTime } from "luxon";

import { buildCanteenExcelReport } from "../../../modules/canteen/canteen.excel.js";
import { getExcelLocale } from "../../../utils/excelLocales.js";
import { CronTasksModel } from "../../../modules/cronTasks/cronTasks.model.js";
import { getChatIds, sendDocumentToChats } from "./chatIds.js";
import { CRON_ACTOR_ID } from "../../../utils/cronActor.js";

const ZONE = "Asia/Tashkent";

// Отчёт столовой — за период, а не за один день: задача, запущенная ночью,
// обычно должна отчитаться за вчера, а месячная — за прошлый месяц.
export function resolveCanteenPeriod(period, now = DateTime.now().setZone(ZONE)) {
  switch (period) {
    case "yesterday": {
      const day = now.minus({ days: 1 });
      return { from: day.toISODate(), to: day.toISODate() };
    }
    case "week":
      return { from: now.minus({ days: 6 }).toISODate(), to: now.toISODate() };
    case "month":
      return { from: now.startOf("month").toISODate(), to: now.toISODate() };
    case "prev_month": {
      const prev = now.minus({ months: 1 });
      return { from: prev.startOf("month").toISODate(), to: prev.endOf("month").toISODate() };
    }
    default:
      return { from: now.toISODate(), to: now.toISODate() };
  }
}

export async function runCanteenReportTask(row) {
  const { period, filter, language } = row.config;
  const { from, to } = resolveCanteenPeriod(period);
  const chatIds = getChatIds(row.config);
  let filePath;

  try {
    if (!process.env.BOT_TOKEN) {
      throw new Error("BOT_TOKEN не задан");
    }

    let fileName;
    let totals;
    ({ filePath, fileName, totals } = await buildCanteenExcelReport({
      id: row.id,
      name: row.name,
      userId: CRON_ACTOR_ID,
      dateFrom: from,
      dateTo: to,
      filter,
      language,
    }));

    const periodText = from === to ? from : `${from} — ${to}`;
    const locale = getExcelLocale(language);

    // Подпись показывает выданное против нормы за период («2 из 64 порций»),
    // а не выдано/отказы: норма — то, с чем сравнивают в чате.
    const portionsLine = totals
      ? locale.captionPortions
          .replace("{served}", totals.served)
          .replace("{total}", totals.allowance)
      : null;

    const caption =
      `🍽 <b>${row.name}</b>\n📅 ${periodText}` +
      (portionsLine ? `\n✅ ${portionsLine}` : "");

    const bot = new Bot(process.env.BOT_TOKEN);
    const failed = await sendDocumentToChats(bot, chatIds, filePath, fileName, {
      caption,
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
