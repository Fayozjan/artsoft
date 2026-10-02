import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Info } from "lucide-react";

import { payrollApi } from "../api/payroll";
import { EmployeeService } from "../api/employees";
import { useAlertStore } from "../stores/alertStore";
import SelectEmployee from "./SelectEmployee";
import styles from "./AdvanceModal.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const today = () => new Date().toISOString().slice(0, 10);

const digitsOnly = (raw) => {
  const digits = String(raw).replace(/\D/g, "");
  return digits === "" ? "" : String(Number(digits));
};

// Выдача аванса: платим вперёд, когда остатка нет или месяц ещё не рассчитан.
// Сумма ничем не ограничена — переплата станет долгом сотрудника и удержится
// из будущего начисления.
//
// Без `employee` открывается с выбором сотрудника: в отчёт по выплатам попадают
// только те, у кого есть утверждённый месяц или выплата, а аванс нужен и
// остальным.
export default function AdvanceModal({
  isOpen,
  employee,
  year,
  months = [],
  defaultMonth,
  onClose,
  onChanged,
}) {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const picking = !employee;

  const [portalContainer, setPortalContainer] = useState(null);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [pickForm, setPickForm] = useState({ employee_id: "" });
  const [month, setMonth] = useState(defaultMonth || new Date().getMonth() + 1);
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const now = new Date();
  // Аванс выдают и вперёд, за ещё не наступивший месяц — доступен весь год.
  // Дата самой выплаты в будущее по-прежнему не уедет, её режет `max={today()}`.
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const selected = months.find((m) => m.month === month) || null;
  const pickedEmployee = employeeOptions.find(
    (o) => Number(o.id) === Number(pickForm.employee_id),
  );
  const employeeId = picking ? Number(pickForm.employee_id) || null : employee?.id;

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

  useEffect(() => {
    if (!isOpen || !picking || employeeOptions.length) return;
    EmployeeService.getActive()
      .then((res) => res.success && setEmployeeOptions(res.data || []))
      .catch(console.error);
  }, [isOpen, picking, employeeOptions.length]);

  // Свежая форма на каждое открытие
  useEffect(() => {
    if (!isOpen) return;
    setPickForm({ employee_id: "" });
    setMonth(defaultMonth || now.getMonth() + 1);
    setAmount("");
    setPayDate(today());
    setNote("");
  }, [isOpen, employee?.id, defaultMonth]);

  if (!portalContainer) return null;

  const fullName = picking
    ? pickedEmployee?.employeeFullName || t("giveAdvanceTitle")
    : [employee?.last_name, employee?.first_name, employee?.middle_name]
        .filter(Boolean)
        .join(" ");
  const employeeCode = picking
    ? pickedEmployee?.employeeNumber
    : employee?.employee_number || employee?.id;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await payrollApi.addAdvance({
        employee_id: employeeId,
        year,
        month,
        amount: Number(amount),
        payment_date: payDate,
        note: note.trim() || null,
      });
      if (!res.success) {
        // Сервер отдаёт ключ перевода; неизвестную строку i18next вернёт как есть
        showAlert(res.message ? t(res.message) : t("error"), "error");
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
      {isOpen && (
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
                  <span className={styles.name}>{fullName}</span>
                  {employeeCode && (
                    <span className={styles.code}>#{employeeCode}</span>
                  )}
                </span>
                <span className={styles.subtitle}>{t("giveAdvanceTitle")}</span>
              </div>
              <button className={styles.closeBtn} onClick={onClose}>
                <X size={15} />
              </button>
            </div>

            <div className={styles.body}>
              <div className={styles.hint}>
                <Info size={14} strokeWidth={2.2} />
                <span>{t("advanceHint")}</span>
              </div>

              {picking && (
                <>
                  <label className={styles.label}>{t("employee")}</label>
                  <div className={styles.employeePicker}>
                    <SelectEmployee
                      options={employeeOptions}
                      setFormData={setPickForm}
                      data="employee"
                      placeholder={t("selectEmployee")}
                    />
                  </div>
                </>
              )}

              <label className={styles.label}>{t("month")}</label>
              <select
                className={styles.input}
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {t(`months.${m}`)} {year}
                  </option>
                ))}
              </select>

              {/* Что уже есть в этом месяце: если начисления нет, строка так и скажет.
                  При выборе сотрудника вручную данных по месяцам нет — прячем */}
              <div
                className={styles.monthState}
                style={picking ? { display: "none" } : undefined}
              >
                <div className={styles.monthStateRow}>
                  <span>{t("net")}</span>
                  <span className={styles.monthStateValue}>
                    {selected ? fmt(selected.net) : t("noAccrual")}
                  </span>
                </div>
                <div className={styles.monthStateRow}>
                  <span>{t("remainingToPay")}</span>
                  <span className={styles.monthStateValue}>
                    {fmt(selected?.remaining)}
                  </span>
                </div>
                {selected?.advance > 0 && (
                  <div className={styles.monthStateRow}>
                    <span>{t("advances")}</span>
                    <span className={styles.monthStateAdvance}>
                      {fmt(selected.advance)}
                    </span>
                  </div>
                )}
              </div>

              <label className={styles.label}>{t("advanceAmount")}</label>
              <input
                type="text"
                inputMode="numeric"
                className={styles.input}
                placeholder="0"
                value={amount ? fmt(amount) : ""}
                onChange={(e) => setAmount(digitsOnly(e.target.value))}
              />

              <label className={styles.label}>{t("advanceDate")}</label>
              <input
                type="date"
                className={styles.input}
                max={today()}
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />

              <label className={styles.label}>{t("advanceNote")}</label>
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
                  saving || !employeeId || !amount || Number(amount) <= 0 || !payDate
                }
              >
                {t("giveAdvance")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer,
  );
}
