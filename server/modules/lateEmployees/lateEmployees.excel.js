import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs/promises";

import { getLateEmployeesService } from "./lateEmployees.service.js";
import { getExcelLocale } from "../../utils/excelLocales.js";
import { fmtLateMinutes, sanitizeFileName, filterLateRows } from "./lateEmployees.reportUtils.js";

const THIN_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const CENTER = { horizontal: "center", vertical: "middle" };

function applySheetStyles(sheet) {
  const colWidths = [];
  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.alignment = CENTER;
      if (rowNumber === 1) {
        cell.font = { bold: true };
      }
      const len = String(cell.value ?? "").length;
      colWidths[colNumber - 1] = Math.max(colWidths[colNumber - 1] || 0, len);
    });
  });
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = Math.max((w || 0) + 2, 8);
  });
}

export async function buildLateEmployeesExcelReport({ id, name, userId, date, filter, includeLunchLate, language }) {
  const { data } = await getLateEmployeesService({
    userId,
    filters: { mode: "day", date, include_lunch_late: includeLunchLate },
    page: 1,
    pageSize: 100000,
  });

  const rows = filterLateRows(data || [], filter);
  const locale = getExcelLocale(language);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(locale.sheetLateEmployees);
  sheet.columns = [
    { header: locale.number, key: "index" },
    { header: locale.branch, key: "branchName" },
    { header: locale.department, key: "departmentName" },
    { header: locale.fullName, key: "employeeFullName" },
    { header: locale.position, key: "positionName" },
    { header: locale.scheduledStart, key: "scheduledStart" },
    { header: locale.actualStart, key: "actualStart" },
    { header: locale.lateMinutes, key: "lateMinutes" },
    { header: locale.monthlyLateCount, key: "monthlyLateCount" },
    { header: locale.monthlyLateMinutes, key: "monthlyLateMinutes" },
  ];

  rows.forEach((e, i) =>
    sheet.addRow({
      index: i + 1,
      branchName: e.branchName || "",
      departmentName: e.departmentName || "",
      employeeFullName: e.employeeFullName || "",
      positionName: e.positionName || "",
      scheduledStart: e.scheduledStart || "",
      actualStart: e.actualStart || "",
      lateMinutes: fmtLateMinutes(e.lateMinutes),
      monthlyLateCount: e.monthlyArrivalLateCount || 0,
      monthlyLateMinutes: fmtLateMinutes(e.monthlyLateMinutes),
    }),
  );

  applySheetStyles(sheet);

  const dir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `cron-task-${id}-${date}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  const fileName = `${sanitizeFileName(name)}_${date}.xlsx`;

  return { filePath, fileName };
}
