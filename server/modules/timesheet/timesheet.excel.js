import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs/promises";

import { getMonthTimesheet } from "./timesheet.service.js";
import { getExcelLocale } from "../../utils/excelLocales.js";

const THIN_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

function sanitizeFileName(name) {
  const cleaned = String(name || "").replace(/[\\/:*?"<>|]/g, "").trim();
  return cleaned || "report";
}

function daysInMonth(year, monthValue) {
  return new Date(year, monthValue, 0).getDate();
}

// event.parsedDate — Date-объект (см. parseEventDate в attendanceUtils.js), уже сдвинутый
// на UTC+5 — не ISO-строка (в отличие от client/src/utils/DownloadAttendanceToExcel.js,
// где данные прошли через JSON и Date сериализовался в строку).
function formatEventTime(date) {
  if (!date) return "--:--";
  return [date.getUTCHours(), date.getUTCMinutes()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

// summary: приход/уход/часы за день (компактно). detailed: все события за день
// (каждый вход/выход с турникетом), как downloadFullAttendanceToExcel (DownloadAttendanceToExcel.js).
function buildDayCell(session, reportType) {
  if (!session) return "";

  if (reportType === "detailed") {
    if (!session.events?.length) return "";
    const eventsText = session.events
      .map((event) => {
        const time = formatEventTime(event.parsedDate);
        const door = event.doorName ? ` (${event.doorName})` : "";
        return `${time}${door}`;
      })
      .join("\n");
    return `${eventsText}\n----------\n${session.workDuration || "00:00"}`;
  }

  if (!session.firstEntry) return "";
  return `${session.firstEntry}\n${session.lastExit || "-"}\n${session.workDuration || "00:00"}`;
}

// Табель за месяц: строка на сотрудника, колонка на день месяца.
// Набор колонок смоделирован по client/src/utils/DownloadAttendanceToExcel.js.
export async function buildTabelExcelReport({ id, name, userId, month, filter, language, reportType }) {
  const [year, monthValue] = month.split("-").map(Number);
  const days = daysInMonth(year, monthValue);
  const locale = getExcelLocale(language);

  const { processedEvents } = await getMonthTimesheet({ userId, month, filter });

  const rows = [...processedEvents].sort(
    (a, b) =>
      (a.branchName || "").localeCompare(b.branchName || "", "ru", { sensitivity: "base" }) ||
      (a.departmentName || "").localeCompare(b.departmentName || "", "ru", { sensitivity: "base" }) ||
      (a.employeeFullName || "").localeCompare(b.employeeFullName || "", "ru", { sensitivity: "base" }),
  );

  const headers = [
    locale.branch,
    locale.department,
    locale.fullName,
    locale.tabNumber,
    locale.position,
    locale.daysWorked,
    locale.totalHours,
    ...Array.from({ length: days }, (_, i) => String(i + 1)),
  ];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(locale.sheetTabel);
  sheet.addRow(headers);

  rows.forEach((emp) => {
    let totalMinutes = 0;
    let workedDays = 0;
    const dayCells = [];

    for (let day = 1; day <= days; day++) {
      const dateStr = `${year}-${String(monthValue).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const session = emp.sessions?.[dateStr];
      dayCells.push(buildDayCell(session, reportType));

      if (session?.firstEntry) {
        const [h, m] = (session.workDuration || "00:00").split(":").map(Number);
        totalMinutes += h * 60 + m;
        workedDays++;
      }
    }

    sheet.addRow([
      emp.branchName ?? "",
      emp.departmentName ?? "",
      emp.employeeFullName ?? "",
      emp.employeeId ?? "",
      emp.positionName ?? "",
      workedDays,
      `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`,
      ...dayCells,
    ]);
  });

  const HEADER_WIDTHS = [24, 24, 42, 12, 18, 8, 10]; // филиал/отдел/ФИО/таб.номер/должность/дней/итого
  sheet.columns = headers.map((_, i) => ({ width: HEADER_WIDTHS[i] ?? 12 }));

  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      if (rowNumber === 1) cell.font = { bold: true };
    });
  });

  const dir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `cron-task-${id}-${month}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  const fileName = `${sanitizeFileName(name)}_${month}.xlsx`;

  return { filePath, fileName };
}
