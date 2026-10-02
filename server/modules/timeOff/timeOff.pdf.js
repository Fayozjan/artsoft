import { PDFDocument, rgb } from "pdf-lib";
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { DateTime } from "luxon";

import { TimeOffService } from "./timeOff.service.js";
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
const ROW_HEIGHT = 34;
const WRAP_LINE_HEIGHT = 9.5;
const WRAP_MAX_LINES = 2;
const HEADER_HEIGHT = 24;
const HEADER_FONT_SIZE = 7.5;
const CELL_FONT_SIZE = 8;
const CELL_BORDER_WIDTH = 0.35;
const BORDER_COLOR = rgb(0.75, 0.75, 0.75);
const HEADER_BG = rgb(0.96, 0.96, 0.96);

const WRAPPING_COLUMNS = new Set(["employeeFullName", "branchName", "departmentName", "positionName", "reason"]);

const BASE_COLUMNS = [
  { key: "index", width: 24, align: "center" },
  { key: "employeeFullName", width: 140, align: "left" },
  { key: "branchName", width: 90, align: "center" },
  { key: "departmentName", width: 90, align: "center" },
  { key: "positionName", width: 90, align: "center" },
  { key: "reason", width: 140, align: "left" },
  { key: "dateFrom", width: 78, align: "center" },
  { key: "dateTo", width: 78, align: "center" },
  { key: "companyPaid", width: 60, align: "center" },
];

function buildColumns() {
  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  const baseSum = BASE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
  const remainder = tableWidth - baseSum;
  return BASE_COLUMNS.map((col) => (col.key === "reason" ? { ...col, width: col.width + remainder } : { ...col }));
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

// "hour_off" (Отлучка) — период внутри одного дня, времени начала/конца важны (см. AddTimeOff.jsx:
// для этого типа поля date_from/date_to — datetime-local, а не date). day_off/vacation — целыми днями,
// время не имеет смысла.
function fmtDate(value, withTime) {
  if (!value) return "";
  const dt = DateTime.fromJSDate(new Date(value)).setZone("Asia/Tashkent");
  if (!dt.isValid) return "";
  return dt.toFormat(withTime ? "dd.MM.yyyy HH:mm" : "dd.MM.yyyy");
}

export async function buildTimeOffPdfReport({ id, name, userId, date, filter, language }) {
  // TimeOffService.getAll сравнивает date_from/date_to как точку времени (new Date("yyyy-MM-dd") = полночь UTC),
  // а не диапазон дня — при активных заявках с временем внутри дня (напр. 09:00-09:15) голая дата
  // "срезает" их, т.к. запись начинается позже полуночи. Передаём явные границы дня в Asia/Tashkent.
  const zoned = DateTime.fromISO(date, { zone: "Asia/Tashkent" });
  const dayStart = zoned.startOf("day").toISO();
  const dayEnd = zoned.endOf("day").toISO();

  const { data } = await TimeOffService.getAll({
    userId,
    filters: { date_from: dayStart, date_to: dayEnd, employeeIds: filter?.employees || [] },
  });

  // TimeOffService.getAll фильтра по филиалам не имеет — режем уже полученные строки по branch_name
  // (filter.branches здесь имена филиалов, как в filterAttendanceRows/filterLateRows).
  const rows = filter?.branches?.length
    ? (data || []).filter((r) => filter.branches.includes(r.branch_name))
    : data || [];

  const locale = getExcelLocale(language);
  const columns = buildColumns();

  const headerLabels = {
    index: locale.number,
    employeeFullName: locale.fullName,
    branchName: locale.branch,
    departmentName: locale.department,
    positionName: locale.position,
    reason: locale.timeOffReason,
    dateFrom: locale.timeOffDateFrom,
    dateTo: locale.timeOffDateTo,
    companyPaid: locale.timeOffCompanyPaid,
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
      page.drawText(locale.timeOffPdfReportTitle, { x: MARGIN, y: y - 12, size: 12, font: boldFont, color: rgb(0, 0, 0) });
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
    page.drawText(locale.noTimeOffData, { x: MARGIN, y: y - 16, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
  }

  rows.forEach((record, index) => {
    ensureSpace();
    const rowTop = y;
    const textBaseline = rowTop - ROW_HEIGHT / 2 - 3;

    // AddTimeOff.jsx шлёт type="hour_off", но TimeOffPage.jsx/схема (@default("hour")) ждут "hour" —
    // существующий рассинхрон в форме. Проверяем оба значения, чтобы не зависеть от того, какая сторона верна.
    const withTime = record.type === "hour" || record.type === "hour_off";
    const values = {
      index: index + 1,
      employeeFullName: record.employeeFullName || "",
      branchName: record.branch_name || "",
      departmentName: record.department_name || "",
      positionName: record.position_name || "",
      reason: record.reason || "",
      dateFrom: fmtDate(record.date_from, withTime),
      dateTo: fmtDate(record.date_to, withTime),
      companyPaid: record.is_company_paid ? locale.yes : locale.no,
    };

    let x = MARGIN;
    for (const col of columns) {
      page.drawRectangle({ x, y: rowTop - ROW_HEIGHT, width: col.width, height: ROW_HEIGHT, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });

      if (WRAPPING_COLUMNS.has(col.key)) {
        drawWrappingCell(page, values[col.key], { x, rowTop, rowHeight: ROW_HEIGHT, width: col.width, size: CELL_FONT_SIZE, font, align: col.align });
      } else {
        drawCellText(page, values[col.key], { x, y: textBaseline, width: col.width, size: CELL_FONT_SIZE, font, align: col.align });
      }

      x += col.width;
    }

    y -= ROW_HEIGHT;
  });

  const dir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `cron-task-${id}-${date}.pdf`);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);

  const fileName = `${sanitizeFileName(name)}_${date}_timeoff.pdf`;

  return { filePath, fileName };
}
