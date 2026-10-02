import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { Bot } from "grammy";
import { DateTime } from "luxon";

import { buildAttendancePdfReport } from "../../../modules/attendance/attendance.pdf.js";
import {
  buildLateEmployeesPdfReport,
  buildLateByBranchMonthlyPdfReport,
} from "../../../modules/lateEmployees/lateEmployees.pdf.js";
import { buildTimeOffPdfReport } from "../../../modules/timeOff/timeOff.pdf.js";
import { buildStaffingPdfReport } from "../../../modules/staffingPosition/staffingPosition.pdf.js";
import { sanitizeFileName } from "../../../modules/lateEmployees/lateEmployees.reportUtils.js";
import { CronTasksModel } from "../../../modules/cronTasks/cronTasks.model.js";
import { getChatIds, sendDocumentToChats } from "./chatIds.js";
import { getExcelLocale } from "../../../utils/excelLocales.js";
import { CRON_ACTOR_ID } from "../../../utils/cronActor.js";

// Один PDF из 5 отчётов: Посещаемость → Опоздания → Опоздания по филиалам (за месяц) → Заявки на отсутствие → Штатное расписание.
// Билдеры вызываются последовательно и сразу дочитываются в merged — коллизий имён временных файлов
// (все пишут cron-task-{id}-{date}.pdf) не возникает, т.к. каждый файл читается до вызова следующего билдера.
export async function runReportsBundleTask(row) {
  const date = DateTime.now().setZone("Asia/Tashkent").toFormat("yyyy-MM-dd");
  const { language, include_lunch_late, filter } = row.config;
  const chatIds = getChatIds(row.config);
  const branches = filter.branches || [];
  // branches — имена филиалов (как в filterAttendanceRows/filterLateRows), не id.
  const employeeFilter = { branches, departments: [], employees: filter.employees || [], positions: [] };

  const tempPaths = [];
  let mergedPath;

  try {
    if (!process.env.BOT_TOKEN) {
      throw new Error("BOT_TOKEN не задан");
    }

    const merged = await PDFDocument.create();

    const appendReport = async (buildFn, args) => {
      const { filePath } = await buildFn(args);
      tempPaths.push(filePath);
      const bytes = await fs.promises.readFile(filePath);
      const src = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    };

    await appendReport(buildAttendancePdfReport, {
      id: row.id,
      name: row.name,
      userId: CRON_ACTOR_ID,
      date,
      displayMode: "byEmployees",
      filter: employeeFilter,
      language,
    });

    await appendReport(buildLateEmployeesPdfReport, {
      id: row.id,
      name: row.name,
      userId: CRON_ACTOR_ID,
      date,
      filter: employeeFilter,
      includeLunchLate: include_lunch_late,
      language,
    });

    await appendReport(buildLateByBranchMonthlyPdfReport, {
      id: row.id,
      name: row.name,
      userId: CRON_ACTOR_ID,
      date,
      filter: { branches },
      includeLunchLate: include_lunch_late,
      language,
    });

    await appendReport(buildTimeOffPdfReport, {
      id: row.id,
      name: row.name,
      userId: CRON_ACTOR_ID,
      date,
      filter: employeeFilter,
      language,
    });

    await appendReport(buildStaffingPdfReport, {
      id: row.id,
      name: row.name,
      userId: CRON_ACTOR_ID,
      date,
      filter: { branches },
      language,
    });

    const dir = path.resolve(process.cwd(), "uploads");
    await fs.promises.mkdir(dir, { recursive: true });
    mergedPath = path.join(dir, `cron-task-${row.id}-bundle-${date}.pdf`);
    await fs.promises.writeFile(mergedPath, await merged.save());

    const fileName = `${sanitizeFileName(row.name)}_${date}.pdf`;

    const locale = getExcelLocale(language);
    const sectionsLine = [
      locale.attendancePdfReportTitle,
      locale.pdfReportTitle,
      locale.lateByBranchPdfReportTitle,
      locale.timeOffPdfReportTitle,
      locale.staffingPdfReportTitle,
    ].join(", ");

    const bot = new Bot(process.env.BOT_TOKEN);
    const failed = await sendDocumentToChats(bot, chatIds, mergedPath, fileName, {
      caption: `📊 <b>${row.name}</b>\n📅 ${date}\n${sectionsLine}`,
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
    for (const p of [...tempPaths, mergedPath]) {
      if (p && fs.existsSync(p)) {
        await fs.promises.unlink(p);
      }
    }
  }
}
