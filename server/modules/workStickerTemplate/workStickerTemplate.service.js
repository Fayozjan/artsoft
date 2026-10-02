import { WorkStickerTemplateModel } from "./workStickerTemplate.model.js";
import { DEFAULT_NAME, DEFAULTS } from "./workStickerTemplate.presets.js";

const VALID_TYPES = new Set(["qr", "text"]);
const VALID_FIELDS = new Set([
  "code",
  "batch",
  "color",
  "color_variant",
  "material",
  "design",
  "size",
  "operation",
  "prev_operation",
  "prev_sticker_code",
  "quantity",
  "added_at",
  "comment",
  "static",
]);

const toNum = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : Number(fallback);
};

// Блоки приходят от canvas-редактора на клиенте (drag/resize) — координаты
// и размер в мм уже посчитаны там, здесь только защита от мусора в теле запроса.
const sanitizeElements = (elements) => {
  if (!Array.isArray(elements) || elements.length === 0) {
    const err = new Error("Макет стикера не может быть пустым");
    err.code = "INVALID_ELEMENTS";
    throw err;
  }

  return elements.map((el) => {
    if (!VALID_TYPES.has(el?.type)) {
      const err = new Error("Некорректный тип блока в макете");
      err.code = "INVALID_ELEMENTS";
      throw err;
    }
    if (el.type === "text" && !VALID_FIELDS.has(el.field)) {
      const err = new Error("Некорректное поле текстового блока");
      err.code = "INVALID_ELEMENTS";
      throw err;
    }

    const base = {
      id: String(el.id || el.field || el.type).slice(0, 50),
      type: el.type,
      x: toNum(el.x, 0),
      y: toNum(el.y, 0),
      w: toNum(el.w, 10),
      h: toNum(el.h, 5),
    };

    if (el.type === "text") {
      return {
        ...base,
        field: el.field,
        // "static" — свободный текст, набранный вручную в редакторе, а не
        // взятый из данных стикера; хранится прямо в блоке.
        ...(el.field === "static" ? { text: String(el.text ?? "").slice(0, 200) } : {}),
        fontSize: Math.min(Math.max(toNum(el.fontSize, 8), 5), 30),
        bold: el.bold === true,
        align: ["left", "center", "right"].includes(el.align) ? el.align : "left",
        valign: ["top", "middle", "bottom"].includes(el.valign) ? el.valign : "top",
      };
    }

    return { ...base, codeType: el.codeType === "datamatrix" ? "datamatrix" : "qr" };
  });
};

const MAX_NAME_LENGTH = 60;

const sanitizeName = (name, fallback) => String(name ?? "").trim().slice(0, MAX_NAME_LENGTH) || fallback;

const resolveSize = (body, current) => {
  const width_mm = toNum(body.width_mm, current.width_mm);
  const height_mm = toNum(body.height_mm, current.height_mm);
  if (width_mm < 20 || width_mm > 300 || height_mm < 20 || height_mm > 300) {
    const err = new Error("Некорректный размер стикера (допустимо 20–300 мм)");
    err.code = "INVALID_SIZE";
    throw err;
  }
  return { width_mm, height_mm };
};

const requireTemplate = async (id) => {
  const template = Number.isInteger(id) ? await WorkStickerTemplateModel.findById(id) : null;
  if (!template) {
    const err = new Error("Вариант стикера не найден");
    err.code = "NOT_FOUND";
    throw err;
  }
  return template;
};

export const WorkStickerTemplateService = {
  // Активный вариант — по нему печатаются стикеры.
  get: () => WorkStickerTemplateModel.getActive(),

  list: async () => {
    // Первое обращение к пустой таблице создаёт дефолтный вариант.
    await WorkStickerTemplateModel.getActive();
    return WorkStickerTemplateModel.list();
  },

  // Создание нового варианта — в т.ч. копии: клиент присылает то, что сейчас
  // в редакторе (макет с несохранёнными правками), оригинал остаётся как был.
  create: async (body) => {
    const { width_mm, height_mm } = resolveSize(body, DEFAULTS);
    const elements = sanitizeElements(body.elements ?? DEFAULTS.elements);
    const name = sanitizeName(body.name, DEFAULT_NAME);

    return WorkStickerTemplateModel.create({ name, width_mm, height_mm, elements });
  },

  update: async (id, body) => {
    const current = await requireTemplate(id);

    const { width_mm, height_mm } = resolveSize(body, current);
    const elements = sanitizeElements(body.elements ?? current.elements);
    const name = sanitizeName(body.name, current.name);

    return WorkStickerTemplateModel.update(id, { name, width_mm, height_mm, elements });
  },

  activate: async (id) => {
    await requireTemplate(id);
    return WorkStickerTemplateModel.activate(id);
  },

  remove: async (id) => {
    await requireTemplate(id);

    // Активный удалять нельзя — печать осталась бы без макета.
    const active = await WorkStickerTemplateModel.getActive();
    if (active.id === id) {
      const err = new Error("Нельзя удалить вариант, по которому печатаются стикеры");
      err.code = "ACTIVE_TEMPLATE";
      throw err;
    }

    await WorkStickerTemplateModel.remove(id);
  },
};
