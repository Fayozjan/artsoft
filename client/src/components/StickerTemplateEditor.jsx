import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

import {
  DEFAULT_STICKER_ELEMENTS,
  MM_PER_PT,
  STICKER_FIELD_TEXT,
  STICKER_PREVIEW_FONT,
  generateCodeDataUrl,
  layoutStickerTextPreview,
  loadStickerPreviewFonts,
} from "../utils/DocGenerator";
import Button from "./Button";
import CenterModal from "./CenterModal";
import { Icons } from "../icons/icons";
import styles from "./StickerTemplateEditor.module.scss";

// px на 1мм в канвасе редактора — чисто для превью, к PDF не относится.
const SCALE = 6;

// Совпадает с лимитом на бэке (work_sticker_templates.name).
const MAX_NAME_LENGTH = 60;

// Шаг сетки в мм — драг/ресайз всегда округляются до него, канвас рисует
// сетку с тем же шагом, так что видно, во что блок притянется.
const GRID_MM = 2;

const TEXT_ANCHOR = { left: "start", center: "middle", right: "end" };

const snap = (value) => Math.round(value / GRID_MM) * GRID_MM;

const FIELD_LABEL_KEYS = {
  code: "workStickerFieldCode",
  batch: "workStickerFieldBatch",
  color: "color",
  color_variant: "colorVariant",
  material: "material",
  design: "design",
  size: "size",
  operation: "workStickerFieldOperation",
  prev_operation: "workStickerFieldPrevOperation",
  prev_sticker_code: "workStickerFieldPrevStickerCode",
  quantity: "workStickerFieldQuantity",
  added_at: "workStickerCreatedAt",
  comment: "workStickerFieldComment",
};

// Заглушка на случай, если открыли редактор без реального контекста партии/
// позиции (previewSticker не передали) — обычные геттеры STICKER_FIELD_TEXT
// тогда всё равно получают валидную форму объекта.
const FALLBACK_STICKER = {
  sticker_code: "ST-000000",
  planned_quantity: 0,
  comment: "",
  operationType: null,
  batchReceiptItem: {},
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Умные направляющие (как в Figma/Sketch): для перетаскиваемого/ресайзящегося
// блока ищем БЛИЖАЙШИЙ объект (или край канваса) с каждой из 4 сторон и
// показываем расстояние до него — только если оси перпендикулярно пересекаются
// (иначе "расстояние" было бы бессмысленным диагональным числом).
const MIN_GUIDE_MM = 0.3;

function computeGuides(box, others, width, height) {
  const left = box.x;
  const right = box.x + box.w;
  const top = box.y;
  const bottom = box.y + box.h;

  const yOverlaps = (o) => o.y + o.h > top && o.y < bottom;
  const xOverlaps = (o) => o.x + o.w > left && o.x < right;

  let nearestLeft = { dist: left, edge: 0, mid: top + box.h / 2, isCanvas: true };
  let nearestRight = { dist: width - right, edge: width, mid: top + box.h / 2, isCanvas: true };
  let nearestTop = { dist: top, edge: 0, mid: left + box.w / 2, isCanvas: true };
  let nearestBottom = { dist: height - bottom, edge: height, mid: left + box.w / 2, isCanvas: true };

  for (const o of others) {
    if (yOverlaps(o)) {
      const overlapMid = (Math.max(top, o.y) + Math.min(bottom, o.y + o.h)) / 2;
      if (o.x + o.w <= left) {
        const dist = left - (o.x + o.w);
        if (dist < nearestLeft.dist) nearestLeft = { dist, edge: o.x + o.w, mid: overlapMid, isCanvas: false };
      }
      if (o.x >= right) {
        const dist = o.x - right;
        if (dist < nearestRight.dist) nearestRight = { dist, edge: o.x, mid: overlapMid, isCanvas: false };
      }
    }
    if (xOverlaps(o)) {
      const overlapMid = (Math.max(left, o.x) + Math.min(right, o.x + o.w)) / 2;
      if (o.y + o.h <= top) {
        const dist = top - (o.y + o.h);
        if (dist < nearestTop.dist) nearestTop = { dist, edge: o.y + o.h, mid: overlapMid, isCanvas: false };
      }
      if (o.y >= bottom) {
        const dist = o.y - bottom;
        if (dist < nearestBottom.dist) nearestBottom = { dist, edge: o.y, mid: overlapMid, isCanvas: false };
      }
    }
  }

  const guides = [];
  if (nearestLeft.dist > MIN_GUIDE_MM)
    guides.push({ axis: "x", from: nearestLeft.edge, to: left, cross: nearestLeft.mid, dist: nearestLeft.dist, isCanvas: nearestLeft.isCanvas, key: "left" });
  if (nearestRight.dist > MIN_GUIDE_MM)
    guides.push({ axis: "x", from: right, to: nearestRight.edge, cross: nearestRight.mid, dist: nearestRight.dist, isCanvas: nearestRight.isCanvas, key: "right" });
  if (nearestTop.dist > MIN_GUIDE_MM)
    guides.push({ axis: "y", from: nearestTop.edge, to: top, cross: nearestTop.mid, dist: nearestTop.dist, isCanvas: nearestTop.isCanvas, key: "top" });
  if (nearestBottom.dist > MIN_GUIDE_MM)
    guides.push({ axis: "y", from: bottom, to: nearestBottom.edge, cross: nearestBottom.mid, dist: nearestBottom.dist, isCanvas: nearestBottom.isCanvas, key: "bottom" });

  return guides;
}

// Текст блока рисуется по той же раскладке, что и в PDF (layoutStickerText):
// тот же шрифт, размер в pt (→ мм → px), те же переносы строк и та же базовая
// линия. SVG-<text> ставит именно baseline в заданный y, поэтому строки лежат
// ровно там, где их нарисует jsPDF. placeholder — подсказка вместо пустого
// значения (в печать не уходит), рисуется серым.
function TextPreview({ el, text, placeholder }) {
  const layout = layoutStickerTextPreview(text, el);
  return (
    <svg
      className={styles.textPreview}
      width={el.w * SCALE}
      height={el.h * SCALE}
      fontFamily={`${STICKER_PREVIEW_FONT}, Roboto, sans-serif`}
      fontWeight={el.bold ? 700 : 400}
      fontSize={layout.fontSize * MM_PER_PT * SCALE}
      textAnchor={TEXT_ANCHOR[layout.align]}
      fill={placeholder ? "#9aa4b2" : "#000"}
    >
      {layout.lines.map((line, i) => (
        <text key={i} x={layout.x * SCALE} y={line.y * SCALE} style={{ whiteSpace: "pre" }}>
          {line.text}
        </text>
      ))}
    </svg>
  );
}

// Редактор одного варианта дизайна. Родитель перемонтирует его (key) при смене
// варианта и после сохранения, поэтому стейт ниже инициализируется из `template`
// один раз — дальше это черновик, который живёт только в редакторе.
export default function StickerTemplateEditor({
  template,
  templates,
  previewSticker,
  onSelect,
  onSave,
  onCreate,
  onActivate,
  onDelete,
  saving,
}) {
  const { t } = useTranslation();
  const [, setFontsReady] = useState(false);
  const [name, setName] = useState(template.name || "");
  const [width, setWidth] = useState(Number(template.width_mm) || 58);
  const [height, setHeight] = useState(Number(template.height_mm) || 40);
  const [elements, setElements] = useState(() =>
    (Array.isArray(template.elements) && template.elements.length > 0 ? template.elements : DEFAULT_STICKER_ELEMENTS)
      // страхуемся от старых блоков с полями, которых больше нет (напр. бывший
      // объединённый "item") — молча выкидываем, чтобы не блокировать сохранение
      .filter((el) => el.type === "qr" || FIELD_LABEL_KEYS[el.field])
      .map((el) => ({ ...el })),
  );
  const [selectedId, setSelectedId] = useState(null);
  // Подтверждение потери правок (переход на другой вариант) и удаления; kind
  // остаётся после закрытия, чтобы текст не мигал во время анимации модалки.
  const [pending, setPending] = useState({ open: false, kind: "discard", id: null });
  const [qrPreview, setQrPreview] = useState(null);
  const [liveBox, setLiveBox] = useState(null);
  const canvasRef = useRef(null);
  const resizeState = useRef(null);

  // Снимок при открытии варианта: расхождение с ним = несохранённые правки.
  const snapshot = JSON.stringify({ name, width, height, elements });
  const [savedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  const previewData = previewSticker || FALLBACK_STICKER;
  const qrElement = elements.find((el) => el.type === "qr");

  // Roboto для превью грузится асинхронно — после загрузки перерисовываем.
  useEffect(() => {
    let cancelled = false;
    loadStickerPreviewFonts().then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Текст блока как в печати: значение поля, для пустого — подсказка (имя поля
  // или заглушка свободного текста), которая в PDF не попадёт.
  const getPreviewText = (el) => {
    const value = el.field === "static" ? el.text : STICKER_FIELD_TEXT[el.field]?.(previewData);
    if (value) return { text: value, placeholder: false };
    return { text: el.field === "static" ? t("workStickerFreeTextPlaceholder") : el.field, placeholder: true };
  };

  // Перегенерировать картинку кода при смене типа (QR/Data Matrix) или
  // реального sticker_code — превью всегда 1:1 с тем, что уйдёт в PDF.
  useEffect(() => {
    if (!qrElement) {
      setQrPreview(null);
      return;
    }
    let cancelled = false;
    generateCodeDataUrl(previewData.sticker_code, qrElement.codeType).then((url) => {
      if (!cancelled) setQrPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [qrElement?.codeType, previewData.sticker_code, qrElement != null]);

  const updateElement = (id, patch) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  };

  const removeElement = (id) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedId(null);
  };

  const missingFieldKeys = Object.keys(FIELD_LABEL_KEYS).filter((f) => !elements.some((el) => el.field === f));
  const hasQr = elements.some((el) => el.type === "qr");

  const addTextField = (field) => {
    const id = field;
    setElements((prev) => [
      ...prev,
      { id, type: "text", field, x: 2, y: 2, w: 30, h: 6, fontSize: 8, bold: false, align: "left", valign: "top" },
    ]);
    setSelectedId(id);
  };

  const addQr = () => {
    setElements((prev) => [...prev, { id: "qr", type: "qr", x: 2, y: 2, w: 20, h: 20, codeType: "qr" }]);
    setSelectedId("qr");
  };

  // Свободный текст — не привязан к данным стикера, можно добавить сколько
  // угодно (в отличие от полей данных, где каждое используется один раз).
  const addStaticText = () => {
    const id = `static-${Date.now()}`;
    setElements((prev) => [
      ...prev,
      { id, type: "text", field: "static", text: "", x: 2, y: 2, w: 30, h: 6, fontSize: 8, bold: false, align: "left", valign: "top" },
    ]);
    setSelectedId(id);
  };

  // Живые направляющие во время перетаскивания: framer сам двигает элемент
  // своим transform'ом (в elements ничего не пишем до onDragEnd), поэтому
  // текущую позицию для расчёта расстояний берём из info.offset отдельно.
  const handleDrag = (el, info) => {
    const x = clamp(el.x + info.offset.x / SCALE, 0, Math.max(width - el.w, 0));
    const y = clamp(el.y + info.offset.y / SCALE, 0, Math.max(height - el.h, 0));
    setLiveBox({ id: el.id, x, y, w: el.w, h: el.h });
  };

  const handleDragEnd = (el, info) => {
    const dxMm = info.offset.x / SCALE;
    const dyMm = info.offset.y / SCALE;
    updateElement(el.id, {
      x: clamp(snap(el.x + dxMm), 0, Math.max(width - el.w, 0)),
      y: clamp(snap(el.y + dyMm), 0, Math.max(height - el.h, 0)),
    });
    setLiveBox(null);
  };

  // onMove/onUp живут на window, не на элементе — если редактор размонтируется
  // посреди ресайза (например Save закрывает панель), react-эффект ниже снимет
  // их и явно, но держим ссылку и тут на случай штатного onUp.
  const activeResizeCleanup = useRef(null);

  const startResize = (e, el) => {
    e.stopPropagation();
    e.preventDefault();
    resizeState.current = { id: el.id, startX: e.clientX, startY: e.clientY, startW: el.w, startH: el.h, isQr: el.type === "qr" };

    const onMove = (ev) => {
      const state = resizeState.current;
      if (!state) return;
      const dxMm = (ev.clientX - state.startX) / SCALE;
      const dyMm = (ev.clientY - state.startY) / SCALE;
      let w, h;
      if (state.isQr) {
        const size = clamp(snap(state.startW + Math.max(dxMm, dyMm)), 8, Math.min(width, height));
        w = size;
        h = size;
      } else {
        w = clamp(snap(state.startW + dxMm), 10, width);
        h = clamp(snap(state.startH + dyMm), 4, height);
      }
      updateElement(state.id, { w, h });
      setLiveBox({ id: state.id, x: el.x, y: el.y, w, h });
    };
    const onUp = () => {
      resizeState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      activeResizeCleanup.current = null;
      setLiveBox(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    activeResizeCleanup.current = onUp;
  };

  // Гарантированно снять window-листенеры ресайза, если компонент размонтируют
  // посреди перетаскивания (закрыли панель кнопкой Save/крестиком) — иначе
  // onMove продолжает дёргать setState на отмонтированном компоненте на каждое
  // движение мыши где угодно на странице.
  useEffect(() => {
    return () => {
      activeResizeCleanup.current?.();
    };
  }, []);

  const selected = elements.find((el) => el.id === selectedId) || null;

  const handleReset = () => {
    setElements(DEFAULT_STICKER_ELEMENTS.map((el) => ({ ...el })));
    setWidth(58);
    setHeight(40);
    setSelectedId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name, width_mm: width, height_mm: height, elements });
  };

  const handleSelectVariant = (id) => {
    if (id === template.id) return;
    if (dirty) setPending({ open: true, kind: "discard", id });
    else onSelect(id);
  };

  // Копия берётся из того, что сейчас на канвасе (с несохранёнными правками);
  // оригинал остаётся как сохранён, а редактор переключается на копию.
  const handleDuplicate = () => {
    const suffix = ` (${t("workStickerCopySuffix")})`;
    const baseName = name.trim() || template.name;
    onCreate({
      name: baseName.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix,
      width_mm: width,
      height_mm: height,
      elements,
    });
  };

  // Новый вариант — с чистого листа (дефолтный макет), в отличие от копии, которая
  // берёт текущий черновик. Родитель после создания переключает редактор на него.
  const createNewVariant = () => {
    const suffix = ` ${templates.length + 1}`;
    onCreate({
      name: t("workStickerNewVariantName").slice(0, MAX_NAME_LENGTH - suffix.length) + suffix,
      width_mm: 58,
      height_mm: 40,
      elements: DEFAULT_STICKER_ELEMENTS.map((el) => ({ ...el })),
    });
  };

  const handleAddVariant = () => {
    if (dirty) setPending({ open: true, kind: "new", id: null });
    else createNewVariant();
  };

  const handleConfirmPending = () => {
    const { kind, id } = pending;
    setPending((prev) => ({ ...prev, open: false }));
    if (kind === "delete") onDelete(id);
    else if (kind === "new") createNewVariant();
    else onSelect(id);
  };

  return (
    <form className={styles.editor} onSubmit={handleSubmit}>
      <div className={styles.sectionLabel}>{t("workStickerVariants")}</div>
      <div className={styles.variantChips}>
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className={`${styles.variantChip} ${tpl.id === template.id ? styles.variantChipSelected : ""}`}
            onClick={() => handleSelectVariant(tpl.id)}
          >
            {tpl.is_active && <span className={styles.variantDot} title={t("workStickerActiveVariant")} />}
            {tpl.name}
          </button>
        ))}
        <button type="button" className={styles.addVariantBtn} onClick={handleAddVariant} disabled={saving}>
          + {t("workStickerAddVariant")}
        </button>
      </div>

      <div className={styles.variantRow}>
        <div>
          <label>{t("workStickerVariantName")}</label>
          <input
            type="text"
            required
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button type="button" className={styles.chipBtn} onClick={handleDuplicate} disabled={saving}>
          {t("workStickerMakeCopy")}
        </button>
        {template.is_active ? (
          <span className={styles.activeBadge}>{t("workStickerActiveVariant")}</span>
        ) : (
          <>
            {/* Активация с несохранёнными правками не сохранила бы их — просим сначала сохранить. */}
            <button
              type="button"
              className={styles.chipBtn}
              disabled={saving || dirty}
              onClick={() => onActivate(template.id)}
            >
              {t("workStickerUseForPrint")}
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={saving}
              onClick={() => setPending({ open: true, kind: "delete", id: template.id })}
            >
              {t("delete")}
            </button>
          </>
        )}
      </div>

      <div className={styles.sectionLabel}>{t("workStickerSizeSection")}</div>
      <div className={styles.sizeRow}>
        <div>
          <label>{t("workStickerWidthMm")}</label>
          <input
            type="number"
            min="20"
            max="300"
            value={width}
            onChange={(e) => setWidth(clamp(Number(e.target.value) || 58, 20, 300))}
          />
        </div>
        <div>
          <label>{t("workStickerHeightMm")}</label>
          <input
            type="number"
            min="20"
            max="300"
            value={height}
            onChange={(e) => setHeight(clamp(Number(e.target.value) || 40, 20, 300))}
          />
        </div>
        <button type="button" className={styles.resetBtn} onClick={handleReset}>
          {t("workStickerResetLayout")}
        </button>
      </div>

      <div
        ref={canvasRef}
        className={styles.canvasWrap}
        style={{
          width: width * SCALE,
          height: height * SCALE,
          backgroundSize: `${GRID_MM * SCALE}px ${GRID_MM * SCALE}px`,
        }}
        onClick={() => setSelectedId(null)}
      >
        {elements.map((el) => (
          <motion.div
            key={`${el.id}-${el.x}-${el.y}-${el.w}-${el.h}`}
            className={`${styles.element} ${selectedId === el.id ? styles.elementSelected : ""}`}
            style={{ left: el.x * SCALE, top: el.y * SCALE, width: el.w * SCALE, height: el.h * SCALE }}
            drag
            dragMomentum={false}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(el.id);
            }}
            onDrag={(_, info) => handleDrag(el, info)}
            onDragEnd={(_, info) => handleDragEnd(el, info)}
          >
            <div className={styles.elementContent}>
              {el.type === "qr" ? (
                qrPreview && <img src={qrPreview} alt="" className={styles.qrPreview} draggable={false} />
              ) : (
                <TextPreview el={el} {...getPreviewText(el)} />
              )}
            </div>

            {selectedId === el.id && (
              <>
                <span
                  className={styles.deleteHandle}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeElement(el.id);
                  }}
                >
                  {Icons.clear}
                </span>
                <span
                  className={styles.resizeHandle}
                  onPointerDown={(e) => startResize(e, el)}
                />
              </>
            )}
          </motion.div>
        ))}

        {liveBox &&
          computeGuides(
            liveBox,
            elements.filter((e) => e.id !== liveBox.id),
            width,
            height,
          ).map((g) => {
            const distLabel = `${Math.round(g.dist * 10) / 10} ${t("workStickerMmUnit")}`;
            const lineClass = `${styles.guideLine} ${g.isCanvas ? styles.guideLineCanvas : ""}`;
            if (g.axis === "x") {
              return (
                <div key={g.key} className={styles.guideGroup}>
                  <div
                    className={lineClass}
                    style={{ left: g.from * SCALE, top: g.cross * SCALE, width: (g.to - g.from) * SCALE, height: 1 }}
                  />
                  <span
                    className={styles.guideLabel}
                    style={{ left: ((g.from + g.to) / 2) * SCALE, top: g.cross * SCALE }}
                  >
                    {distLabel}
                  </span>
                </div>
              );
            }
            return (
              <div key={g.key} className={styles.guideGroup}>
                <div
                  className={lineClass}
                  style={{ left: g.cross * SCALE, top: g.from * SCALE, width: 1, height: (g.to - g.from) * SCALE }}
                />
                <span
                  className={styles.guideLabel}
                  style={{ left: g.cross * SCALE, top: ((g.from + g.to) / 2) * SCALE }}
                >
                  {distLabel}
                </span>
              </div>
            );
          })}
      </div>

      {selected && selected.type === "qr" && (
        <div className={styles.fieldPanel}>
          <div>
            <label>{t("workStickerCodeType")}</label>
            <select
              value={selected.codeType || "qr"}
              onChange={(e) => updateElement(selected.id, { codeType: e.target.value })}
            >
              <option value="qr">{t("workStickerCodeTypeQr")}</option>
              <option value="datamatrix">{t("workStickerCodeTypeDataMatrix")}</option>
            </select>
          </div>
        </div>
      )}

      {selected && selected.field === "static" && (
        <div className={styles.textContentRow}>
          <label>{t("workStickerFreeTextLabel")}</label>
          <input
            type="text"
            maxLength={200}
            placeholder={t("workStickerFreeTextPlaceholder")}
            value={selected.text || ""}
            onChange={(e) => updateElement(selected.id, { text: e.target.value })}
          />
        </div>
      )}

      {selected && selected.type === "text" && (
        <div className={styles.fieldPanel}>
          <div>
            <label>{t("workStickerFontSize")}</label>
            <input
              type="number"
              min="5"
              max="30"
              value={selected.fontSize || 8}
              onChange={(e) => updateElement(selected.id, { fontSize: clamp(Number(e.target.value) || 8, 5, 30) })}
            />
          </div>
          <label className={styles.boldToggle}>
            <input
              type="checkbox"
              checked={!!selected.bold}
              onChange={(e) => updateElement(selected.id, { bold: e.target.checked })}
            />
            <span className={styles.boldMark}>B</span>
            {t("workStickerBold")}
          </label>
          <div>
            <label>{t("workStickerAlignHorizontal")}</label>
            <select
              value={selected.align || "left"}
              onChange={(e) => updateElement(selected.id, { align: e.target.value })}
            >
              <option value="left">{t("workStickerAlignLeft")}</option>
              <option value="center">{t("workStickerAlignCenter")}</option>
              <option value="right">{t("workStickerAlignRight")}</option>
            </select>
          </div>
          <div>
            <label>{t("workStickerAlignVertical")}</label>
            <select
              value={selected.valign || "top"}
              onChange={(e) => updateElement(selected.id, { valign: e.target.value })}
            >
              <option value="top">{t("workStickerAlignTop")}</option>
              <option value="middle">{t("workStickerAlignMiddle")}</option>
              <option value="bottom">{t("workStickerAlignBottom")}</option>
            </select>
          </div>
        </div>
      )}

      <div className={styles.addRow}>
        <span className={styles.addLabel}>{t("workStickerAddField")}:</span>
        {!hasQr && (
          <button type="button" className={styles.addBtn} onClick={addQr}>
            {t("workStickerFieldQr")}
          </button>
        )}
        {missingFieldKeys.map((field) => (
          <button key={field} type="button" className={styles.addBtn} onClick={() => addTextField(field)}>
            {t(FIELD_LABEL_KEYS[field])}
          </button>
        ))}
        <button type="button" className={styles.addBtn} onClick={addStaticText}>
          + {t("workStickerFreeText")}
        </button>
      </div>

      <div className={styles.submitRow}>
        <Button text={t("save")} type="submit" loading={saving} />
      </div>

      {/* CenterModal рендерится порталом в body — его кнопки вне <form> в DOM и submit не вызывают. */}
      <CenterModal
        isOpen={pending.open}
        onClose={() => setPending((prev) => ({ ...prev, open: false }))}
        onAccept={handleConfirmPending}
        message={pending.kind === "delete" ? t("areYouSureDelete") : t("workStickerDiscardChanges")}
      />
    </form>
  );
}
