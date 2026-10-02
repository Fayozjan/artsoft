// Чистые данные без импортов (ни prisma, ни express) — их берёт и модуль, и
// сид (utils/seedTenant.js), и скрипт для существующих тенантов.

// Дефолтная раскладка повторяет старый хардкод (58×40мм), но теперь это
// реальные абсолютные координаты блоков, а не отправная точка для скейлинга.
export const DEFAULT_ELEMENTS = [
  { id: "qr", type: "qr", x: 2, y: 2, w: 20, h: 20, codeType: "qr" },
  { id: "code", type: "text", field: "code", x: 24, y: 2, w: 32, h: 6, fontSize: 11, bold: true, align: "left", valign: "top" },
  { id: "batch", type: "text", field: "batch", x: 24, y: 9, w: 32, h: 5, fontSize: 8, bold: false, align: "left", valign: "top" },
  { id: "color", type: "text", field: "color", x: 24, y: 14, w: 32, h: 5, fontSize: 8, bold: false, align: "left", valign: "top" },
  { id: "operation", type: "text", field: "operation", x: 24, y: 19, w: 32, h: 5, fontSize: 8, bold: false, align: "left", valign: "top" },
  { id: "quantity", type: "text", field: "quantity", x: 2, y: 24, w: 54, h: 6, fontSize: 9, bold: false, align: "left", valign: "top" },
  { id: "comment", type: "text", field: "comment", x: 2, y: 31, w: 54, h: 8, fontSize: 7, bold: false, align: "left", valign: "top" },
];

export const DEFAULT_NAME = "Основной";

export const DEFAULTS = {
  name: DEFAULT_NAME,
  width_mm: 58,
  height_mm: 40,
  elements: DEFAULT_ELEMENTS,
};

// Готовые дизайны: сид создаёт из них обычные неактивные варианты
// (work_sticker_templates), дальше их можно править и удалять как любые другие.
// Ищутся по name — переименованный вариант сид посчитает отсутствующим.
//
// Печать рисует только текст (Roboto, чёрный) и код, без линий/рамок — поэтому
// "красота" тут держится на иерархии: размер и жирность шрифта, отступы и
// выравнивание. Поля, которые могут быть пустыми (материал, код цвета,
// комментарий), стоят там, где дыра на их месте ничего не ломает.

const text = (id, field, x, y, w, h, fontSize, extra = {}) => ({
  id,
  type: "text",
  field,
  x,
  y,
  w,
  h,
  fontSize,
  bold: false,
  align: "left",
  valign: "top",
  ...extra,
});

const qr = (x, y, size) => ({ id: "qr", type: "qr", x, y, w: size, h: size, codeType: "qr" });

export const STICKER_PRESETS = [
  {
    name: "Стандарт",
    width_mm: 58,
    height_mm: 40,
    // QR слева, справа столбец: код → партия → цвет/размер → материал.
    // Внизу — операция, под ней количество и комментарий.
    elements: [
      qr(2, 2, 22),
      text("code", "code", 26, 2, 30, 5, 13, { bold: true }),
      text("batch", "batch", 26, 8, 30, 3.5, 8),
      text("color", "color", 26, 12.5, 30, 4, 10, { bold: true }),
      text("size", "size", 26, 17, 30, 4, 10, { bold: true }),
      text("material", "material", 26, 21.5, 30, 3.5, 8),
      text("operation", "operation", 2, 26, 54, 4.5, 10, { bold: true }),
      text("quantity", "quantity", 2, 33.5, 30, 5, 12, { bold: true }),
      text("comment", "comment", 33, 33.5, 23, 6, 7),
    ],
  },
  {
    name: "Крупный размер",
    width_mm: 58,
    height_mm: 40,
    // Крупный размер сверху слева (его ищут глазами первым), QR справа с кодом
    // по центру под ним. Количество — крупно справа внизу.
    elements: [
      text("size", "size", 2, 2, 32, 8, 20, { bold: true }),
      text("color", "color", 2, 11, 32, 4, 11, { bold: true }),
      text("color_variant", "color_variant", 2, 15.5, 32, 3.5, 8),
      text("material", "material", 2, 19, 32, 3.5, 8),
      qr(36, 2, 20),
      text("code", "code", 36, 23, 20, 4, 9, { bold: true, align: "center" }),
      text("batch", "batch", 2, 23, 32, 3.5, 8),
      text("operation", "operation", 2, 28, 54, 4.5, 10, { bold: true }),
      text("comment", "comment", 2, 33.5, 22, 5, 7),
      text("quantity", "quantity", 26, 33.5, 30, 5, 12, { bold: true, align: "right" }),
    ],
  },
  {
    name: "Крупная операция",
    width_mm: 58,
    height_mm: 40,
    // Шапка: партия слева, код справа. Операция крупно (до двух строк) — что
    // именно шить. Ниже данные позиции слева, QR справа, комментарий полосой.
    elements: [
      text("batch", "batch", 2, 2, 30, 4, 8),
      text("code", "code", 30, 2, 26, 4, 10, { bold: true, align: "right" }),
      text("operation", "operation", 2, 7.5, 54, 9, 12, { bold: true, valign: "middle" }),
      text("color", "color", 2, 18.5, 34, 4, 10, { bold: true }),
      text("size", "size", 2, 23, 34, 4, 10, { bold: true }),
      text("material", "material", 2, 27.5, 34, 3.5, 8),
      text("quantity", "quantity", 2, 32, 34, 5, 12, { bold: true }),
      qr(38, 18.5, 18),
      text("comment", "comment", 2, 36.7, 54, 3, 7),
    ],
  },
];
