import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addBatchReceipt, editBatchReceiptById, appendBatchReceiptItems } from "../api";

import TgSheet from "./tg/TgSheet";
import ui from "./tg/TgUi.module.scss";
import { IconCheck } from "./tg/tgIcons";

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_HEADER = () => ({
  batch_number: "",
  receipt_date: today(),
  order_number: "",
  customer: "",
  comment: "",
});

const EMPTY_ITEM = () => ({
  product_name: "",
  size: "",
  color: "",
  color_variant: "",
  color_tone: "",
  yarn_type: "",
  material: "",
  design: "",
  quantity: "",
  gross_weight_kg: "",
  roll_count: "",
  grammage: "",
});

// Мобильная клавиатура с запятой вместо точки не должна съедать дробную часть.
const toNumeric = (raw) => {
  let v = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
  return v;
};

// Позиция в теле PUT: сервер удаляет позиции, которых в запросе нет, поэтому при
// правке одной позиции или шапки отправляем весь список как есть (с id).
const toPayloadItem = (it) => ({
  id: it.id,
  product_name: it.product_name,
  color: it.color,
  color_variant: it.color_variant,
  color_tone: it.color_tone,
  size: it.size,
  yarn_type: it.yarn_type,
  material: it.material,
  design: it.design,
  quantity: it.quantity,
  gross_weight_kg: it.gross_weight_kg,
  roll_count: it.roll_count,
  grammage: it.grammage,
});

// ── Шапка партии: создание и правка ──────────────────────────────────────────

// batch — правка (нужны его позиции); без batch — создание пустой партии, позиции
// добавляются уже внутри неё. onSaved(id) — id сохранённой (или уже существующей) партии.
export const BatchHeaderSheet = ({ isOpen, batch, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const isEdit = Boolean(batch);

  const [header, setHeader] = useState(EMPTY_HEADER);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(null); // { id, document_number, status }

  useEffect(() => {
    if (!isOpen) return;
    setDuplicate(null);
    setHeader(
      batch
        ? {
            batch_number: batch.batch_number || "",
            receipt_date: (batch.receipt_date || "").slice(0, 10) || today(),
            order_number: batch.order_number || "",
            customer: batch.customer || "",
            comment: batch.comment || "",
          }
        : EMPTY_HEADER(),
    );
  }, [isOpen, batch]);

  const change = (e) => {
    const { name, value } = e.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
    if (name === "batch_number") setDuplicate(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!header.batch_number.trim() || !header.receipt_date) {
      showAlert(t("error"), "error");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...header, items: isEdit ? (batch.items || []).map(toPayloadItem) : [] };
      const res = isEdit ? await editBatchReceiptById(batch.id, payload) : await addBatchReceipt(payload);
      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      onSaved?.(res.data?.id ?? batch?.id);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === "DUPLICATE_BATCH_NUMBER" && data.existing) {
        setDuplicate(data.existing);
      } else {
        showAlert(data?.error || err.message || t("error"), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t("editBatchReceipt") : t("addBatchReceipt")}
      subtitle={isEdit && batch.document_number ? `${t("documentNumber")}: ${batch.document_number}` : undefined}
      footer={
        <div className={ui.btnRow}>
          <button
            type="submit"
            form="tg-batch-header-form"
            className={`${ui.btn} ${ui.btnPrimary}`}
            disabled={saving}
          >
            <IconCheck />
            {saving ? t("loading") : t("save")}
          </button>
        </div>
      }
    >
      <form id="tg-batch-header-form" className={ui.form} onSubmit={submit}>
        <div className={ui.field}>
          <label className={ui.label}>
            {t("batchNumber")} <span className={ui.req}>*</span>
          </label>
          <input
            className={ui.input}
            type="text"
            name="batch_number"
            value={header.batch_number}
            onChange={change}
            autoComplete="off"
            enterKeyHint="next"
          />
        </div>

        {duplicate && (
          <div className={ui.notice}>
            <span>
              <b>{t("batchAlreadyExistsTitle")}.</b>{" "}
              {t("batchAlreadyExistsOpenMessage", {
                batchNumber: header.batch_number,
                documentNumber: duplicate.document_number,
                status: t(duplicate.status),
              })}
            </span>
            <div className={ui.noticeActions}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnPrimary}`}
                onClick={() => onSaved?.(duplicate.id)}
              >
                {t("openExistingBatch")}
              </button>
            </div>
          </div>
        )}

        <div className={ui.grid2}>
          <div className={ui.field}>
            <label className={ui.label}>
              {t("receiptDate")} <span className={ui.req}>*</span>
            </label>
            <input
              className={ui.input}
              type="date"
              name="receipt_date"
              value={header.receipt_date}
              onChange={change}
            />
          </div>
          <div className={ui.field}>
            <label className={ui.label}>{t("customerOrderNumber")}</label>
            <input
              className={ui.input}
              type="text"
              name="order_number"
              value={header.order_number}
              onChange={change}
              autoComplete="off"
            />
          </div>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>{t("customer")}</label>
          <input
            className={ui.input}
            type="text"
            name="customer"
            value={header.customer}
            onChange={change}
            autoComplete="off"
          />
        </div>

        <div className={ui.field}>
          <label className={ui.label}>{t("comment")}</label>
          <textarea className={ui.textarea} name="comment" value={header.comment} onChange={change} rows={3} />
        </div>
      </form>
    </TgSheet>
  );
};

// ── Позиция партии: добавление и правка ──────────────────────────────────────

// item — правка (batch нужен целиком: его позиции уйдут в PUT); без item — добавление
// новой позиции в партию. onSave(form) — локальный режим (партия ещё не создана, как при
// сканировании): форма ничего не отправляет на сервер, а отдаёт правки вызывающему.
export const BatchItemSheet = ({ isOpen, batch, item, onClose, onSaved, onSave }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const isEdit = Boolean(item);

  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      item
        ? Object.fromEntries(
            Object.keys(EMPTY_ITEM()).map((key) => [key, item[key] === null || item[key] === undefined ? "" : String(item[key])]),
          )
        : EMPTY_ITEM(),
    );
  }, [isOpen, item]);

  const setText = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const setNumber = (e) => setForm((prev) => ({ ...prev, [e.target.name]: toNumeric(e.target.value) }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!(Number(form.quantity) > 0)) {
      showAlert(t("error"), "error");
      return;
    }

    if (onSave) {
      onSave(form);
      return;
    }

    setSaving(true);
    try {
      let res;
      if (isEdit) {
        const items = (batch.items || []).map((it) => (it.id === item.id ? { ...toPayloadItem(it), ...form } : toPayloadItem(it)));
        res = await editBatchReceiptById(batch.id, {
          batch_number: batch.batch_number,
          receipt_date: (batch.receipt_date || "").slice(0, 10),
          order_number: batch.order_number || "",
          customer: batch.customer || "",
          comment: batch.comment || "",
          items,
        });
      } else {
        res = await appendBatchReceiptItems(batch.id, [form]);
      }
      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      onSaved?.(res.data);
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const text = (name, label) => (
    <div className={ui.field}>
      <label className={ui.label}>{label}</label>
      <input className={ui.input} type="text" name={name} value={form[name]} onChange={setText} autoComplete="off" />
    </div>
  );

  const number = (name, label, required = false) => (
    <div className={ui.field}>
      <label className={ui.label}>
        {label} {required && <span className={ui.req}>*</span>}
      </label>
      <input
        className={ui.input}
        type="text"
        inputMode={name === "roll_count" ? "numeric" : "decimal"}
        name={name}
        value={form[name]}
        onChange={setNumber}
        autoComplete="off"
      />
    </div>
  );

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t("edit") : t("addBatchItem")}
      subtitle={isEdit ? item.product_name || undefined : batch ? `${t("batchNumber")}: ${batch.batch_number}` : undefined}
      footer={
        <div className={ui.btnRow}>
          <button type="submit" form="tg-batch-item-form" className={`${ui.btn} ${ui.btnPrimary}`} disabled={saving}>
            <IconCheck />
            {saving ? t("loading") : t("save")}
          </button>
        </div>
      }
    >
      <form id="tg-batch-item-form" className={ui.form} onSubmit={submit}>
        {text("product_name", t("productName"))}

        <div className={ui.grid2}>
          {number("quantity", t("quantity"), true)}
          {text("size", t("size"))}
        </div>

        <div className={ui.grid2}>
          {text("color", t("color"))}
          {text("color_variant", t("colorVariant"))}
          {text("color_tone", t("colorTone"))}
          {text("yarn_type", t("yarnType"))}
          {text("material", t("material"))}
          {text("design", t("design"))}
        </div>

        <div className={ui.grid2}>
          {number("gross_weight_kg", t("grossWeight"))}
          {number("roll_count", t("rollCount"))}
          {number("grammage", t("grammage"))}
        </div>
      </form>
    </TgSheet>
  );
};
