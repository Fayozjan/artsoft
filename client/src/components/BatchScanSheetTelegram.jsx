import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addBatchReceipt, appendBatchReceiptItems } from "../api";
import { parseScan } from "../utils/batchScan";
import { sanitizeNumericInput } from "../utils/quantity";
import { playScanSound } from "../utils/scanSound";
import { isTouchDevice } from "../utils/telegramScan";
import { useCameraScanner } from "../hooks/useCameraScanner";

import TgSheet from "./tg/TgSheet";
import { BatchItemSheet } from "./BatchReceiptSheetsTelegram";
import { IconQr, IconScan, IconCheck, IconClose, IconChevronRight, IconEdit } from "./tg/tgIcons";
import ui from "./tg/TgUi.module.scss";
import styles from "./BatchScanSheetTelegram.module.scss";

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_HEADER = () => ({ batch_number: "", order_number: "", customer: "", receipt_date: today() });

// Создание партии в Telegram — только сканированием: каждый считанный код добавляет
// позицию, шапка (партия, заказ, заказчик) берётся из первого кода. Считанное можно
// поправить до сохранения: количество и кг — прямо в карточке, остальное — карандашом.
// Камера читает DataMatrix и QR; поле ввода нужно только без камеры (ПК со сканером).
// initialCode — код, уже считанный камерой до открытия шторки (первая позиция).
// onSaved(id) — id созданной (или уже существовавшей) партии.
const BatchScanSheetTelegram = ({ isOpen, initialCode, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const camera = useCameraScanner();
  const touch = isTouchDevice();

  const [header, setHeader] = useState(EMPTY_HEADER);
  const [items, setItems] = useState([]);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(null); // { id, document_number, status }
  const [editIndex, setEditIndex] = useState(null); // позиция, открытая на полную правку
  const [editOpen, setEditOpen] = useState(false);

  // Камера отдаёт коды подряд из колбэка — актуальную шапку читаем из ref, не из замыкания.
  const headerRef = useRef(header);
  const inputRef = useRef(null);

  const updateHeader = (next) => {
    headerRef.current = next;
    setHeader(next);
  };

  useEffect(() => {
    if (!isOpen) return;
    updateHeader(EMPTY_HEADER());
    setItems([]);
    setCode("");
    setDuplicate(null);
    setEditOpen(false);
    // Первый код камера уже считала (и подала сигнал) до открытия шторки.
    if (initialCode) handleCode(initialCode, true);
    // Аппаратный сканер «печатает» в поле; на телефоне фокус поднял бы клавиатуру.
    else if (!touch) setTimeout(() => inputRef.current?.focus(), 350);
  }, [isOpen, touch]);

  // silent — без сигнала (код уже принят и озвучен снаружи). Возвращает, добавлена ли позиция.
  function handleCode(raw, silent = false) {
    const value = String(raw || "").trim();
    if (!value) return false;

    const parsed = parseScan(value);
    if (!parsed) {
      playScanSound("error");
      showAlert(t("invalidScanData"), "error");
      return false;
    }

    const current = headerRef.current;
    if (current.batch_number && parsed.batch_number && parsed.batch_number !== current.batch_number) {
      playScanSound("error");
      showAlert(t("scanBatchMismatch"), "error");
      return false;
    }

    updateHeader({
      ...current,
      batch_number: parsed.batch_number || current.batch_number,
      order_number: parsed.order_number || current.order_number,
      customer: parsed.customer || current.customer,
    });
    setItems((prev) => [
      ...prev,
      {
        product_name: parsed.product_name,
        color: parsed.color,
        color_variant: parsed.color_variant,
        color_tone: parsed.color_tone,
        size: parsed.size,
        yarn_type: parsed.yarn_type,
        material: parsed.material,
        design: parsed.design,
        quantity: parsed.quantity,
        gross_weight_kg: parsed.gross_weight_kg,
        roll_count: parsed.roll_count,
        grammage: parsed.grammage,
      },
    ]);
    setDuplicate(null);
    if (!silent) playScanSound("success");
    return true;
  }

  const submitCode = () => {
    handleCode(code);
    setCode("");
    if (!touch) inputRef.current?.focus();
  };

  const handleCamera = () => {
    if (saving) return;
    camera.start(handleCode);
  };

  const removeItem = (index) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Позиций не осталось — можно начать с кодом другой партии.
      if (next.length === 0) updateHeader({ ...EMPTY_HEADER(), receipt_date: headerRef.current.receipt_date });
      return next;
    });
    setDuplicate(null);
  };

  // Быстрая правка количества и кг прямо в карточке.
  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    setDuplicate(null);
  };

  const openEdit = (index) => {
    setEditIndex(index);
    setEditOpen(true);
  };

  // Количество обязательно: пустое или нулевое сервер молча отбросит вместе с позицией.
  const hasInvalidQuantity = items.some((item) => !(Number(item.quantity) > 0));

  const handleSave = async () => {
    if (saving || items.length === 0) return;
    if (hasInvalidQuantity) {
      showAlert(t("error"), "error");
      return;
    }
    setSaving(true);
    try {
      const res = await addBatchReceipt({ ...header, comment: "", items });
      if (!res?.success) throw new Error(res?.error || t("error"));
      showAlert(t("success"), "success");
      onSaved?.(res.data?.id);
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

  // Партия с таким номером уже есть — дописываем считанные позиции в неё.
  const handleMerge = async () => {
    if (saving || !duplicate) return;
    setSaving(true);
    try {
      const res = await appendBatchReceiptItems(duplicate.id, items);
      if (!res?.success) throw new Error(res?.error || t("error"));
      showAlert(t("success"), "success");
      onSaved?.(duplicate.id);
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("scanBatchReceiptTitle")}
      footer={
        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={handleSave}
            disabled={saving || items.length === 0 || hasInvalidQuantity}
          >
            <IconCheck />
            {saving ? t("loading") : items.length > 0 ? `${t("save")} · ${items.length}` : t("save")}
          </button>
        </div>
      }
    >
      <div className={ui.form}>
        {camera.available && (
          <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${styles.cameraBtn}`} onClick={handleCamera} disabled={saving}>
            <IconQr />
            {t("tgScanCamera")}
          </button>
        )}

        {/* Поле кода — только без камеры (ПК с внешним сканером): с камерой «ожидания скана» нет. */}
        {!camera.available && (
        <div className={styles.scanBox}>
          <span className={styles.scanIcon}>
            <IconScan />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitCode();
              }
            }}
            placeholder={t("scanInputPlaceholder")}
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
          />
          {code.trim() && (
            <button type="button" className={styles.goBtn} onClick={submitCode} aria-label={t("tgFind")}>
              <IconChevronRight />
            </button>
          )}
        </div>
        )}

        {duplicate && (
          <div className={ui.notice}>
            <span>
              <b>{t("batchAlreadyExistsTitle")}.</b>{" "}
              {t("batchAlreadyExistsMessage", {
                batchNumber: header.batch_number,
                documentNumber: duplicate.document_number,
                status: t(duplicate.status),
              })}
            </span>
            <div className={ui.noticeActions}>
              <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={handleMerge} disabled={saving}>
                {t("addToExistingBatch")}
              </button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <IconScan />
            </span>
            <p>{camera.available ? t("tgCameraScanHint") : t("scanInputLabel")}</p>
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <div className={styles.summaryMain}>
                <span>{t("batchNumber")}</span>
                <b>{header.batch_number || "—"}</b>
              </div>
              {header.order_number && (
                <div>
                  <span>{t("customerOrderNumber")}</span>
                  <b>{header.order_number}</b>
                </div>
              )}
              {header.customer && (
                <div>
                  <span>{t("customer")}</span>
                  <b>{header.customer}</b>
                </div>
              )}
            </div>

            <div className={ui.field}>
              <label className={ui.label}>{t("receiptDate")}</label>
              <input
                className={ui.input}
                type="date"
                value={header.receipt_date}
                onChange={(e) => updateHeader({ ...headerRef.current, receipt_date: e.target.value })}
              />
            </div>

            <ul className={styles.list}>
              {items.map((item, index) => {
                const invalid = !(Number(item.quantity) > 0);
                return (
                  <li className={styles.item} key={index}>
                    <div className={styles.itemHead}>
                      <div className={styles.itemMain}>
                        <b>{item.product_name || "—"}</b>
                        <span>{[item.color, item.size, item.material, item.design].filter(Boolean).join(" · ")}</span>
                      </div>
                      <button type="button" className={styles.iconBtn} onClick={() => openEdit(index)} aria-label={t("edit")}>
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => removeItem(index)}
                        aria-label={t("removeItemRow")}
                      >
                        <IconClose />
                      </button>
                    </div>

                    <div className={styles.itemFields}>
                      <div className={ui.field}>
                        <label className={ui.label}>
                          {t("quantity")} <span className={ui.req}>*</span>
                        </label>
                        <input
                          className={`${ui.input} ${styles.compactInput} ${invalid ? styles.invalid : ""}`}
                          type="text"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: sanitizeNumericInput(e.target.value) })}
                          onFocus={(e) => e.target.select()}
                          autoComplete="off"
                        />
                      </div>
                      <div className={ui.field}>
                        <label className={ui.label}>{t("grossWeight")}</label>
                        <input
                          className={`${ui.input} ${styles.compactInput}`}
                          type="text"
                          inputMode="decimal"
                          value={item.gross_weight_kg}
                          onChange={(e) => updateItem(index, { gross_weight_kg: sanitizeNumericInput(e.target.value) })}
                          onFocus={(e) => e.target.select()}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </TgSheet>

    <BatchItemSheet
      isOpen={editOpen}
      item={items[editIndex]}
      onClose={() => setEditOpen(false)}
      onSave={(form) => {
        updateItem(editIndex, form);
        setEditOpen(false);
      }}
    />

    {camera.element}
    </>
  );
};

export default BatchScanSheetTelegram;
