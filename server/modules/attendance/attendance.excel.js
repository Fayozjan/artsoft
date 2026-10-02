import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs/promises";

import { getAttendanceService } from "./attendance.service.js";
import { prepareAttendanceData, filterAttendanceRows } from "../../utils/attendanceReportUtils.js";
import { getExcelLocale } from "../../utils/excelLocales.js";

const THIN_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const CENTER = { horizontal: "center", vertical: "middle" };
const MAX_COL_WIDTH = 25;

function fmtLate(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function doorCellValue(e, locale) {
  if (e.firstEntryDoor) return e.firstEntryDoor;
  if (!e.timeOffInfo) return "";
  const reason = e.timeOffInfo.reason ? ` (${e.timeOffInfo.reason})` : "";
  return `${locale.excusedLeave}${reason}`;
}

function sanitizeFileName(name) {
  const cleaned = String(name || "").replace(/[\\/:*?"<>|]/g, "").trim();
  return cleaned || "report";
}

// Стилизация: тонкая чёрная рамка на всех ячейках, центрирование, ширина колонки по самому длинному
// значению в ней (но не больше MAX_COL_WIDTH — если значение не влезает, ячейка переносится по словам).
// getHeaderFont(rowNumber) возвращает font для строк-заголовков (или null для обычных строк).
// columnWidthOverrides — { [colNumber]: { min, max } } для колонок с известным содержимым
// (напр. ФИО — шире; колонки со временем чч:мм — уже), переопределяет дефолтные min 8 / max MAX_COL_WIDTH.
// columnAlignOverrides — { [colNumber]: "left" } — горизонтальное выравнивание значений (не заголовков).
function styleAndSizeSheet(sheet, getHeaderFont, columnWidthOverrides = {}, columnAlignOverrides = {}) {
  const colWidths = [];
  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = THIN_BORDER;
      const font = getHeaderFont ? getHeaderFont(rowNumber) : null;
      const horizontal = !font && columnAlignOverrides[colNumber] ? columnAlignOverrides[colNumber] : "center";
      cell.alignment = { horizontal, vertical: "middle" };
      if (font) cell.font = font;
      const len = String(cell.value ?? "").length;
      colWidths[colNumber - 1] = Math.max(colWidths[colNumber - 1] || 0, len);
    });
  });

  const finalWidths = colWidths.map((w, i) => {
    const override = columnWidthOverrides[i + 1] || {};
    return Math.min(Math.max((w || 0) + 2, override.min ?? 8), override.max ?? MAX_COL_WIDTH);
  });
  finalWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const len = String(cell.value ?? "").length;
      if (len > finalWidths[colNumber - 1]) {
        const font = getHeaderFont ? getHeaderFont(rowNumber) : null;
        const horizontal = !font && columnAlignOverrides[colNumber] ? columnAlignOverrides[colNumber] : "center";
        cell.alignment = { horizontal, vertical: "middle", wrapText: true };
      }
    });
  });
}

function applySheetStyles(sheet) {
  styleAndSizeSheet(sheet, (rowNumber) => (rowNumber === 1 ? { bold: true } : null));
}

// Наборы колонок смоделированы по client/src/utils/DocGenerator.js (downloadAttendanceModeSheet).
// Заголовки берутся из locale (см. utils/excelLocales.js) — зависят от языка, выбранного в конфиге крон-задачи.
function buildSheets(locale) {
  return {
    byBranch: {
      name: locale.sheetByBranch,
      columns: [
        { header: locale.number, key: "index" },
        { header: locale.branch, key: "name" },
        { header: locale.totalEmployees, key: "totalEmployees" },
        { header: locale.present, key: "present" },
        { header: locale.absent, key: "absent" },
        { header: locale.late, key: "late" },
        { header: locale.inside, key: "inside" },
        { header: locale.left, key: "left" },
      ],
      row: (b, i) => ({
        index: i + 1,
        name: b.name,
        totalEmployees: b.totalEmployees,
        present: b.present,
        absent: b.absent,
        late: b.late,
        inside: b.inside,
        left: b.left,
      }),
    },
    byDepartments: {
      name: locale.sheetByDepartments,
      columns: [
        { header: locale.number, key: "index" },
        { header: locale.branch, key: "branchName" },
        { header: locale.department, key: "name" },
        { header: locale.totalEmployees, key: "totalEmployees" },
        { header: locale.present, key: "present" },
        { header: locale.absent, key: "absent" },
        { header: locale.late, key: "late" },
        { header: locale.inside, key: "inside" },
        { header: locale.left, key: "left" },
      ],
      row: (d, i) => ({
        index: i + 1,
        branchName: d.branchName || "",
        name: d.name,
        totalEmployees: d.totalEmployees,
        present: d.present,
        absent: d.absent,
        late: d.late,
        inside: d.inside,
        left: d.left,
      }),
    },
  };
}

// Портировано из buildEmployeesByBranchSheet (DocGenerator.js) — единственный лист в режиме byEmployees.
// Строится из уже отфильтрованных строк (rows), а не из всех сотрудников — так же, как на клиенте.
function addEmployeesByBranchSheet(workbook, filteredEmployeeRows, locale) {
  const columns = [
    locale.department,
    locale.fullName,
    locale.position,
    locale.firstEntry,
    locale.turnstile,
    locale.lateMinutes,
    locale.lastExit,
  ];
  const colCount = columns.length;

  const branchesMap = new Map();
  filteredEmployeeRows.forEach((e) => {
    const key = e.branchName || "";
    if (!branchesMap.has(key)) {
      branchesMap.set(key, { name: key, sort_order: e.branchSortOrder ?? 0, employees: [] });
    }
    branchesMap.get(key).employees.push(e);
  });

  const branchesData = [...branchesMap.values()].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      (a.name || "").localeCompare(b.name || "", "ru", { sensitivity: "base" }),
  );

  const sheet = workbook.addWorksheet(locale.sheetEmployeesByBranch);
  const branchHeaderRows = new Set();
  const columnHeaderRows = new Set();

  branchesData.forEach((branch) => {
    const branchRow = sheet.addRow([branch.name, ...Array(colCount - 1).fill("")]);
    branchHeaderRows.add(branchRow.number);
    sheet.mergeCells(branchRow.number, 1, branchRow.number, colCount);

    const headerRow = sheet.addRow(columns);
    columnHeaderRows.add(headerRow.number);

    const sortedEmployees = [...branch.employees].sort((a, b) =>
      (a.positionSortOrder ?? 0) - (b.positionSortOrder ?? 0) ||
      (a.departmentName || "").localeCompare(b.departmentName || "", "ru", { sensitivity: "base" }) ||
      (a.employeeFullName || "").localeCompare(b.employeeFullName || "", "ru", { sensitivity: "base" }),
    );

    sortedEmployees.forEach((e) => {
      sheet.addRow([
        e.departmentName || "",
        e.employeeFullName || "",
        e.positionName || "",
        e.firstEntry || "",
        doorCellValue(e, locale),
        fmtLate(e.lateMinutes),
        e.lastExit || "",
      ]);
    });
  });

  styleAndSizeSheet(
    sheet,
    (rowNumber) => {
      if (branchHeaderRows.has(rowNumber)) return { bold: true, size: 12 };
      if (columnHeaderRows.has(rowNumber)) return { bold: true };
      return null;
    },
    {
      2: { min: 30, max: 40 }, // ФИО — шире
      4: { max: 10 }, // Пришел — только время чч:мм
      [colCount]: { max: 10 }, // Ушел (последняя колонка) — только время чч:мм
    },
    {
      1: "left",
      2: "left",
    },
  );
}

export async function buildAttendanceExcelReport({ id, name, userId, date, displayMode, filter, language }) {
  const { data } = await getAttendanceService({ userId, filters: { date } });
  const prepared = prepareAttendanceData(data, { noBranch: "—", noDepartment: "—" });
  const rows = filterAttendanceRows(prepared, displayMode, filter);

  const locale = getExcelLocale(language);
  const workbook = new ExcelJS.Workbook();

  if (displayMode === "byEmployees") {
    addEmployeesByBranchSheet(workbook, rows, locale);
  } else {
    const sheets = buildSheets(locale);
    const sheetConfig = sheets[displayMode] || sheets.byBranch;
    const sheet = workbook.addWorksheet(sheetConfig.name);
    sheet.columns = sheetConfig.columns;

    rows.forEach((row, i) => sheet.addRow(sheetConfig.row(row, i)));
    applySheetStyles(sheet);
  }

  const dir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `cron-task-${id}-${date}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  const fileName = `${sanitizeFileName(name)}_${date}.xlsx`;

  return { filePath, fileName };
}
