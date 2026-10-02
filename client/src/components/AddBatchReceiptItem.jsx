import { useState, useRef, forwardRef } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { useOnScreenKeyboardHandle } from "../hooks/useOnScreenKeyboardHandle";
import { appendBatchReceiptItems } from "../api";

import Button from "./Button";
import Loading from "./Loading";
import { Icons } from "../icons/icons";
import styles from "./AddBatchReceipt.module.scss";

const emptyItem = () => ({
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

// Добавление одной позиции в уже созданную партию (кнопка "Добавить позицию"
// в карточке партии).
const AddBatchReceiptItem = forwardRef(({ batchId, handleClose, onSuccess, keyboardOpen, onToggleKeyboard }, ref) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [item, setItem] = useState(emptyItem);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  useOnScreenKeyboardHandle(ref, formRef);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setItem((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!(Number(item.quantity) > 0)) {
      showAlert(t("error"), "error");
      return;
    }

    setSaving(true);
    try {
      const res = await appendBatchReceiptItems(batchId, [item]);
      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      onSuccess?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const textField = (name, label) => (
    <div>
      <label>{label}</label>
      <input type="text" name={name} value={item[name]} onChange={handleChange} />
    </div>
  );

  const numberField = (name, label, step, required = false) => (
    <div>
      <label>
        {label} {required && <span className={styles.req}>*</span>}
      </label>
      <input
        type="number"
        step={step}
        min="0"
        name={name}
        value={item[name]}
        onChange={handleChange}
        required={required}
      />
    </div>
  );

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
      {saving && <Loading />}

      <div className={styles.header}>
        <h2>{t("addBatchItem")}</h2>
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
          {textField("product_name", t("productName"))}
          {textField("size", t("size"))}
        </div>

        <div className={styles.row}>
          {textField("color", t("color"))}
          {textField("color_variant", t("colorVariant"))}
          {textField("color_tone", t("colorTone"))}
        </div>

        <div className={styles.row}>
          {textField("yarn_type", t("yarnType"))}
          {textField("material", t("material"))}
          {textField("design", t("design"))}
        </div>

        <div className={styles.row}>
          {numberField("quantity", t("quantity"), "0.0001", true)}
          {numberField("gross_weight_kg", t("grossWeight"), "0.0001")}
          {numberField("roll_count", t("rollCount"), "1")}
          {numberField("grammage", t("grammage"), "0.01")}
        </div>
      </div>

      <div className={styles.footer}>
        <Button text={t("save")} type="submit" loading={saving} />
      </div>
    </form>
  );
});

AddBatchReceiptItem.displayName = "AddBatchReceiptItem";

export default AddBatchReceiptItem;
