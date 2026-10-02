import {
  PDFDocument,
  rgb,
  rectangle,
  pushGraphicsState,
  popGraphicsState,
  clip,
  endPath,
} from "pdf-lib";
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

import { getLateEmployeesService } from "./lateEmployees.service.js";
import { getExcelLocale } from "../../utils/excelLocales.js";
import { fmtLateMinutes, sanitizeFileName, filterLateRows } from "./lateEmployees.reportUtils.js";

// pdf-lib requires the @pdf-lib/fontkit fork specifically — plain `fontkit`'s Subset lacks encodeStream(),
// which CustomFontSubsetEmbedder calls during embedFont(). Load via require (CJS-only package).
const require = createRequire(import.meta.url);
const fontkit = require("@pdf-lib/fontkit");

const FONTS_DIR = path.resolve(process.cwd(), "fonts");
// Фото — не аватар сотрудника, а снимок события входа (face-pass), лежит отдельно от uploads/employees.
const PHOTOS_DIR = path.resolve(process.cwd(), "uploads", "face-passes");

// Landscape A4 — портретной ширины не хватает на колонки таблицы (как в Excel-отчёте) + фото.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 16;
const TITLE_GAP = 12; // расстояние между заголовком отчёта и таблицей
const ROW_HEIGHT = 60;
// Фото — квадрат в размер всей ячейки (без отступов), сама ячейка тоже квадратная (= ROW_HEIGHT).
const PHOTO_SIZE = ROW_HEIGHT;
const PHOTO_COLUMN_WIDTH = ROW_HEIGHT;
const WRAP_LINE_HEIGHT = 9.5;
const WRAP_MAX_LINES = 2;
const HEADER_FONT_SIZE = 7;
const HEADER_LINE_HEIGHT = 8.5;
const HEADER_MAX_LINES = 3;
const HEADER_PADDING = 7;
const CELL_BORDER_WIDTH = 0.35;
const BORDER_COLOR = rgb(0.75, 0.75, 0.75);
const HEADER_BG = rgb(0.96, 0.96, 0.96);
const BRANCH_BAR_HEIGHT = 22;
const BRANCH_BAR_BG = rgb(0.93, 0.93, 0.93);

// Отдельная колонка фото — визуальный элемент только PDF-отчёта, в Excel её нет, поэтому не в excelLocales.js.
const PHOTO_COLUMN_LABEL = { ru: "Фото", en: "Photo", uzLatn: "Rasm", uzCyrl: "Расм" };

// Длинные текстовые колонки — переносятся по словам вместо обрезки многоточием.
const WRAPPING_COLUMNS = new Set(["departmentName", "employeeFullName", "positionName"]);

// Филиал вынесен наверх отдельной плашкой-группой (как "Сотрудники по филиалам" в attendance.excel.js) —
// поэтому в самой таблице колонки branchName нет, ширина перераспределена по остальным колонкам.
const BASE_COLUMNS = [
  { key: "index", width: 26, align: "center" },
  { key: "photo", width: PHOTO_COLUMN_WIDTH, align: "center" },
  { key: "departmentName", width: 117, align: "center" },
  { key: "employeeFullName", width: 190, align: "center" },
  { key: "positionName", width: 117, align: "center" },
  { key: "scheduledStart", width: 50, align: "center" },
  { key: "actualStart", width: 50, align: "center" },
  { key: "lateMinutes", width: 55, align: "center" },
  { key: "monthlyLateCount", width: 55, align: "center" },
  { key: "monthlyLateMinutes", width: 70, align: "center" },
];

// index/photo — фиксированные (фото рисуется квадратом ROW_HEIGHT×ROW_HEIGHT, растягивать нельзя не исказив);
// остаток ширины листа распределяется пропорционально между текстовыми/временными колонками, чтобы таблица
// доходила до правого края страницы, а не заканчивалась с зазором.
const FIXED_COLUMN_KEYS = new Set(["index", "photo"]);

function scaleColumnsToPageWidth() {
  const targetWidth = PAGE_WIDTH - MARGIN * 2;
  const fixedWidth = BASE_COLUMNS.filter((col) => FIXED_COLUMN_KEYS.has(col.key)).reduce((sum, col) => sum + col.width, 0);
  const flexibleBaseWidth = BASE_COLUMNS.filter((col) => !FIXED_COLUMN_KEYS.has(col.key)).reduce((sum, col) => sum + col.width, 0);
  const flexibleTargetWidth = targetWidth - fixedWidth;
  const scale = flexibleTargetWidth / flexibleBaseWidth;

  const scaled = BASE_COLUMNS.map((col) => (FIXED_COLUMN_KEYS.has(col.key) ? { ...col } : { ...col, width: col.width * scale }));
  const lastFlexible = [...scaled].reverse().find((col) => !FIXED_COLUMN_KEYS.has(col.key));
  lastFlexible.width += targetWidth - scaled.reduce((sum, col) => sum + col.width, 0);
  return scaled;
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

// Перенос по словам максимум в WRAP_MAX_LINES строк; последняя строка обрезается многоточием при переполнении.
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

// Перенос по словам + вертикальное центрирование блока строк в ячейке — общий рендер для длинных текстовых колонок
// (филиал/отдел/ФИО/должность), которые иначе обрезались бы многоточием.
function drawWrappingCell(page, text, { x, rowTop, rowHeight, width, size, font }) {
  const lines = wrapText(font, text, size, width - 8);
  const blockHeight = (lines.length - 1) * WRAP_LINE_HEIGHT;
  drawWrappedCellText(page, lines, {
    x,
    y: rowTop - rowHeight / 2 + blockHeight / 2 - 3,
    width,
    size,
    font,
    lineHeight: WRAP_LINE_HEIGHT,
    align: "center",
  });
}

// Клип по квадрату — фото масштабируется в режиме "cover" (по большей из двух пропорций) и центрируется,
// иначе непропорциональные фото растягиваются и выглядят криво.
function drawSquareImage(page, image, { x, y, size }) {
  const scale = Math.max(size / image.width, size / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (size - drawWidth) / 2;
  const drawY = y + (size - drawHeight) / 2;

  page.pushOperators(pushGraphicsState(), rectangle(x, y, size, size), clip(), endPath());
  page.drawImage(image, { x: drawX, y: drawY, width: drawWidth, height: drawHeight });
  page.pushOperators(popGraphicsState());
}

function drawPlaceholderSquare(page, { x, y, size }) {
  page.drawRectangle({ x, y, width: size, height: size, color: rgb(0.93, 0.93, 0.93) });
}

async function loadEmployeePhoto(pdfDoc, photo) {
  if (!photo) return null;
  const safe = path.normalize(String(photo)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PHOTOS_DIR, safe);
  if (!filePath.startsWith(PHOTOS_DIR)) return null;

  try {
    const bytes = await fs.readFile(filePath);
    return await pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function buildLateEmployeesPdfReport({ id, name, userId, date, filter, includeLunchLate, language }) {
  const { data } = await getLateEmployeesService({
    userId,
    filters: { mode: "day", date, include_lunch_late: includeLunchLate },
    page: 1,
    pageSize: 100000,
  });

  const rows = filterLateRows(data || [], filter);
  const locale = getExcelLocale(language);

  // Растянуто до полной ширины листа — см. scaleColumnsToPageWidth. Локально затеняет BASE_COLUMNS,
  // все обращения к COLUMNS ниже (drawHeaderRow/tableWidth/цикл строк) подхватывают уже растянутые ширины.
  const COLUMNS = scaleColumnsToPageWidth();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(path.join(FONTS_DIR, "Bitter-Regular.ttf")),
    fs.readFile(path.join(FONTS_DIR, "Bitter-Bold.ttf")),
  ]);
  const font = await pdfDoc.embedFont(regularBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });

  const headerLabels = {
    index: locale.number,
    photo: PHOTO_COLUMN_LABEL[language] || PHOTO_COLUMN_LABEL.ru,
    departmentName: locale.department,
    employeeFullName: locale.fullName,
    positionName: locale.position,
    scheduledStart: locale.scheduledStart,
    actualStart: locale.actualStart,
    lateMinutes: locale.lateMinutes,
    monthlyLateCount: locale.monthlyLateCount,
    monthlyLateMinutes: locale.monthlyLateMinutes,
  };

  let page;
  let y;

  // Заголовки колонок переносятся по словам, если не помещаются — высота строки подстраивается под самый длинный (по числу строк) заголовок.
  const drawHeaderRow = () => {
    const linesByCol = COLUMNS.map((col) =>
      wrapText(boldFont, headerLabels[col.key], HEADER_FONT_SIZE, col.width - 6, HEADER_MAX_LINES),
    );
    const maxLines = Math.max(...linesByCol.map((lines) => lines.length));
    const rowHeight = maxLines * HEADER_LINE_HEIGHT + HEADER_PADDING;

    let x = MARGIN;
    COLUMNS.forEach((col, idx) => {
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
      page.drawText(locale.pdfReportTitle, { x: MARGIN, y: y - 12, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(date, {
        x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(date, 9),
        y: y - 10,
        size: 9,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      y -= 12 + TITLE_GAP; // 12 = высота строки заголовка, TITLE_GAP — сам зазор до таблицы
    }

    drawHeaderRow();
  };

  startNewPage(true);

  const ensureSpace = (height = ROW_HEIGHT) => {
    if (y - height < MARGIN) startNewPage(false);
  };

  const tableWidth = COLUMNS.reduce((sum, col) => sum + col.width, 0);

  const drawBranchBar = (branchName) => {
    ensureSpace(BRANCH_BAR_HEIGHT);
    page.drawRectangle({ x: MARGIN, y: y - BRANCH_BAR_HEIGHT, width: tableWidth, height: BRANCH_BAR_HEIGHT, color: BRANCH_BAR_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
    const label = branchName || "";
    const textWidth = boldFont.widthOfTextAtSize(label, 10);
    page.drawText(label, { x: MARGIN + (tableWidth - textWidth) / 2, y: y - BRANCH_BAR_HEIGHT / 2 - 4, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    y -= BRANCH_BAR_HEIGHT;
  };

  if (!rows.length) {
    page.drawText(locale.noLateEmployees, { x: MARGIN, y: y - 16, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
  }

  // Филиал вынесен наверх плашкой-разделителем над своей группой сотрудников (см. addEmployeesByBranchSheet в attendance.excel.js).
  const branchGroups = new Map();
  rows.forEach((emp) => {
    const key = emp.branchName || "—";
    if (!branchGroups.has(key)) branchGroups.set(key, []);
    branchGroups.get(key).push(emp);
  });
  const sortedBranches = [...branchGroups.keys()].sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));

  let rowNumber = 0;
  for (const branchName of sortedBranches) {
    drawBranchBar(branchName);

    for (const emp of branchGroups.get(branchName)) {
      rowNumber += 1;
      ensureSpace();
      const rowTop = y;
      const textBaseline = rowTop - ROW_HEIGHT / 2 - 3;

      // Фото входа (face-pass снимок), не аватар из карточки сотрудника.
      const image = await loadEmployeePhoto(pdfDoc, emp.actualStartPhoto);

      let x = MARGIN;
      for (const col of COLUMNS) {
        page.drawRectangle({ x, y: rowTop - ROW_HEIGHT, width: col.width, height: ROW_HEIGHT, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });

        if (col.key === "photo") {
          const photoX = x + (col.width - PHOTO_SIZE) / 2;
          const photoY = rowTop - ROW_HEIGHT / 2 - PHOTO_SIZE / 2;
          if (image) {
            drawSquareImage(page, image, { x: photoX, y: photoY, size: PHOTO_SIZE });
          } else {
            drawPlaceholderSquare(page, { x: photoX, y: photoY, size: PHOTO_SIZE });
          }
          // фото рисуется во всю ячейку и перекрывает рамку — перерисовываем её поверх, чтобы сетка осталась ровной.
          page.drawRectangle({ x, y: rowTop - ROW_HEIGHT, width: col.width, height: ROW_HEIGHT, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
        } else if (WRAPPING_COLUMNS.has(col.key)) {
          const values = {
            departmentName: emp.departmentName || "",
            employeeFullName: emp.employeeFullName || "",
            positionName: emp.positionName || "",
          };
          drawWrappingCell(page, values[col.key], { x, rowTop, rowHeight: ROW_HEIGHT, width: col.width, size: 8, font });
        } else {
          const values = {
            index: rowNumber,
            scheduledStart: emp.scheduledStart || "",
            actualStart: emp.actualStart || "",
            lateMinutes: fmtLateMinutes(emp.lateMinutes),
            monthlyLateCount: emp.monthlyArrivalLateCount || 0,
            monthlyLateMinutes: fmtLateMinutes(emp.monthlyLateMinutes),
          };
          drawCellText(page, values[col.key], { x, y: textBaseline, width: col.width, size: 8, font, align: col.align });
        }

        x += col.width;
      }

      y -= ROW_HEIGHT;
    }
  }

  const dir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `cron-task-${id}-${date}.pdf`);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);

  const fileName = `${sanitizeFileName(name)}_${date}.pdf`;

  return { filePath, fileName };
}

// Матрица "Филиал × день месяца" (кол-во опозданий за день) — серверный PDF-аналог
// DownloadLate.monthByBranch (client/src/utils/downloadDoc.js), для крон-задачи reports_bundle.
const MONTH_MARGIN = 16;
const MONTH_BRANCH_COL_WIDTH = 110;
const MONTH_TOTAL_COL_WIDTH = 36;
const MONTH_ROW_HEIGHT = 20;
const MONTH_HEADER_HEIGHT = 20;
const MONTH_CELL_FONT_SIZE = 7;

export async function buildLateByBranchMonthlyPdfReport({ id, name, userId, date, filter, includeLunchLate, language }) {
  const { data } = await getLateEmployeesService({
    userId,
    filters: { mode: "month", date, include_lunch_late: includeLunchLate },
    page: 1,
    pageSize: 100000,
  });

  const allBranches = data?.lateByBranchAndDay || [];
  const branches = filter?.branches?.length
    ? allBranches.filter((b) => filter.branches.includes(b.branchName))
    : allBranches;

  const locale = getExcelLocale(language);

  const [year, month] = date.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(path.join(FONTS_DIR, "Bitter-Regular.ttf")),
    fs.readFile(path.join(FONTS_DIR, "Bitter-Bold.ttf")),
  ]);
  const font = await pdfDoc.embedFont(regularBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });

  const tableWidth = PAGE_WIDTH - MONTH_MARGIN * 2;
  const dayColWidth = (tableWidth - MONTH_BRANCH_COL_WIDTH - MONTH_TOTAL_COL_WIDTH) / daysInMonth;

  let page;
  let y;

  const drawHeaderRow = () => {
    let x = MONTH_MARGIN;
    page.drawRectangle({ x, y: y - MONTH_HEADER_HEIGHT, width: MONTH_BRANCH_COL_WIDTH, height: MONTH_HEADER_HEIGHT, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
    drawCellText(page, locale.branch, { x, y: y - MONTH_HEADER_HEIGHT / 2 - 3, width: MONTH_BRANCH_COL_WIDTH, size: MONTH_CELL_FONT_SIZE, font: boldFont, align: "center" });
    x += MONTH_BRANCH_COL_WIDTH;

    for (let d = 1; d <= daysInMonth; d++) {
      page.drawRectangle({ x, y: y - MONTH_HEADER_HEIGHT, width: dayColWidth, height: MONTH_HEADER_HEIGHT, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
      drawCellText(page, String(d), { x, y: y - MONTH_HEADER_HEIGHT / 2 - 3, width: dayColWidth, size: MONTH_CELL_FONT_SIZE, font: boldFont, align: "center" });
      x += dayColWidth;
    }

    page.drawRectangle({ x, y: y - MONTH_HEADER_HEIGHT, width: MONTH_TOTAL_COL_WIDTH, height: MONTH_HEADER_HEIGHT, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
    drawCellText(page, locale.total, { x, y: y - MONTH_HEADER_HEIGHT / 2 - 3, width: MONTH_TOTAL_COL_WIDTH, size: MONTH_CELL_FONT_SIZE, font: boldFont, align: "center" });

    y -= MONTH_HEADER_HEIGHT;
  };

  const startNewPage = (withTitle) => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MONTH_MARGIN;

    if (withTitle) {
      const monthLabel = date.slice(0, 7);
      page.drawText(locale.lateByBranchPdfReportTitle, { x: MONTH_MARGIN, y: y - 12, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(monthLabel, {
        x: PAGE_WIDTH - MONTH_MARGIN - font.widthOfTextAtSize(monthLabel, 9),
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
    if (y - MONTH_ROW_HEIGHT < MONTH_MARGIN) startNewPage(false);
  };

  if (!branches.length) {
    page.drawText(locale.noLateEmployees, { x: MONTH_MARGIN, y: y - 16, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
  }

  const sortedBranches = [...branches].sort((a, b) =>
    a.branchName.localeCompare(b.branchName, "ru", { sensitivity: "base" }),
  );

  // Итог по дням (сумма по всем филиалам за каждое число) + общий итог за месяц — строка в конце таблицы.
  const dayTotals = new Array(daysInMonth + 1).fill(0);
  let grandTotal = 0;

  for (const branch of sortedBranches) {
    ensureSpace();

    // Ключ дня — число месяца из ISO-даты (см. тот же приём в DownloadLate.monthByBranch).
    const dayCountMap = new Map(branch.days.map((d) => [new Date(d.date).getDate(), d.lateCount]));

    const rowTop = y;
    let x = MONTH_MARGIN;
    let rowTotal = 0;

    page.drawRectangle({ x, y: rowTop - MONTH_ROW_HEIGHT, width: MONTH_BRANCH_COL_WIDTH, height: MONTH_ROW_HEIGHT, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
    drawWrappingCell(page, branch.branchName, { x, rowTop, rowHeight: MONTH_ROW_HEIGHT, width: MONTH_BRANCH_COL_WIDTH, size: MONTH_CELL_FONT_SIZE, font });
    x += MONTH_BRANCH_COL_WIDTH;

    for (let d = 1; d <= daysInMonth; d++) {
      const count = dayCountMap.get(d) || 0;
      rowTotal += count;
      dayTotals[d] += count;
      page.drawRectangle({ x, y: rowTop - MONTH_ROW_HEIGHT, width: dayColWidth, height: MONTH_ROW_HEIGHT, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
      if (count > 0) {
        drawCellText(page, String(count), { x, y: rowTop - MONTH_ROW_HEIGHT / 2 - 3, width: dayColWidth, size: MONTH_CELL_FONT_SIZE, font, align: "center" });
      }
      x += dayColWidth;
    }

    page.drawRectangle({ x, y: rowTop - MONTH_ROW_HEIGHT, width: MONTH_TOTAL_COL_WIDTH, height: MONTH_ROW_HEIGHT, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
    drawCellText(page, String(rowTotal), { x, y: rowTop - MONTH_ROW_HEIGHT / 2 - 3, width: MONTH_TOTAL_COL_WIDTH, size: MONTH_CELL_FONT_SIZE, font: boldFont, align: "center" });

    grandTotal += rowTotal;
    y -= MONTH_ROW_HEIGHT;
  }

  if (sortedBranches.length) {
    ensureSpace();

    const rowTop = y;
    let x = MONTH_MARGIN;

    page.drawRectangle({ x, y: rowTop - MONTH_ROW_HEIGHT, width: MONTH_BRANCH_COL_WIDTH, height: MONTH_ROW_HEIGHT, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
    drawCellText(page, locale.total, { x, y: rowTop - MONTH_ROW_HEIGHT / 2 - 3, width: MONTH_BRANCH_COL_WIDTH, size: MONTH_CELL_FONT_SIZE, font: boldFont, align: "center" });
    x += MONTH_BRANCH_COL_WIDTH;

    for (let d = 1; d <= daysInMonth; d++) {
      const count = dayTotals[d];
      page.drawRectangle({ x, y: rowTop - MONTH_ROW_HEIGHT, width: dayColWidth, height: MONTH_ROW_HEIGHT, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
      if (count > 0) {
        drawCellText(page, String(count), { x, y: rowTop - MONTH_ROW_HEIGHT / 2 - 3, width: dayColWidth, size: MONTH_CELL_FONT_SIZE, font: boldFont, align: "center" });
      }
      x += dayColWidth;
    }

    page.drawRectangle({ x, y: rowTop - MONTH_ROW_HEIGHT, width: MONTH_TOTAL_COL_WIDTH, height: MONTH_ROW_HEIGHT, color: HEADER_BG, borderColor: BORDER_COLOR, borderWidth: CELL_BORDER_WIDTH });
    drawCellText(page, String(grandTotal), { x, y: rowTop - MONTH_ROW_HEIGHT / 2 - 3, width: MONTH_TOTAL_COL_WIDTH, size: MONTH_CELL_FONT_SIZE, font: boldFont, align: "center" });

    y -= MONTH_ROW_HEIGHT;
  }

  const dir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `cron-task-${id}-${date}.pdf`);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);

  const fileName = `${sanitizeFileName(name)}_${date}_branches.pdf`;

  return { filePath, fileName };
}
