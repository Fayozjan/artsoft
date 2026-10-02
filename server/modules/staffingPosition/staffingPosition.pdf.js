import { PDFDocument, rgb } from "pdf-lib";
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

import { UserModel } from "../users/users.model.js";
import { buildDepartmentAccess } from "../departments/departments.helpers.js";
import { DepartmentsModel } from "../departments/departments.model.js";
import { getExcelLocale } from "../../utils/excelLocales.js";
import { sanitizeFileName } from "../lateEmployees/lateEmployees.reportUtils.js";

// pdf-lib requires the @pdf-lib/fontkit fork specifically — see lateEmployees.pdf.js для деталей.
const require = createRequire(import.meta.url);
const fontkit = require("@pdf-lib/fontkit");

const FONTS_DIR = path.resolve(process.cwd(), "fonts");

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const MARGIN = 24;
const TITLE_GAP = 12;
const ROW_HEIGHT = 26;
const WRAP_LINE_HEIGHT = 9.5;
const WRAP_MAX_LINES = 2;
const HEADER_HEIGHT = 24;
const HEADER_FONT_SIZE = 8;
const CELL_FONT_SIZE = 8.5;
const CELL_BORDER_WIDTH = 0.35;
const BORDER_COLOR = rgb(0.75, 0.75, 0.75);
const HEADER_BG = rgb(0.96, 0.96, 0.96);
const TOTAL_BG = rgb(0.93, 0.93, 0.93);

const WRAPPING_COLUMNS = new Set(["branchName"]);

const BASE_COLUMNS = [
  { key: "index", width: 26, align: "center" },
  { key: "branchName", width: 260, align: "left" },
  { key: "planned", width: 110, align: "center" },
  { key: "actual", width: 100, align: "center" },
  { key: "inStaff", width: 100, align: "center" },
  { key: "nonStaffed", width: 110, align: "center" },
  { key: "vacancies", width: 110, align: "center" },
];

function buildColumns() {
  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  const baseSum = BASE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
  const remainder = tableWidth - baseSum;
  return BASE_COLUMNS.map((col) => (col.key === "branchName" ? { ...col, width: col.width + remainder } : { ...col }));
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

function drawWrappedCellText(page, lines, { x, y, width, size, font, lineHeight, align = "left", color = rgb(0, 0, 0) }) {
  lines.forEach((line, i) => {
    const textWidth = font.widthOfTextAtSize(line, size);
    const tx = align === "left" ? x + 4 : x + (width - textWidth) / 2;
    page.drawText(line, { x: tx, y: y - i * lineHeight, size, font, color });
  });
}

function drawWrappingCell(page, text, { x, rowTop, rowHeight, width, size, font, align }) {
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

export async function buildStaffingPdfReport({ id, name, userId, date, filter, language }) {
  const user = await UserModel.getById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");

  const where = buildDepartmentAccess(user);
  const allRows = await DepartmentsModel.getStaffingOverview(where);
  const deptRows = filter?.branches?.length
    ? allRows.filter((d) => filter.branches.includes(d.branch_name))
    : allRows;

  // Свёрнуто по филиалу — по отделам не выводим (см. правку крон-задачи reports_bundle).
  const branchMap = new Map();
  for (const d of deptRows) {
    const key = d.branch_name || "—";
    if (!branchMap.has(key)) {
      branchMap.set(key, { branchName: key, planned: 0, actual: 0, nonStaffed: 0, vacancies: 0 });
    }
    const b = branchMap.get(key);
    b.planned += d.planned || 0;
    b.actual += d.actual || 0;
    b.nonStaffed += d.non_staffed || 0;
    b.vacancies += d.vacancies || 0;
  }
  const rows = [...branchMap.values()].sort((a, b) => a.branchName.localeCompare(b.branchName, "ru", { sensitivity: "base" }));

  const locale = getExcelLocale(language);
  const columns = buildColumns();

  const headerLabels = {
    index: locale.number,
    branchName: locale.branch,
    planned: locale.staffingPlan,
    actual: locale.staffingActual,
    nonStaffed: locale.staffingNonStaffed,
    inStaff: locale.staffingInStaff,
    vacancies: locale.staffingVacancies,
  };

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(path.join(FONTS_DIR, "Bitter-Regular.ttf")),
    fs.readFile(path.join(FONTS_DIR, "Bitter-Bold.ttf")),
  ]);
  const font = await pdfDoc.embedFont(regularBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });

  let page;
  let y;

  const drawHeaderRow = () => {
    let x = MARGIN;
    columns.forEach((col) => {
      page.drawRectangle({ x, y: y - HEADER_HEIGHT, width: col.width, height: HEADER_HEIGHT, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
      const lines = wrapText(boldFont, headerLabels[col.key], HEADER_FONT_SIZE, col.width - 6, 2);
      const blockHeight = (lines.length - 1) * WRAP_LINE_HEIGHT;
      drawWrappedCellText(page, lines, {
        x,
        y: y - HEADER_HEIGHT / 2 + blockHeight / 2 - 3,
        width: col.width,
        size: HEADER_FONT_SIZE,
        font: boldFont,
        lineHeight: WRAP_LINE_HEIGHT,
        align: "center",
      });
      x += col.width;
    });
    y -= HEADER_HEIGHT;
  };

  const startNewPage = (withTitle) => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;

    if (withTitle) {
      page.drawText(locale.staffingPdfReportTitle, { x: MARGIN, y: y - 12, size: 12, font: boldFont, color: rgb(0, 0, 0) });
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

  const ensureSpace = () => {
    if (y - ROW_HEIGHT < MARGIN) startNewPage(false);
  };

  if (!rows.length) {
    page.drawText(locale.noStaffingData, { x: MARGIN, y: y - 16, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
  }

  const totals = { planned: 0, actual: 0, nonStaffed: 0, inStaff: 0, vacancies: 0 };

  rows.forEach((d, index) => {
    ensureSpace();
    const rowTop = y;
    const textBaseline = rowTop - ROW_HEIGHT / 2 - 3;

    const planned = d.planned || 0;
    const actual = d.actual || 0;
    const nonStaffed = d.nonStaffed || 0;
    const vacancies = d.vacancies || 0;
    const inStaff = actual - nonStaffed;

    totals.planned += planned;
    totals.actual += actual;
    totals.nonStaffed += nonStaffed;
    totals.inStaff += inStaff;
    totals.vacancies += vacancies;

    const values = {
      index: index + 1,
      branchName: d.branchName || "",
      planned,
      actual,
      nonStaffed,
      inStaff,
      vacancies,
    };

    let x = MARGIN;
    for (const col of columns) {
      page.drawRectangle({ x, y: rowTop - ROW_HEIGHT, width: col.width, height: ROW_HEIGHT, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });

      if (WRAPPING_COLUMNS.has(col.key)) {
        drawWrappingCell(page, values[col.key], { x, rowTop, rowHeight: ROW_HEIGHT, width: col.width, size: CELL_FONT_SIZE, font, align: col.align });
      } else {
        drawCellText(page, String(values[col.key]), { x, y: textBaseline, width: col.width, size: CELL_FONT_SIZE, font, align: col.align });
      }

      x += col.width;
    }

    y -= ROW_HEIGHT;
  });

  if (rows.length) {
    ensureSpace();
    const rowTop = y;
    const textBaseline = rowTop - ROW_HEIGHT / 2 - 3;

    const totalValues = {
      index: "",
      branchName: locale.total,
      planned: totals.planned,
      actual: totals.actual,
      nonStaffed: totals.nonStaffed,
      inStaff: totals.inStaff,
      vacancies: totals.vacancies,
    };

    let x = MARGIN;
    for (const col of columns) {
      page.drawRectangle({ x, y: rowTop - ROW_HEIGHT, width: col.width, height: ROW_HEIGHT, color: TOTAL_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
      drawCellText(page, String(totalValues[col.key]), { x, y: textBaseline, width: col.width, size: CELL_FONT_SIZE, font: boldFont, align: col.key === "branchName" ? "left" : "center" });
      x += col.width;
    }

    y -= ROW_HEIGHT;
  }

  const dir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `cron-task-${id}-${date}.pdf`);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);

  const fileName = `${sanitizeFileName(name)}_${date}_staffing.pdf`;

  return { filePath, fileName };
}
