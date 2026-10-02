import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Info } from "lucide-react";

import { updateProductionReportStickerRates } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { fmtNum, fmtInputValue, sanitizeNumericInput } from "../utils/quantity";

import styles from "./StickerRateModal.module.scss";

// Правка цены принятых стикеров из отчёта по производству: одного (карандаш в строке) или
// нескольких сразу (панель над таблицей). stickers — строки отчёта; цена одна на всех.
export default function StickerRateModal({ isOpen, stickers, onClose, onSaved }) {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [rate, setRate] = useState("");
  const [rateFocused, setRateFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const single = stickers.length === 1 ? stickers[0] : null;
  const mixed = new Set(stickers.map((sticker) => sticker.rate)).size > 1;
  const currentRate = !mixed && stickers.length > 0 ? stickers[0].rate : null;
  const operations = [...new Set(stickers.map((sticker) => sticker.operation_name))];

  // Свежая форма на каждое открытие: у одинаковых цен поле уже заполнено текущей
  useEffect(() => {
    if (!isOpen) return;
    setRate(currentRate !== null && currentRate !== undefined ? String(currentRate) : "");
    setRateFocused(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const rateValid = rate !== "" && Number.isFinite(Number(rate));

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving || !rateValid) return;
    setSaving(true);
    try {
      const { data } = await updateProductionReportStickerRates({
        ids: stickers.map((sticker) => sticker.id),
        rate: Number(rate),
      });

      const parts = [`${t("prodRateUpdated")}: ${data.updated}`];
      if (data.unchanged > 0) parts.push(`${t("prodRateUnchanged")}: ${data.unchanged}`);
      if (data.skipped > 0) parts.push(`${t("prodRateSkipped")}: ${data.skipped}`);
      // Ничего не тронуто (все пропущены) — это не успех
      showAlert(parts.join(" · "), data.updated + data.unchanged > 0 ? "success" : "error");

      onSaved?.();
      onClose();
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.form
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
          >
            <div className={styles.header}>
              <div className={styles.headerMain}>
                <span className={styles.title}>
                  {single ? single.sticker_code : t("prodRateEditTitle")}
                </span>
                <span className={styles.subtitle}>
                  {single
                    ? single.operation_name
                    : `${t("selected")}: ${stickers.length}`}
                </span>
              </div>
              <button type="button" className={styles.closeBtn} onClick={onClose}>
                <X size={15} />
              </button>
            </div>

            <div className={styles.body}>
              <div className={styles.hint}>
                <Info size={14} strokeWidth={2.2} />
                <span>{t("prodRateHint")}</span>
              </div>

              <div className={styles.summary}>
                {!single && (
                  <div className={styles.summaryRow}>
                    <span>{t("operationType")}</span>
                    <span className={styles.summaryValue}>{operations.join(", ")}</span>
                  </div>
                )}
                <div className={styles.summaryRow}>
                  <span>{t("prodRateCurrent")}</span>
                  <span className={styles.summaryValue}>
                    {mixed ? t("prodRateMixed") : fmtNum(currentRate)}
                  </span>
                </div>
              </div>

              <label className={styles.label}>{t("prodRateNew")}</label>
              <input
                type="text"
                inputMode="decimal"
                className={styles.input}
                autoFocus
                value={rateFocused ? rate : fmtInputValue(rate)}
                onChange={(e) => setRate(sanitizeNumericInput(e.target.value))}
                onFocus={() => setRateFocused(true)}
                onBlur={() => setRateFocused(false)}
              />
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                {t("cancel")}
              </button>
              <button type="submit" className={styles.saveBtn} disabled={saving || !rateValid}>
                {t("save")}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
