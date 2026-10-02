import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";
import {
  monthDebts,
  distributePayment,
  toPaymentEntries,
} from "../utils/payoutDebts";
import AdvanceDeduction from "./AdvanceDeduction";
import styles from "./PayMonthModal.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const today = () => new Date().toISOString().slice(0, 10);

// Digits only, capped at the month's remainder (rounded like it is displayed —
// the server caps the stored value at the exact remainder).
const clampAmount = (raw, max) => {
  const digits = String(raw).replace(/\D/g, "");
  if (digits === "") return "";
  return String(Math.min(Number(digits), Math.round(max)));
};

// Centred payment dialog: the month's remainder and the payment form, nothing else.
export default function PayMonthModal({
  isOpen,
  item,
  employeeName,
  employeeCode,
  months = [],
  onClose,
  onChanged,
}) {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [portalContainer, setPortalContainer] = useState(null);
  const [mode, setMode] = useState("total"); // "total" | "month"
  const [monthItemId, setMonthItemId] = useState(null);
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Every month that still owes something on its own (carry excluded)
  const openMonths = monthDebts(months).filter((m) => m.own > 0);

  const monthTarget =
    openMonths.find((m) => m.item_id === monthItemId) || openMonths[0] || null;

  const payingMonth = mode === "month" && monthTarget;

  // "total" распределяет платёж по месяцам, у каждого свой остаток
  const target = payingMonth ? { id: monthTarget.item_id } : item;

  // Режим месяца — долг одного месяца, «итого» — сумма по всем открытым.
  // Переносов между месяцами нет, поэтому остаток последней строки больше не
  // равен общему долгу: складываем сами.
  const totalRemaining = openMonths.reduce((s, m) => s + Number(m.own || 0), 0);
  const remaining = payingMonth
    ? monthTarget.own
    : parseFloat(Math.max(0, totalRemaining).toFixed(2));

  useEffect(() => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => document.body.removeChild(container);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Fresh form for every month the dialog is opened for
  useEffect(() => {
    if (!isOpen) return;
    setMode("total");
    setMonthItemId(null);
    setPayDate(today());
    setNote("");
  }, [isOpen, item?.id]);

  // Amount always follows whatever is being paid off right now
  useEffect(() => {
    setAmount(remaining > 0 ? String(Math.round(remaining)) : "");
  }, [mode, target?.id, remaining]);

  const allocation = distributePayment(amount, months);

  // Строка месяца целиком — в ней долг по авансу, которого нет в `item`
  const targetMonth = months.find((m) => m.item_id === target?.id) || null;

  if (!portalContainer) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        payment_date: payDate,
        note: note.trim() || null,
      };
      // Total mode writes one log per month so the debt closes oldest-first
      const res = payingMonth
        ? await payrollApi.addPaymentLog(target.id, {
            amount: Number(amount),
            ...payload,
          })
        : await payrollApi.addPaymentLogsBulk(
            toPaymentEntries(distributePayment(amount, months), months),
            payload,
          );
      if (!res.success) {
        showAlert(res.message || t("error"), "error");
        return;
      }
      showAlert(t("saved"), "success");
      onChanged?.();
      onClose();
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && item && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <div className={styles.headerMain}>
                <span className={styles.nameRow}>
                  <span className={styles.name}>{employeeName}</span>
                  {employeeCode && (
                    <span className={styles.code}>#{employeeCode}</span>
                  )}
                </span>
                <span className={styles.subtitle}>{t("paymentTitle")}</span>
              </div>
              <button className={styles.closeBtn} onClick={onClose}>
                <X size={15} />
              </button>
            </div>

            <div className={styles.body}>
              {openMonths.length > 0 && (
                <div className={styles.modeToggle}>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${mode === "total" ? styles.modeBtnActive : ""}`}
                    onClick={() => setMode("total")}
                  >
                    {t("payTotal")}
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${mode === "month" ? styles.modeBtnActive : ""}`}
                    onClick={() => setMode("month")}
                  >
                    {t("payByMonth")}
                  </button>
                </div>
              )}

              {mode === "month" && openMonths.length > 0 && (
                <>
                  <label className={styles.label}>{t("month")}</label>
                  <select
                    className={styles.input}
                    value={monthTarget?.item_id ?? ""}
                    onChange={(e) => setMonthItemId(Number(e.target.value))}
                  >
                    {openMonths.map((m) => (
                      <option key={m.item_id} value={m.item_id}>
                        {t(`months.${m.month}`)} — {fmt(m.own)}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* Аванс удерживается до выплаты месяца: иначе перенос обнулит долг */}
              <AdvanceDeduction month={targetMonth} onChanged={onChanged} />

              <div className={styles.remaining}>
                <span className={styles.remainingLabel}>
                  {t("remainingToPay")}
                </span>
                <span className={styles.remainingValue}>{fmt(remaining)}</span>
              </div>

              <label className={styles.label}>{t("amountLabel")}</label>
              <input
                type="text"
                inputMode="numeric"
                className={styles.input}
                placeholder="0"
                value={amount ? fmt(amount) : ""}
                onChange={(e) =>
                  setAmount(clampAmount(e.target.value, remaining))
                }
              />

              {mode === "total" && allocation.length > 0 && (
                <div className={styles.allocation}>
                  <div className={styles.allocationTitle}>
                    {t("monthlyBreakdown")}
                  </div>
                  {allocation.map((p) => (
                    <div key={p.month} className={styles.allocationRow}>
                      <span className={styles.allocationMonth}>
                        {t(`months.${p.month}`)}
                      </span>
                      <span className={styles.allocationAmount}>
                        {fmt(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <label className={styles.label}>{t("paymentDate")}</label>
              <input
                type="date"
                className={styles.input}
                max={today()}
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />

              <label className={styles.label}>{t("note")}</label>
              <input
                type="text"
                className={styles.input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={onClose}>
                {t("cancel")}
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={
                  saving || !amount || Number(amount) <= 0 || !payDate ||
                  remaining <= 0
                }
              >
                {t("payBtn")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer,
  );
}
