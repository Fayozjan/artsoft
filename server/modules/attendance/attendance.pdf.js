import { PDFDocument, rgb } from "pdf-lib";
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

import { getAttendanceService } from "./attendance.service.js";
import { prepareAttendanceData, filterAttendanceRows } from "../../utils/attendanceReportUtils.js";
import { getExcelLocale } from "../../utils/excelLocales.js";

// pdf-lib requires the @pdf-lib/fontkit fork specifically — see lateEmployees.pdf.js for details.
const require = createRequire(import.meta.url);
const fontkit = require("@pdf-lib/fontkit");

const FONTS_DIR = path.resolve(process.cwd(), "fonts");

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const MARGIN = 24;
const TITLE_GAP = 12;
const WRAP_LINE_HEIGHT = 9.5;
const WRAP_MAX_LINES = 2;
const HEADER_FONT_SIZE = 8;
const HEADER_LINE_HEIGHT = 9.5;
const HEADER_MAX_LINES = 2;
const HEADER_PADDING = 7;
const CELL_FONT_SIZE = 8;
const CELL_BORDER_WIDTH = 0.35;
const BORDER_COLOR = rgb(0.75, 0.75, 0.75);
const HEADER_BG = rgb(0.96, 0.96, 0.96);
const BRANCH_BAR_HEIGHT = 20;
const BRANCH_BAR_BG = rgb(0.93, 0.93, 0.93);

function sanitizeFileName(name) {
  const cleaned = String(name || "").replace(/[\\/:*?"<>|]/g, "").trim();
  return cleaned || "report";
}

function fitText(font, text, size, maxWidth) {
  const str = String(text ?? "");
  if (font.widthOfTextAtSize(str, size) <= maxWidth) return str;
  let t = str;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t.length ? `${t}…` : "";
}

function wrapText(font, text, size, maxWidth, maxLines = WRAP_MAX_LINES) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);

  if (lines.length > maxLines) lines.length = maxLines;
  const lastIdx = lines.length - 1;
  if (lastIdx >= 0) lines[lastIdx] = fitText(font, lines[lastIdx], size, maxWidth);
  return lines;
}

function drawCellText(page, text, { x, y, width, size, font, align = "center", color = rgb(0, 0, 0) }) {
  const fitted = fitText(font, text, size, width - 6);
  const textWidth = font.widthOfTextAtSize(fitted, size);
  const tx = align === "left" ? x + 4 : x + (width - textWidth) / 2;
  page.drawText(fitted, { x: tx, y, size, font, color });
}

function drawWrappedCellText(page, lines, { x, y, width, size, font, lineHeight, align = "center", color = rgb(0, 0, 0) }) {
  lines.forEach((line, i) => {
    const textWidth = font.widthOfTextAtSize(line, size);
    const tx = align === "left" ? x + 4 : x + (width - textWidth) / 2;
    page.drawText(line, { x: tx, y: y - i * lineHeight, size, font, color });
  });
}

function drawWrappingCell(page, text, { x, rowTop, rowHeight, width, size, font, align = "center" }) {
  const lines = wrapText(font, text, size, width - 8);
  const blockHeight = (lines.length - 1) * WRAP_LINE_HEIGHT;
  drawWrappedCellText(page, lines, {
    x,
    y: rowTop - rowHeight / 2 + blockHeight / 2 - 3,
    width,
    size,
    font,
    lineHeight: WRAP_LINE_HEIGHT,
    align,
  });
}

async function loadFonts(pdfDoc) {
  pdfDoc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(path.join(FONTS_DIR, "Bitter-Regular.ttf")),
    fs.readFile(path.join(FONTS_DIR, "Bitter-Bold.ttf")),
  ]);
  const font = await pdfDoc.embedFont(regularBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });
  return { font, boldFont };
}

// Плоская таблица (без группировки по филиалам) — режимы byBranch/byDepartments.
function renderFlatTable({ pdfDoc, font, boldFont, title, date, columns, rows, emptyLabel }) {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

  let page;
  let y;

  const drawHeaderRow = () => {
    const linesByCol = columns.map((col) =>
      wrapText(boldFont, col.label, HEADER_FONT_SIZE, col.width - 6, HEADER_MAX_LINES),
    );
    const maxLines = Math.max(...linesByCol.map((lines) => lines.length));
    const rowHeight = maxLines * HEADER_LINE_HEIGHT + HEADER_PADDING;

    let x = MARGIN;
    columns.forEach((col, idx) => {
      page.drawRectangle({ x, y: y - rowHeight, width: col.width, height: rowHeight, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
      const lines = linesByCol[idx];
      const blockHeight = (lines.length - 1) * HEADER_LINE_HEIGHT;
      drawWrappedCellText(page, lines, {
        x,
        y: y - rowHeight / 2 + blockHeight / 2 - 3,
        width: col.width,
        size: HEADER_FONT_SIZE,
        font: boldFont,
        lineHeight: HEADER_LINE_HEIGHT,
        align: "center",
      });
      x += col.width;
    });
    y -= rowHeight;
  };

  const startNewPage = (withTitle) => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;

    if (withTitle) {
      page.drawText(title, { x: MARGIN, y: y - 12, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(date, {
        x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(date, 9),
        y: y - 10,
        size: 9,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      y -= 12 + TITLE_GAP;
    }

    drawHeaderRow();
  };

  startNewPage(true);

  const ROW_HEIGHT = 22;
  const ensureSpace = () => {
    if (y - ROW_HEIGHT < MARGIN) startNewPage(false);
  };

  if (!rows.length) {
    page.drawText(emptyLabel, { x: MARGIN, y: y - 16, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
    return;
  }

  rows.forEach((row) => {
    ensureSpace();
    const rowTop = y;
    const textBaseline = rowTop - ROW_HEIGHT / 2 - 3;

    let x = MARGIN;
    columns.forEach((col) => {
      page.drawRectangle({ x, y: rowTop - ROW_HEIGHT, width: col.width, height: ROW_HEIGHT, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
      const value = row[col.key];
      if (col.wrap) {
        drawWrappingCell(page, value, { x, rowTop, rowHeight: ROW_HEIGHT, width: col.width, size: CELL_FONT_SIZE, font, align: col.align || "center" });
      } else {
        drawCellText(page, value, { x, y: textBaseline, width: col.width, size: CELL_FONT_SIZE, font, align: col.align || "center" });
      }
      x += col.width;
    });

    y -= ROW_HEIGHT;
  });
}

// Таблица с группировкой по филиалам (плашка-разделитель сверху группы) — режим byEmployees.
// Портировано из buildLateEmployeesPdfReport (lateEmployees.pdf.js), без колонки фото.
function renderEmployeesByBranchTable({ pdfDoc, font, boldFont, title, date, columns, employeeRows, emptyLabel, margin = MARGIN }) {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const ROW_HEIGHT = 30;

  let page;
  let y;

  const drawHeaderRow = () => {
    const linesByCol = columns.map((col) =>
      wrapText(boldFont, col.label, HEADER_FONT_SIZE, col.width - 6, HEADER_MAX_LINES),
    );
    const maxLines = Math.max(...linesByCol.map((lines) => lines.length));
    const rowHeight = maxLines * HEADER_LINE_HEIGHT + HEADER_PADDING;

    let x = margin;
    columns.forEach((col, idx) => {
      page.drawRectangle({ x, y: y - rowHeight, width: col.width, height: rowHeight, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
      const lines = linesByCol[idx];
      const blockHeight = (lines.length - 1) * HEADER_LINE_HEIGHT;
      drawWrappedCellText(page, lines, {
        x,
        y: y - rowHeight / 2 + blockHeight / 2 - 3,
        width: col.width,
        size: HEADER_FONT_SIZE,
        font: boldFont,
        lineHeight: HEADER_LINE_HEIGHT,
        align: "center",
      });
      x += col.width;
    });
    y -= rowHeight;
  };

  const startNewPage = (withTitle) => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - margin;

    if (withTitle) {
      page.drawText(title, { x: margin, y: y - 12, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(date, {
        x: PAGE_WIDTH - margin - font.widthOfTextAtSize(date, 9),
        y: y - 10,
        size: 9,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      y -= 12 + TITLE_GAP;
    }

    drawHeaderRow();
  };

  startNewPage(true);

  const ensureSpace = (height = ROW_HEIGHT) => {
    if (y - height < margin) startNewPage(false);
  };

  const drawBranchBar = (branchName) => {
    ensureSpace(BRANCH_BAR_HEIGHT);
    page.drawRectangle({ x: margin, y: y - BRANCH_BAR_HEIGHT, width: tableWidth, height: BRANCH_BAR_HEIGHT, color: BRANCH_BAR_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
    const label = branchName || "";
    const textWidth = boldFont.widthOfTextAtSize(label, 10);
    page.drawText(label, { x: margin + (tableWidth - textWidth) / 2, y: y - BRANCH_BAR_HEIGHT / 2 - 4, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    y -= BRANCH_BAR_HEIGHT;
  };

  if (!employeeRows.length) {
    page.drawText(emptyLabel, { x: MARGIN, y: y - 16, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
    return;
  }

  const branchGroups = new Map();
  const branchSortOrders = new Map();
  employeeRows.forEach((emp) => {
    const key = emp.branchName || "—";
    if (!branchGroups.has(key)) {
      branchGroups.set(key, []);
      branchSortOrders.set(key, emp.branchSortOrder ?? 0);
    }
    branchGroups.get(key).push(emp);
  });
  const sortedBranches = [...branchGroups.keys()].sort(
    (a, b) =>
      (branchSortOrders.get(a) ?? 0) - (branchSortOrders.get(b) ?? 0) ||
      a.localeCompare(b, "ru", { sensitivity: "base" }),
  );

  const byPositionThenDeptThenName = (a, b) =>
    (a.positionSortOrder ?? 0) - (b.positionSortOrder ?? 0) ||
    (a.departmentName || "").localeCompare(b.departmentName || "", "ru", { sensitivity: "base" }) ||
    (a.employeeFullName || "").localeCompare(b.employeeFullName || "", "ru", { sensitivity: "base" });

  for (const branchName of sortedBranches) {
    drawBranchBar(branchName);

    const sortedEmployees = [...branchGroups.get(branchName)].sort(byPositionThenDeptThenName);
    for (const row of sortedEmployees) {
      ensureSpace();
      const rowTop = y;
      const textBaseline = rowTop - ROW_HEIGHT / 2 - 3;

      let x = margin;
      columns.forEach((col) => {
        page.drawRectangle({ x, y: rowTop - ROW_HEIGHT, width: col.width, height: ROW_HEIGHT, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
        const value = row[col.key];
        if (col.wrap) {
          drawWrappingCell(page, value, { x, rowTop, rowHeight: ROW_HEIGHT, width: col.width, size: CELL_FONT_SIZE, font, align: col.align || "center" });
        } else {
          drawCellText(page, value, { x, y: textBaseline, width: col.width, size: CELL_FONT_SIZE, font, align: col.align || "center" });
        }
        x += col.width;
      });

      y -= ROW_HEIGHT;
    }
  }
}

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

function buildByBranchColumns(locale) {
  return [
    { key: "index", label: locale.number, width: 26, align: "center" },
    { key: "name", label: locale.branch, width: 110, align: "left", wrap: true },
    { key: "totalEmployees", label: locale.totalEmployees, width: 62, align: "center" },
    { key: "present", label: locale.present, width: 58, align: "center" },
    { key: "absent", label: locale.absent, width: 58, align: "center" },
    { key: "late", label: locale.late, width: 58, align: "center" },
    { key: "inside", label: locale.inside, width: 58, align: "center" },
    { key: "left", label: locale.left, width: 58, align: "center" },
  ];
}

function buildByDepartmentsColumns(locale) {
  return [
    { key: "index", label: locale.number, width: 22, align: "center" },
    { key: "branchName", label: locale.branch, width: 78, align: "left", wrap: true },
    { key: "name", label: locale.department, width: 88, align: "left", wrap: true },
    { key: "totalEmployees", label: locale.totalEmployees, width: 58, align: "center" },
    { key: "present", label: locale.present, width: 50, align: "center" },
    { key: "absent", label: locale.absent, width: 50, align: "center" },
    { key: "late", label: locale.late, width: 50, align: "center" },
    { key: "inside", label: locale.inside, width: 50, align: "center" },
    { key: "left", label: locale.left, width: 48, align: "center" },
  ];
}

const EMPLOYEES_TABLE_MARGIN = 10;

function buildByEmployeesColumns(locale) {
  const columns = [
    { key: "departmentName", label: locale.department, width: 78, align: "center", wrap: true },
    { key: "employeeFullName", label: locale.fullName, width: 125, align: "center", wrap: true },
    { key: "positionName", label: locale.position, width: 78, align: "center", wrap: true },
    { key: "firstEntry", label: locale.firstEntry, width: 55, align: "center" },
    { key: "turnstile", label: locale.turnstile, width: 65, align: "center", wrap: true },
    { key: "lateMinutes", label: locale.lateMinutes, width: 55, align: "center" },
    { key: "lastExit", label: locale.lastExit, width: 55, align: "center" },
  ];

  // Растянуть колонки на всю ширину листа (за вычетом узких полей страницы).
  const targetWidth = PAGE_WIDTH - 2 * EMPLOYEES_TABLE_MARGIN;
  const baseWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = targetWidth / baseWidth;
  const scaled = columns.map((col) => ({ ...col, width: col.width * scale }));
  scaled[scaled.length - 1].width += targetWidth - scaled.reduce((sum, col) => sum + col.width, 0);
  return scaled;
}

export async function buildAttendancePdfReport({ id, name, userId, date, displayMode, filter, language }) {
  const { data } = await getAttendanceService({ userId, filters: { date } });
  const prepared = prepareAttendanceData(data, { noBranch: "—", noDepartment: "—" });
  const rows = filterAttendanceRows(prepared, displayMode, filter);

  const locale = getExcelLocale(language);
  const pdfDoc = await PDFDocument.create();
  const { font, boldFont } = await loadFonts(pdfDoc);

  if (displayMode === "byEmployees") {
    const employeeRows = rows.map((e) => ({
      departmentName: e.departmentName || "",
      employeeFullName: e.employeeFullName || "",
      positionName: e.positionName || "",
      positionSortOrder: e.positionSortOrder ?? 0,
      firstEntry: e.firstEntry || "",
      turnstile: doorCellValue(e, locale),
      lateMinutes: fmtLate(e.lateMinutes),
      lastExit: e.lastExit || "",
      branchName: e.branchName || "",
      branchSortOrder: e.branchSortOrder ?? 0,
    }));

    renderEmployeesByBranchTable({
      pdfDoc,
      font,
      boldFont,
      title: locale.attendancePdfReportTitle,
      date,
      columns: buildByEmployeesColumns(locale),
      employeeRows,
      emptyLabel: locale.noAttendanceData,
      margin: EMPLOYEES_TABLE_MARGIN,
    });
  } else if (displayMode === "byDepartments") {
    const tableRows = rows.map((d, i) => ({
      index: i + 1,
      branchName: d.branchName || "",
      name: d.name,
      totalEmployees: d.totalEmployees,
      present: d.present,
      absent: d.absent,
      late: d.late,
      inside: d.inside,
      left: d.left,
    }));

    renderFlatTable({
      pdfDoc,
      font,
      boldFont,
      title: locale.attendancePdfReportTitle,
      date,
      columns: buildByDepartmentsColumns(locale),
      rows: tableRows,
      emptyLabel: locale.noAttendanceData,
    });
  } else {
    const tableRows = rows.map((b, i) => ({
      index: i + 1,
      name: b.name,
      totalEmployees: b.totalEmployees,
      present: b.present,
      absent: b.absent,
      late: b.late,
      inside: b.inside,
      left: b.left,
    }));

    renderFlatTable({
      pdfDoc,
      font,
      boldFont,
      title: locale.attendancePdfReportTitle,
      date,
      columns: buildByBranchColumns(locale),
      rows: tableRows,
      emptyLabel: locale.noAttendanceData,
    });
  }

  const dir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `cron-task-${id}-${date}.pdf`);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);

  const fileName = `${sanitizeFileName(name)}_${date}.pdf`;

  return { filePath, fileName };
}
