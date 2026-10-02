import { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { useOnScreenKeyboardHandle } from "../hooks/useOnScreenKeyboardHandle";
import {
  getBatchReceiptById,
  addBatchReceipt,
  editBatchReceiptById,
  appendBatchReceiptItems,
} from "../api";

import { parseScan } from "../utils/batchScan";
import Button from "./Button";
import Loading from "./Loading";
import CenterModal from "./CenterModal";
import { Icons } from "../icons/icons";
import styles from "./AddBatchReceipt.module.scss";

const isBlankItem = (item) => Object.values(item).every((v) => !v);

const emptyItem = () => ({
  product_name: "",
  color: "",
  color_variant: "",
  color_tone: "",
  size: "",
  yarn_type: "",
  material: "",
  design: "",
  quantity: "",
  gross_weight_kg: "",
  roll_count: "",
  grammage: "",
});

// mode (только при создании):
//   "manual" — создаётся одна шапка партии, позиции добавляются внутри партии;
//   "scan"   — шапка + позиции, которые считываются сканером.
const AddBatchReceipt = forwardRef(({ id, mode = "manual", handleClose, onSuccess, keyboardOpen, onToggleKeyboard }, ref) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const isEdit = Boolean(id);
  const isScanAdd = !isEdit && mode === "scan";
  const headerOnly = !isEdit && !isScanAdd;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState({
    document_number: "",
    batch_number: "",
    receipt_date: new Date().toISOString().slice(0, 10),
    order_number: "",
    customer: "",
    comment: "",
  });
  const [items, setItems] = useState([emptyItem()]);
  const [duplicatePrompt, setDuplicatePrompt] = useState(null); // { existing, items }
  const [mergeSaving, setMergeSaving] = useState(false);

  const [scanMode, setScanMode] = useState(isScanAdd);
  const [scanValue, setScanValue] = useState("");
  const scanInputRef = useRef(null);

  const formRef = useRef(null);

  const loadData = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await getBatchReceiptById(id);
      const data = res.data;
      setHeader({
        document_number: data.document_number || "",
        batch_number: data.batch_number || "",
        receipt_date: (data.receipt_date || "").slice(0, 10),
        order_number: data.order_number || "",
        customer: data.customer || "",
        comment: data.comment || "",
      });
      setItems(
        (data.items || []).length > 0
          ? data.items.map((it) => ({
              id: it.id,
              // По позиции уже печатались стикеры — она заблокирована для правки.
              started: (it._count?.workStickers ?? 0) > 0,
              product_name: it.product_name || "",
              color: it.color || "",
              color_variant: it.color_variant || "",
              color_tone: it.color_tone || "",
              size: it.size || "",
              yarn_type: it.yarn_type || "",
              material: it.material || "",
              design: it.design || "",
              quantity: it.quantity ?? "",
              gross_weight_kg: it.gross_weight_kg ?? "",
              roll_count: it.roll_count ?? "",
              grammage: it.grammage ?? "",
            }))
          : [emptyItem()],
      );
    } catch (err) {
      console.error(err);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (scanMode) scanInputRef.current?.focus();
  }, [scanMode]);

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [name]: value } : item)),
    );
  };

  useOnScreenKeyboardHandle(ref, formRef);

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);

  const removeRow = (index) =>
    setItems((prev) =>
      prev.length > 1 && !prev[index]?.started ? prev.filter((_, i) => i !== index) : prev,
    );

  const handleScanKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const raw = scanValue.trim();
    setScanValue("");
    if (!raw) return;

    const parsed = parseScan(raw);
    if (!parsed) {
      showAlert(t("invalidScanData"), "error");
      return;
    }

    if (header.batch_number && parsed.batch_number && parsed.batch_number !== header.batch_number) {
      showAlert(t("scanBatchMismatch"), "error");
      return;
    }

    setHeader((prev) => ({
      ...prev,
      batch_number: parsed.batch_number || prev.batch_number,
      order_number: parsed.order_number || prev.order_number,
      customer: parsed.customer || prev.customer,
    }));

    const newItem = {
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
    };

    setItems((prev) =>
      prev.length === 1 && isBlankItem(prev[0]) ? [newItem] : [...prev, newItem],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const validItems = items.filter((item) => Number(item.quantity) > 0);
    if (isScanAdd && validItems.length === 0) {
      showAlert(t("error"), "error");
      return;
    }

    setSaving(true);
    try {
      const { document_number, ...headerPayload } = header;
      // Ручное создание — только шапка, позиции добавляются внутри партии.
      const payload = { ...headerPayload, items: headerOnly ? [] : items };
      const res = isEdit
        ? await editBatchReceiptById(id, payload)
        : await addBatchReceipt(payload);

      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      // После ручного создания страница открывает новую партию.
      onSuccess?.(headerOnly ? res.data?.id : undefined);
    } catch (err) {
      if (!isEdit && err?.response?.data?.code === "DUPLICATE_BATCH_NUMBER") {
        setDuplicatePrompt({ existing: err.response.data.existing, items });
        return;
      }
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmMerge = async () => {
    if (!duplicatePrompt || mergeSaving) return;
    setMergeSaving(true);
    try {
      // Ручное создание: позиций нет — просто открываем существующую партию.
      if (!headerOnly) {
        const res = await appendBatchReceiptItems(duplicatePrompt.existing.id, duplicatePrompt.items);
        if (!res?.success) throw new Error(res?.error || t("error"));
        showAlert(t("success"), "success");
      }
      onSuccess?.(duplicatePrompt.existing.id);
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setMergeSaving(false);
      setDuplicatePrompt(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <>
      <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
        {(saving || mergeSaving) && <Loading />}

        <div className={styles.header}>
          <h2>
            {isEdit ? t("editBatchReceipt") : isScanAdd ? t("scanBatchReceiptTitle") : t("addBatchReceipt")}
            {isEdit && header.document_number && (
              <span className={styles.headerDocNumber}>
                {t("documentNumber")}: {header.document_number}
              </span>
            )}
          </h2>
          <div className={styles.headerActions}>
            {onToggleKeyboard && (
              <button
                type="button"
                className={`${styles.keyboardToggleBtn} ${keyboardOpen ? styles.active : ""}`}
                onClick={onToggleKeyboard}
                title={t("onScreenKeyboard")}
              >
                {Icons.keyboard}
              </button>
            )}
            <span onClick={handleClose} style={{ display: "flex", cursor: "pointer" }}>
              {Icons.clear}
            </span>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.row}>
            <div>
              <label>{t("batchNumber")} <span className={styles.req}>*</span></label>
              <input
                type="text"
                name="batch_number"
                value={header.batch_number}
                onChange={handleHeaderChange}
                required
              />
            </div>
            <div>
              <label>{t("receiptDate")} <span className={styles.req}>*</span></label>
              <input
                type="date"
                name="receipt_date"
                value={header.receipt_date}
                onChange={handleHeaderChange}
                onFocus={(e) => e.target.showPicker?.()}
                required
              />
            </div>
            <div>
              <label>{t("customerOrderNumber")}</label>
              <input
                type="text"
                name="order_number"
                value={header.order_number}
                onChange={handleHeaderChange}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div>
              <label>{t("customer")}</label>
              <input
                type="text"
                name="customer"
                value={header.customer}
                onChange={handleHeaderChange}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.full}>
              <label>{t("comment")}</label>
              <textarea
                name="comment"
                value={header.comment}
                onChange={handleHeaderChange}
                rows={2}
              />
            </div>
          </div>

          {!headerOnly && (
            <>
              <div className={styles.itemsHeader}>
                <h3>{t("lineItems")}</h3>
                <div className={styles.itemsHeaderActions}>
                  {!isScanAdd && (
                    <button
                      type="button"
                      className={`${styles.scanToggleBtn} ${scanMode ? styles.active : ""}`}
                      onClick={() => setScanMode((v) => !v)}
                    >
                      {Icons.scan} {t("addByScan")}
                    </button>
                  )}
                  <button type="button" className={styles.addRowBtn} onClick={addRow}>
                    {Icons.plus} {t("addItemRow")}
                  </button>
                </div>
              </div>

              {scanMode && (
                <div className={styles.scanBox}>
                  <label>{t("scanInputLabel")}</label>
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={handleScanKeyDown}
                    // Возвращаем фокус сканеру только если он потерян "в никуда"
                    // (сбой сканера/окна) — если пользователь кликнул в другое
                    // поле формы, чтобы отредактировать данные, не мешаем.
                    onBlur={(e) => {
                      if (scanMode && !e.relatedTarget) scanInputRef.current?.focus();
                    }}
                    placeholder={t("scanInputPlaceholder")}
                  />
                </div>
              )}

              {items.some((item) => item.started) && (
                <div className={styles.lockedHint}>{t("batchItemsLockedHint")}</div>
              )}

              <div className={styles.itemsTableWrap}>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>{t("productName")}</th>
                      <th>{t("color")}</th>
                      <th>{t("colorVariant")}</th>
                      <th>{t("colorTone")}</th>
                      <th>{t("size")}</th>
                      <th>{t("yarnType")}</th>
                      <th>{t("material")}</th>
                      <th>{t("design")}</th>
                      <th>{t("quantity")}</th>
                      <th>{t("grossWeight")}</th>
                      <th>{t("rollCount")}</th>
                      <th>{t("grammage")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className={item.started ? styles.lockedRow : undefined}>
                        <td><input type="text" name="product_name" value={item.product_name} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="text" name="color" value={item.color} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="text" name="color_variant" value={item.color_variant} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="text" name="color_tone" value={item.color_tone} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="text" name="size" value={item.size} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="text" name="yarn_type" value={item.yarn_type} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="text" name="material" value={item.material} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="text" name="design" value={item.design} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="number" step="0.0001" min="0" name="quantity" value={item.quantity} onChange={(e) => handleItemChange(index, e)} disabled={item.started} required={!isBlankItem(item)} /></td>
                        <td><input type="number" step="0.0001" min="0" name="gross_weight_kg" value={item.gross_weight_kg} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="number" step="1" min="0" name="roll_count" value={item.roll_count} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td><input type="number" step="0.01" min="0" name="grammage" value={item.grammage} onChange={(e) => handleItemChange(index, e)} disabled={item.started} /></td>
                        <td>
                          <button
                            type="button"
                            className={styles.removeRowBtn}
                            onClick={() => removeRow(index)}
                            disabled={item.started}
                            title={item.started ? t("batchItemStarted") : t("removeItemRow")}
                          >
                            {Icons.delete}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <Button text={t("save")} type="submit" loading={saving} />
        </div>
      </form>

      <CenterModal
        isOpen={!!duplicatePrompt}
        onClose={() => setDuplicatePrompt(null)}
        onAccept={handleConfirmMerge}
        tag={t("batchAlreadyExistsTitle")}
        message={
          duplicatePrompt
            ? t(headerOnly ? "batchAlreadyExistsOpenMessage" : "batchAlreadyExistsMessage", {
                batchNumber: header.batch_number,
                documentNumber: duplicatePrompt.existing.document_number,
                status: t(duplicatePrompt.existing.status),
              })
            : ""
        }
        acceptText={t(headerOnly ? "openExistingBatch" : "addToExistingBatch")}
        cancelText={t("cancel")}
      />
    </>
  );
});

AddBatchReceipt.displayName = "AddBatchReceipt";

export default AddBatchReceipt;
