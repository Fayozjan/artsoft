import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs/promises";

import { CanteenService } from "./canteen.service.js";
import { getExcelLocale } from "../../utils/excelLocales.js";
import { sanitizeFileName } from "../lateEmployees/lateEmployees.reportUtils.js";

const THIN_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const CENTER = { horizontal: "center", vertical: "middle" };

// Колонка «сотрудников получили» имеет смысл только там, где строка — коллектив:
// у группировки по сотруднику это всегда 0 или 1 (как в CanteenReportPage.jsx).
const SUMMARY_GROUPS = ["branch", "department"];

function applySheetStyles(sheet, headerRowNumber, totalRowNumber) {
  const colWidths = [];
  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (rowNumber >= headerRowNumber) {
        cell.border = THIN_BORDER;
        cell.alignment = CENTER;
      }
      if (rowNumber === headerRowNumber || rowNumber === totalRowNumber) {
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

export async function buildCanteenExcelReport({ id, name, userId, dateFrom, dateTo, filter, language }) {
  const { data, totals, period, group_by } = await CanteenService.getReport({
    userId,
    filters: { ...filter, date_from: dateFrom, date_to: dateTo },
  });

  const locale = getExcelLocale(language);
  const byEmployee = group_by === "employee";
  const showEmployees = SUMMARY_GROUPS.includes(group_by);

  const groupHeader =
    group_by === "branch" ? locale.branch : group_by === "department" ? locale.department : locale.fullName;

  const columns = [
    { header: locale.number, key: "index" },
    { header: groupHeader, key: "label" },
    ...(byEmployee
      ? [
          { header: locale.tabNumber, key: "employeeNumber" },
          { header: locale.branch, key: "branchName" },
          { header: locale.department, key: "departmentName" },
        ]
      : []),
    { header: locale.portionNorm, key: "allowance" },
    { header: locale.servedPortions, key: "served" },
    { header: locale.deniedPortions, key: "denied" },
    ...(showEmployees ? [{ header: locale.employeesServed, key: "employeesServed" }] : []),
  ];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(locale.sheetCanteen);

  // Шапка с периодом — над таблицей, поэтому columns задаём без header'ов,
  // а строку заголовков добавляем вручную третьей.
  sheet.addRow([locale.canteenReportTitle]).font = { bold: true };
  sheet.addRow([`${locale.reportPeriod}: ${period.date_from} — ${period.date_to}`]);
  const headerRow = sheet.addRow(columns.map((c) => c.header));
  sheet.columns = columns.map(({ key }) => ({ key }));

  const rows = data || [];
  if (!rows.length) {
    sheet.addRow([locale.noCanteenData]);
  }

  rows.forEach((row, i) =>
    sheet.addRow({
      index: i + 1,
      label: row.label || "",
      employeeNumber: row.employeeNumber || "",
      branchName: row.branchName || "",
      departmentName: row.departmentName || "",
      allowance: row.allowance || 0,
      served: row.served || 0,
      denied: row.denied || 0,
      employeesServed: row.employees_served || 0,
    }),
  );

  let totalRowNumber = null;
  if (totals && rows.length) {
    const totalRow = sheet.addRow({
      index: "",
      label: locale.total,
      employeeNumber: "",
      branchName: "",
      departmentName: "",
      allowance: totals.allowance || 0,
      served: totals.served || 0,
      denied: totals.denied || 0,
      employeesServed: totals.employees_served || 0,
    });
    totalRowNumber = totalRow.number;
  }

  applySheetStyles(sheet, headerRow.number, totalRowNumber);

  const dir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const suffix = period.date_from === period.date_to ? period.date_from : `${period.date_from}_${period.date_to}`;
  const filePath = path.join(dir, `cron-task-${id}-${suffix}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  const fileName = `${sanitizeFileName(name)}_${suffix}.xlsx`;

  return { filePath, fileName, period, totals };
}
