import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Pencil, Trash2, Plus } from "lucide-react";

import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";
import {
  monthDebts,
  distributePayment,
  toPaymentEntries,
} from "../utils/payoutDebts";
import { Icons } from "../icons/icons";
import AdvanceDeduction from "./AdvanceDeduction";
import styles from "./EmployeeYearModal.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const today = () => new Date().toISOString().slice(0, 10);

const digitsOnly = (raw) => String(raw).replace(/\D/g, "");

const monthName = (t, m) => (m ? t(`months.${m}`) : "—");

const clampTo = (value, max) =>
  value === "" ? "" : String(Math.min(Number(value), Math.round(max)));

// Digits only, never above the month's own cap. The cap is rounded the same
// way the amount is displayed, so a remainder of 0.6 shown as 1 stays payable —
// the server caps the stored value at the exact remainder.
const clampAmount = (raw, max) => {
  const digits = String(raw).replace(/\D/g, "");
  if (digits === "") return "";
  return String(Math.min(Number(digits), Math.round(max)));
};

// Second card, opens beside the modal: payment log of one month, or — in
// `isTotal` mode — the whole balance, split across months as it is paid.
const PaymentHistoryCard = ({
  month,
  title,
  onClose,
  onChanged,
  payOnOpen,
  isTotal = false,
  allMonths = [],
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [draft, setDraft] = useState({ amount: "", payment_date: "", note: "" });
  const [busy, setBusy] = useState(false);

  // «Итого» гасит все открытые месяцы разом, режим месяца — только свой.
  // Переносов нет, поэтому общий долг складывается из месяцев, а не берётся
  // с последней строки.
  const totalRemaining = allMonths.reduce((s, m) => s + Number(m.own || 0), 0);
  const remaining = Math.max(
    0,
    Number(isTotal ? totalRemaining : (month.own ?? month.remaining) || 0),
  );
  const [payOpen, setPayOpen] = useState(Boolean(payOnOpen) && remaining > 0);
  const [payDraft, setPayDraft] = useState({
    amount: "",
    payment_date: today(),
    note: "",
  });

  const loadLogs = () =>
    payrollApi
      .getPaymentLogs(month.item_id)
      .then((res) => setLogs(res.success ? res.data : []))
      .catch(() => setLogs([]));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setEditingId(null);
    setConfirmId(null);
    payrollApi
      .getPaymentLogs(month.item_id)
      .then((res) => alive && setLogs(res.success ? res.data : []))
      .catch(() => alive && setLogs([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [month.item_id]);

  // Total mode opens straight into the form, so prefill the whole balance
  useEffect(() => {
    if (!isTotal) return;
    setPayDraft({
      amount: remaining > 0 ? String(Math.round(remaining)) : "",
      payment_date: today(),
      note: "",
    });
  }, [isTotal, month.item_id, remaining]);

  const startEdit = (log) => {
    setConfirmId(null);
    setEditingId(log.id);
    setDraft({
      amount: String(Math.round(Number(log.amount) || 0)),
      payment_date: String(log.payment_date).slice(0, 10),
      note: log.note || "",
    });
  };

  const handleSaveEdit = async (logId) => {
    setBusy(true);
    try {
      const res = await payrollApi.updatePaymentLog(month.item_id, logId, {
        amount: Number(draft.amount),
        payment_date: draft.payment_date,
        note: draft.note.trim() || null,
      });
      if (!res.success) {
        showAlert(res.message || t("error"), "error");
        return;
      }
      showAlert(t("saved"), "success");
      setEditingId(null);
      await loadLogs();
      onChanged?.();
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleAddPayment = async () => {
    setBusy(true);
    try {
      const payload = {
        payment_date: payDraft.payment_date,
        note: payDraft.note.trim() || null,
      };
      // Total mode writes one log per month instead of dumping everything
      // on the carrier month
      const res = isTotal
        ? await payrollApi.addPaymentLogsBulk(
            toPaymentEntries(
              distributePayment(payDraft.amount, allMonths),
              allMonths,
            ),
            payload,
          )
        : await payrollApi.addPaymentLog(month.item_id, {
            amount: Number(payDraft.amount),
            ...payload,
          });
      if (!res.success) {
        showAlert(res.message || t("error"), "error");
        return;
      }
      showAlert(t("saved"), "success");
      setPayDraft({ amount: "", payment_date: today(), note: "" });
      setPayOpen(false);
      await loadLogs();
      onChanged?.();
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (logId) => {
    setBusy(true);
    try {
      const res = await payrollApi.deletePaymentLog(month.item_id, logId);
      if (!res.success) {
        showAlert(res.message || t("error"), "error");
        return;
      }
      showAlert(t("saved"), "success");
      setConfirmId(null);
      await loadLogs();
      onChanged?.();
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setBusy(false);
    }
  };

  // Долг — не погашение зарплаты, в итог выплат по месяцу он не входит
  const total = logs.reduce(
    (sum, l) => sum + (l.is_loan ? 0 : Number(l.amount || 0)),
    0,
  );
  const allocation = isTotal
    ? distributePayment(payDraft.amount, allMonths)
    : [];

  const header = (
    <div className={styles.sideHeader}>
      <div className={styles.sideHeaderMain}>
        <span className={styles.sideTitle}>
          {isTotal ? t("paymentTitle") : t("paymentHistory")}
        </span>
        <span className={styles.sideSub}>{title}</span>
      </div>
      <button className={styles.closeBtn} onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  );

  // Total mode is a plain payment form — remainder, amount, split, date, note
  if (isTotal) {
    return (
      <div className={styles.sideCard}>
        {header}

        <div className={styles.sideBody}>
          {/* Аванс удерживается до выплаты месяца: иначе перенос обнулит долг */}
          <AdvanceDeduction month={month} onChanged={onChanged} />

          <div className={styles.remainingBox}>
            <span className={styles.remainingBoxLabel}>
              {t("remainingToPay")}
            </span>
            <span className={styles.remainingBoxValue}>{fmt(remaining)}</span>
          </div>

          <label className={styles.editLabel}>{t("amountLabel")}</label>
          <input
            type="text"
            inputMode="numeric"
            className={styles.editInput}
            placeholder="0"
            value={payDraft.amount ? fmt(payDraft.amount) : ""}
            onChange={(e) =>
              setPayDraft((d) => ({
                ...d,
                amount: clampAmount(e.target.value, remaining),
              }))
            }
          />

          {allocation.length > 0 && (
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

          <label className={styles.editLabel}>{t("paymentDate")}</label>
          <input
            type="date"
            className={styles.editInput}
            max={today()}
            value={payDraft.payment_date}
            onChange={(e) =>
              setPayDraft((d) => ({ ...d, payment_date: e.target.value }))
            }
          />

          <label className={styles.editLabel}>{t("note")}</label>
          <input
            type="text"
            className={styles.editInput}
            value={payDraft.note}
            onChange={(e) => setPayDraft((d) => ({ ...d, note: e.target.value }))}
          />

          <div className={styles.editActions}>
            <button
              className={styles.editCancel}
              onClick={onClose}
              disabled={busy}
            >
              {t("cancel")}
            </button>
            <button
              className={styles.editSave}
              onClick={handleAddPayment}
              disabled={
                busy ||
                !payDraft.amount ||
                Number(payDraft.amount) <= 0 ||
                !payDraft.payment_date ||
                remaining <= 0
              }
            >
              {t("payBtn")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sideCard}>
      {header}

      <div className={styles.sideBody}>
        {loading ? (
          <div className={styles.sideEmpty}>…</div>
        ) : logs.length === 0 ? (
          <div className={styles.sideEmpty}>{t("noData")}</div>
        ) : (
          <ul className={styles.logList}>
            {logs.map((log) => {
              if (editingId === log.id) {
                return (
                  <li key={log.id} className={styles.logItemEditing}>
                    <label className={styles.editLabel}>{t("amountLabel")}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={styles.editInput}
                      value={draft.amount ? fmt(draft.amount) : ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          // editing frees this log's own amount back up
                          amount: clampAmount(
                            e.target.value,
                            remaining + Number(log.amount || 0),
                          ),
                        }))
                      }
                    />

                    <label className={styles.editLabel}>{t("paymentDate")}</label>
                    <input
                      type="date"
                      className={styles.editInput}
                      max={today()}
                      value={draft.payment_date}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, payment_date: e.target.value }))
                      }
                    />

                    <label className={styles.editLabel}>{t("note")}</label>
                    <input
                      type="text"
                      className={styles.editInput}
                      value={draft.note}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, note: e.target.value }))
                      }
                    />

                    <div className={styles.editActions}>
                      <button
                        className={styles.editCancel}
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                      >
                        {t("cancel")}
                      </button>
                      <button
                        className={styles.editSave}
                        onClick={() => handleSaveEdit(log.id)}
                        disabled={
                          busy || !draft.amount || Number(draft.amount) <= 0 ||
                          !draft.payment_date
                        }
                      >
                        {t("save")}
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <li key={log.id} className={styles.logItem}>
                  <div className={styles.logRow}>
                    <span className={styles.logDate}>
                      {fmtDate(log.payment_date)}
                      {log.is_loan && (
                        <span className={styles.logLoanTag}>{t("debt")}</span>
                      )}
                    </span>
                    <span
                      className={`${styles.logAmount} ${log.is_loan ? styles.logLoanAmount : ""}`}
                    >
                      {fmt(log.amount)}
                    </span>

                    <span className={styles.logActions}>
                      <button
                        className={styles.logAction}
                        onClick={() => startEdit(log)}
                        title={t("edit")}
                      >
                        <Pencil size={13} strokeWidth={2.2} />
                      </button>
                      <button
                        className={`${styles.logAction} ${styles.logActionDanger}`}
                        onClick={() => {
                          setEditingId(null);
                          setConfirmId(confirmId === log.id ? null : log.id);
                        }}
                        title={t("delete")}
                      >
                        <Trash2 size={13} strokeWidth={2.2} />
                      </button>
                    </span>
                  </div>
                  {log.note && <div className={styles.logNote}>{log.note}</div>}

                  {confirmId === log.id && (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>
                        {t("confirmDelete")}
                      </span>
                      <button
                        className={styles.confirmNo}
                        onClick={() => setConfirmId(null)}
                        disabled={busy}
                      >
                        {t("no")}
                      </button>
                      <button
                        className={styles.confirmYes}
                        onClick={() => handleDelete(log.id)}
                        disabled={busy}
                      >
                        {t("yes")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Долг идёт отдельной зоной над оплатой и не зависит от `remaining`:
          месяц может быть закрыт по выплатам, а долг на нём висеть */}
      <div className={styles.deductZone}>
        <AdvanceDeduction month={month} onChanged={onChanged} />
      </div>

      {/* Add payment */}
      {remaining > 0 && (
        <div className={styles.payZone}>
          {payOpen ? (
            <>
              <div className={styles.payHint}>
                {t("remainingToPay")}: <b>{fmt(remaining)}</b>
              </div>

              <label className={styles.editLabel}>{t("amountLabel")}</label>
              <input
                type="text"
                inputMode="numeric"
                className={styles.editInput}
                placeholder="0"
                value={payDraft.amount ? fmt(payDraft.amount) : ""}
                onChange={(e) =>
                  setPayDraft((d) => ({
                    ...d,
                    amount: clampAmount(e.target.value, remaining),
                  }))
                }
              />

              {allocation.length > 0 && (
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

              <label className={styles.editLabel}>{t("paymentDate")}</label>
              <input
                type="date"
                className={styles.editInput}
                max={today()}
                value={payDraft.payment_date}
                onChange={(e) =>
                  setPayDraft((d) => ({ ...d, payment_date: e.target.value }))
                }
              />

              <label className={styles.editLabel}>{t("note")}</label>
              <input
                type="text"
                className={styles.editInput}
                value={payDraft.note}
                onChange={(e) =>
                  setPayDraft((d) => ({ ...d, note: e.target.value }))
                }
              />

              <div className={styles.editActions}>
                <button
                  className={styles.editCancel}
                  onClick={() => setPayOpen(false)}
                  disabled={busy}
                >
                  {t("cancel")}
                </button>
                <button
                  className={styles.editSave}
                  onClick={handleAddPayment}
                  disabled={
                    busy ||
                    !payDraft.amount ||
                    Number(payDraft.amount) <= 0 ||
                    !payDraft.payment_date
                  }
                >
                  {t("payBtn")}
                </button>
              </div>
            </>
          ) : (
            <button
              className={styles.payOpenBtn}
              onClick={() => {
                setPayDraft({
                  amount: String(Math.round(remaining)),
                  payment_date: today(),
                  note: "",
                });
                setPayOpen(true);
              }}
            >
              {Icons.check} {t("markPaid")}
            </button>
          )}
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className={styles.sideFooter}>
          <span>{t("alreadyPaid")}</span>
          <span className={styles.sideFooterValue}>{fmt(total)}</span>
        </div>
      )}
    </div>
  );
};

// Вся история долга сотрудника за год: выдачи авансов и долгов, погашения
// удержанием. Открывается кликом по виджету «Долг».
const DebtHistoryCard = ({ employeeId, year, onClose, onChanged }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmKey, setConfirmKey] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      payrollApi
        .getDebtHistory(employeeId, year)
        .then((res) => setData(res.success ? res.data : null))
        .catch(() => setData(null)),
    [employeeId, year],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setConfirmKey(null);
    payrollApi
      .getDebtHistory(employeeId, year)
      .then((res) => alive && setData(res.success ? res.data : null))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [employeeId, year]);

  // Выдачу удаляем из своей таблицы, погашение — обнулением удержания строки
  const handleDelete = async (event) => {
    setBusy(true);
    try {
      const res =
        event.type === "repay"
          ? await payrollApi.updateItem(event.item_id, {
              debt_deduction: 0,
              debt_mode: "skip",
            })
          : await payrollApi.deleteLoan(event.id);
      if (!res.success) {
        showAlert(res.message ? t(res.message) : t("error"), "error");
        return;
      }
      showAlert(t("saved"), "success");
      setConfirmKey(null);
      await load();
      onChanged?.();
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const events = data?.events || [];
  const totals = data?.totals || { issued: 0, repaid: 0, outstanding: 0 };

  const label = (type) =>
    type === "repay" ? t("repaidToDebt") : type === "loan" ? t("debt") : t("advances");

  return (
    <div className={styles.sideCard}>
      <div className={styles.sideHeader}>
        <div className={styles.sideHeaderMain}>
          <span className={styles.sideTitle}>{t("debtHistory")}</span>
          <span className={styles.sideSub}>{year}</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <div className={styles.sideBody}>
        <div className={styles.debtTotals}>
          <div className={styles.debtTotal}>
            <span className={styles.debtTotalLabel}>{t("debtIssued")}</span>
            <span className={styles.debtTotalValue}>{fmt(totals.issued)}</span>
          </div>
          <div className={styles.debtTotal}>
            <span className={styles.debtTotalLabel}>{t("debtRepaid")}</span>
            <span className={`${styles.debtTotalValue} ${styles.paidVal}`}>
              {fmt(totals.repaid)}
            </span>
          </div>
          <div className={styles.debtTotal}>
            <span className={styles.debtTotalLabel}>{t("outstanding")}</span>
            <span className={`${styles.debtTotalValue} ${styles.debtVal}`}>
              {fmt(totals.outstanding)}
            </span>
          </div>
        </div>

        {loading ? (
          <div className={styles.sideEmpty}>…</div>
        ) : events.length === 0 ? (
          <div className={styles.sideEmpty}>{t("noData")}</div>
        ) : (
          <ul className={styles.logList}>
            {events.map((e, i) => {
              const key = `${e.type}-${e.id ?? e.item_id}-${i}`;
              return (
                <li key={key} className={styles.logItem}>
                  <div className={styles.logRow}>
                    <span className={styles.logDate}>
                      {e.date ? fmtDate(e.date) : monthName(t, e.month)}
                      <span
                        className={
                          e.type === "repay" ? styles.eventTagRepay : styles.eventTagIssue
                        }
                      >
                        {label(e.type)}
                      </span>
                    </span>
                    <span
                      className={`${styles.logAmount} ${e.type === "repay" ? styles.paidVal : styles.debtVal}`}
                    >
                      {e.type === "repay" ? "−" : "+"}
                      {fmt(e.amount)}
                    </span>

                    {/* Аванс правится в истории выплат своего месяца, не здесь */}
                    {e.type !== "advance" && (
                      <span className={styles.logActions}>
                        <button
                          className={`${styles.logAction} ${styles.logActionDanger}`}
                          onClick={() =>
                            setConfirmKey(confirmKey === key ? null : key)
                          }
                          title={t("delete")}
                        >
                          <Trash2 size={13} strokeWidth={2.2} />
                        </button>
                      </span>
                    )}
                  </div>
                  {e.note && <div className={styles.logNote}>{e.note}</div>}

                  {confirmKey === key && (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>{t("confirmDelete")}</span>
                      <button
                        className={styles.confirmNo}
                        onClick={() => setConfirmKey(null)}
                        disabled={busy}
                      >
                        {t("no")}
                      </button>
                      <button
                        className={styles.confirmYes}
                        onClick={() => handleDelete(e)}
                        disabled={busy}
                      >
                        {t("yes")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

// Выдача займа. Ведомости он не касается вообще: ни месяца, ни строки расчёта,
// ни выплаты по зарплате. Гасится потом удержанием из остатка любого месяца.
const LoanCard = ({ employeeId, onClose, onChanged }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [draft, setDraft] = useState({
    amount: "",
    issued_at: today(),
    note: "",
  });
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      const res = await payrollApi.addLoan({
        employee_id: employeeId,
        amount: Number(draft.amount),
        issued_at: draft.issued_at,
        note: draft.note.trim() || null,
      });
      if (!res.success) {
        showAlert(res.message ? t(res.message) : t("error"), "error");
        return;
      }
      showAlert(t("saved"), "success");
      onChanged?.();
      onClose();
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.sideCard}>
      <div className={styles.sideHeader}>
        <div className={styles.sideHeaderMain}>
          <span className={styles.sideTitle}>{t("giveLoanTitle")}</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <div className={styles.sideBody}>
        <div className={styles.advanceHint}>{t("loanHint")}</div>

        <label className={styles.editLabel}>{t("loanAmount")}</label>
        <input
          type="text"
          inputMode="numeric"
          className={styles.editInput}
          placeholder="0"
          value={draft.amount ? fmt(draft.amount) : ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, amount: digitsOnly(e.target.value) }))
          }
        />

        <label className={styles.editLabel}>{t("advanceDate")}</label>
        <input
          type="date"
          className={styles.editInput}
          max={today()}
          value={draft.issued_at}
          onChange={(e) => setDraft((d) => ({ ...d, issued_at: e.target.value }))}
        />

        <label className={styles.editLabel}>{t("advanceNote")}</label>
        <input
          type="text"
          className={styles.editInput}
          value={draft.note}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        />

        <div className={styles.editActions}>
          <button className={styles.editCancel} onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <button
            className={styles.advanceSave}
            onClick={handleSave}
            disabled={busy || !draft.amount || Number(draft.amount) <= 0 || !draft.issued_at}
          >
            {t("giveLoan")}
          </button>
        </div>
      </div>
    </div>
  );
};

// Выдача аванса за один месяц — той же боковой карточкой, что и выплата.
// Месяц берётся из строки, по которой нажали, поэтому выбора месяца тут нет.
const AdvanceCard = ({
  employeeId,
  year,
  month,
  title,
  existing,
  monthSalary = 0,
  onClose,
  onChanged,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  // Аванс ограничен месячной ставкой, иначе он заведомо не покроется
  // начислением. Тот же потолок стоит на сервере.
  const limit = Math.max(0, monthSalary - existing);

  const [draft, setDraft] = useState({
    amount: "",
    payment_date: today(),
    note: "",
  });
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      const res = await payrollApi.addAdvance({
        employee_id: employeeId,
        year,
        month,
        amount: Number(draft.amount),
        payment_date: draft.payment_date,
        note: draft.note.trim() || null,
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
      setBusy(false);
    }
  };

  return (
    <div className={styles.sideCard}>
      <div className={styles.sideHeader}>
        <div className={styles.sideHeaderMain}>
          <span className={styles.sideTitle}>{t("giveAdvanceTitle")}</span>
          <span className={styles.sideSub}>{title}</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <div className={styles.sideBody}>
        <div className={styles.advanceHint}>{t("advanceHint")}</div>

        {existing > 0 && (
          <div className={styles.advanceBox}>
            <span className={styles.advanceBoxLabel}>{t("advances")}</span>
            <span className={styles.advanceBoxValue}>{fmt(existing)}</span>
          </div>
        )}

        <label className={styles.editLabel}>{t("advanceAmount")}</label>
        <input
          type="text"
          inputMode="numeric"
          className={styles.editInput}
          placeholder="0"
          value={draft.amount ? fmt(draft.amount) : ""}
          onChange={(e) =>
            setDraft((d) => ({
              // Аванс ничем не ограничен сверху — он и есть выплата вперёд
              ...d,
              amount: clampTo(digitsOnly(e.target.value), limit),
            }))
          }
        />

        {monthSalary > 0 && (
          <div className={styles.advanceLimit}>
            {t("maxDeduct")}: {fmt(limit)}
          </div>
        )}

        <label className={styles.editLabel}>{t("advanceDate")}</label>
        <input
          type="date"
          className={styles.editInput}
          max={today()}
          value={draft.payment_date}
          onChange={(e) =>
            setDraft((d) => ({ ...d, payment_date: e.target.value }))
          }
        />

        <label className={styles.editLabel}>{t("advanceNote")}</label>
        <input
          type="text"
          className={styles.editInput}
          value={draft.note}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        />

        <div className={styles.editActions}>
          <button
            className={styles.editCancel}
            onClick={onClose}
            disabled={busy}
          >
            {t("cancel")}
          </button>
          <button
            className={styles.advanceSave}
            onClick={handleSave}
            disabled={
              busy ||
              !draft.amount ||
              Number(draft.amount) <= 0 ||
              !draft.payment_date
            }
          >
            {t("giveAdvance")}
          </button>
        </div>
      </div>
    </div>
  );
};

// Year breakdown of one employee: months in the modal, and the picked month's
// payment history as a separate card next to it.
export default function EmployeeYearModal({
  isOpen,
  row,
  year,
  onClose,
  onChanged,
}) {
  const { t } = useTranslation();
  const [portalContainer, setPortalContainer] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  // true when the side card should open straight into the payment form
  const [payOnOpen, setPayOnOpen] = useState(false);
  // side card paying the whole balance, split across months
  const [totalPayOpen, setTotalPayOpen] = useState(false);
  // месяц, за который выдаётся аванс или долг; null — карточка закрыта
  const [advanceMonth, setAdvanceMonth] = useState(null);
  const [loanOpen, setLoanOpen] = useState(false);
  // карточка истории долга справа
  const [debtHistoryOpen, setDebtHistoryOpen] = useState(false);

  const openMonth = (itemId, withPayForm) => {
    setTotalPayOpen(false);
    setAdvanceMonth(null);
    setDebtHistoryOpen(false);
    setLoanOpen(false);
    setSelectedItemId((prev) =>
      prev === itemId && !withPayForm ? null : itemId,
    );
    setPayOnOpen(Boolean(withPayForm));
  };

  const openTotalPay = () => {
    setSelectedItemId(null);
    setAdvanceMonth(null);
    setDebtHistoryOpen(false);
    setLoanOpen(false);
    setPayOnOpen(true);
    setTotalPayOpen(true);
  };

  // Аванс занимает тот же слот справа — вторую карточку рядом не открываем
  const openAdvance = (monthNum) => {
    setSelectedItemId(null);
    setTotalPayOpen(false);
    setPayOnOpen(false);
    setDebtHistoryOpen(false);
    setLoanOpen(false);
    setAdvanceMonth((prev) => (prev === monthNum ? null : monthNum));
  };

  const openLoan = () => {
    setSelectedItemId(null);
    setTotalPayOpen(false);
    setPayOnOpen(false);
    setAdvanceMonth(null);
    setDebtHistoryOpen(false);
    setLoanOpen((v) => !v);
  };

  useEffect(() => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => document.body.removeChild(container);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      // Escape closes the side card first, then the modal
      if (advanceMonth !== null) setAdvanceMonth(null);
      else if (loanOpen) setLoanOpen(false);
      else if (debtHistoryOpen) setDebtHistoryOpen(false);
      else if (selectedItemId) setSelectedItemId(null);
      else onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose, selectedItemId, advanceMonth, debtHistoryOpen, loanOpen]);

  // Reset the picked month whenever another employee is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedItemId(null);
      setAdvanceMonth(null);
      setDebtHistoryOpen(false);
      setLoanOpen(false);
    }
  }, [isOpen, row?.employee?.id]);

  if (!portalContainer) return null;

  const emp = row?.employee;
  // `own` — the month's own share of the running balance
  const months = monthDebts(row?.months || []);
  const carrier = months[months.length - 1] || null;
  const selected = totalPayOpen
    ? carrier
    : months.find((m) => m.item_id === selectedItemId) || null;

  const fullName = [emp?.last_name, emp?.first_name, emp?.middle_name]
    .filter(Boolean)
    .join(" ");
  const subtitle = [emp?.branch?.name, emp?.department?.name, emp?.position?.name]
    .filter(Boolean)
    .join(" · ");
  const employeeCode = emp?.employee_number || emp?.id;

  const monthLabel = (m) => (m ? t(`months.${m}`) : "—");

  const totals = months.reduce(
    (acc, m) => ({
      net: acc.net + Number(m.net || 0),
      paid: acc.paid + Number(m.paid_amount || 0),
      own: acc.own + Number(m.own || 0),
    }),
    { net: 0, paid: 0, own: 0 },
  );
  // Последний месяц года — цель по умолчанию для выдачи и общей оплаты
  const carrierMonth = months[months.length - 1];
  // ...и он же несёт непогашенный долг: по месяцам долг переносится, а не копится
  // Общий долг сотрудника: займы и переплаты минус удержанное
  const carrierDebt = Number(row?.debt_total || 0);

  // Удержать долг можно только там, где он висит входящим И есть что выдать.
  // Берём самый поздний такой месяц; если платить нигде нечего — просто
  // последний месяц с долгом, чтобы карточка открылась и объяснила почему.

  // В отчёт попадают только месяцы с утверждённой строкой или выплатой, из-за
  // чего список шёл с дырами. Показываем год целиком, пустые месяцы — заглушкой.
  // Для расчётов по-прежнему используется `months`: последний РЕАЛЬНЫЙ месяц
  // несёт весь баланс, заглушка его подменять не должна.
  const nowDate = new Date();
  const currentMonth =
    Number(year) === nowDate.getFullYear() ? nowDate.getMonth() + 1 : null;
  const byMonth = new Map(months.map((m) => [m.month, m]));
  const displayMonths = Array.from({ length: 12 }, (_, i) => {
    const num = i + 1;
    return (
      byMonth.get(num) || {
        month: num,
        item_id: null,
        missing: true,
        net: 0,
        paid_amount: 0,
        own: 0,
      }
    );
  });

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && row && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          >
            <div className={styles.stack} onClick={(e) => e.stopPropagation()}>
              {/* ── Card 1: months ───────────────────────────────────────── */}
              <motion.div
                className={styles.modal}
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <div className={styles.header}>
                  <div className={styles.headerMain}>
                    <span className={styles.headerNameRow}>
                      <span className={styles.headerName}>{fullName}</span>
                      {employeeCode && (
                        <span className={styles.headerId}>#{employeeCode}</span>
                      )}
                    </span>
                    {subtitle && (
                      <span className={styles.headerSub}>{subtitle}</span>
                    )}
                  </div>
                  <span className={styles.headerYear}>{year}</span>
                  <button className={styles.closeBtn} onClick={onClose}>
                    <X size={15} />
                  </button>
                </div>

                <div className={styles.totals}>
                  <div className={styles.total}>
                    <span className={styles.totalLabel}>{t("yearAccrued")}</span>
                    <span className={styles.totalValue}>
                      {fmt(row.totals?.net)}
                    </span>
                  </div>
                  <div className={styles.total}>
                    <span className={styles.totalLabel}>{t("yearPaid")}</span>
                    <span className={`${styles.totalValue} ${styles.paidVal}`}>
                      {fmt(row.totals?.paid_amount)}
                    </span>

                  </div>
                  <div className={styles.total}>
                    <span className={styles.totalLabel}>{t("outstanding")}</span>
                    <span
                      className={`${styles.totalValue} ${row.outstanding > 0 ? styles.dueVal : ""}`}
                    >
                      {fmt(row.outstanding)}
                    </span>
                    {/* Часть начисленного ушла не на руки, а в погашение долга —
                        объясняет, почему остаток меньше начисленного */}
                    {row.totals?.debt_deduction > 0 && (
                      <span className={styles.totalSub}>
                        −{fmt(row.totals.debt_deduction)} {t("repaidToDebt")}
                      </span>
                    )}
                  </div>
                  {/* Долг не суммируется по месяцам — он переносится, поэтому
                      берём непогашенный остаток последнего месяца */}
                  <div className={styles.total}>
                    <span className={styles.totalLabel}>{t("debt")}</span>
                    {/* Обёртка — якорь для «+»: кнопка липнет к самой сумме,
                        а не к краю колонки, поэтому читается как «добавить долг» */}
                    <span className={styles.totalValueWrap}>
                      {/* Клик по сумме открывает всю историю долга за год */}
                      <span
                        role="button"
                        tabIndex={0}
                        title={t("debtHistory")}
                        className={`${styles.totalValue} ${styles.totalValueLink} ${carrierDebt > 0 ? styles.debtVal : ""}`}
                        onClick={() => {
                          setSelectedItemId(null);
                          setAdvanceMonth(null);
                          setDebtHistoryOpen((v) => !v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            setDebtHistoryOpen((v) => !v);
                        }}
                      >
                        {fmt(carrierDebt)}
                      </span>
                      <button
                        className={styles.loanBtn}
                        onClick={openLoan}
                        title={t("giveLoan")}
                        aria-label={t("giveLoan")}
                      >
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </span>
                  </div>
                </div>

                <div className={styles.monthList}>
                  {/* Header lives inside the scroll box so the scrollbar shifts
                      it together with the rows and the columns stay aligned */}
                  <div className={styles.monthHead}>
                    <span>{t("month")}</span>
                    <span>{t("net")}</span>
                    <span>{t("paidAmount")}</span>
                    <span>{t("remainingToPay")}</span>
                    <span>{t("status")}</span>
                    <span>{t("action")}</span>
                  </div>

                  {displayMonths.map((m) => {
                    const isActive =
                      m.item_id !== null && m.item_id === selectedItemId;
                    const settled = m.own <= 0;
                    // Ноль "на руки" — начислений нет, статус отдельный
                    const noAccrual = Number(m.net || 0) === 0;
                    // Месяц попал в выплаты авансом, но ещё не утверждён
                    const notApproved = m.status !== "approved";
                    const isCurrent = m.month === currentMonth;

                    return (
                      <div
                        key={m.item_id ?? `empty-${m.month}`}
                        role={m.missing ? undefined : "button"}
                        tabIndex={m.missing ? undefined : 0}
                        className={`${styles.monthItem} ${m.missing ? styles.monthItemEmpty : ""} ${isCurrent ? styles.monthItemCurrent : ""} ${isActive ? styles.monthItemActive : ""}`}
                        onClick={() => !m.missing && openMonth(m.item_id, false)}
                        onKeyDown={(e) => {
                          if (!m.missing && (e.key === "Enter" || e.key === " "))
                            openMonth(m.item_id, false);
                        }}
                      >
                        <span className={styles.monthName}>
                          {monthLabel(m.month)}
                          {isCurrent && (
                            <span
                              className={styles.currentBadge}
                              title={t("currentMonth")}
                            >
                              {t("nowBadge")}
                            </span>
                          )}
                        </span>
                        <span className={styles.monthNet}>
                          {m.missing ? "—" : fmt(m.net)}
                        </span>

                        <span
                          className={`${styles.monthPaid} ${m.paid_amount > 0 ? styles.paidVal : ""}`}
                        >
                          {m.missing ? "—" : fmt(m.paid_amount)}
                        </span>
                        <span
                          className={`${styles.monthDue} ${m.own > 0 ? styles.dueVal : ""}`}
                        >
                          {m.missing ? "—" : fmt(m.own)}
                          {m.debt_deduction > 0 && (
                            <span className={styles.dueDebtNote}>
                              −{fmt(m.debt_deduction)} {t("repaidToDebt")}
                            </span>
                          )}
                        </span>
                        <span
                          className={`${styles.monthBadge} ${
                            m.missing || noAccrual
                              ? styles.monthBadgeEmpty
                              : settled
                                ? styles.monthBadgePaid
                                : styles.monthBadgeDue
                          }`}
                        >
                          {m.missing ? (
                            t("notCalculated")
                          ) : notApproved ? (
                            t("notApproved")
                          ) : noAccrual ? (
                            t("noAccrual")
                          ) : settled ? (
                            <>
                              {Icons.check} {t("paid")}
                            </>
                          ) : (
                            t("pendingPayout")
                          )}
                        </span>

                        <span className={styles.monthAction}>
                          {m.missing || notApproved ? (
                            // Платить нечего — начисления ещё нет, но аванс вперёд
                            // выдать можно, в том числе за будущий месяц
                            <button
                              className={styles.advanceBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                openAdvance(m.month);
                              }}
                            >
                              {t("giveAdvance")}
                            </button>
                          ) : (
                            // Есть остаток — только «Оплатить». Удержание долга
                            // живёт внутри формы оплаты, отдельная кнопка дублировала
                            !settled && (
                              <button
                                className={styles.payBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openMonth(m.item_id, true);
                                }}
                              >
                                {t("markPaid")}
                              </button>
                            )
                          )}
                        </span>
                      </div>
                    );
                  })}

                  {months.length > 0 && (
                    <div className={styles.monthTotal}>
                      <span className={styles.monthName}>{t("total")}</span>
                      <span className={styles.monthNet}>{fmt(totals.net)}</span>
                      <span className={`${styles.monthPaid} ${totals.paid > 0 ? styles.paidVal : ""}`}>
                        {fmt(totals.paid)}
                      </span>
                      <span className={`${styles.monthDue} ${totals.own > 0 ? styles.dueVal : ""}`}>
                        {fmt(totals.own)}
                      </span>
                      <span />
                      <span className={styles.monthAction}>
                        {totals.own > 0 && carrierMonth && (
                          <button
                            className={styles.payBtn}
                            onClick={openTotalPay}
                          >
                            {t("markPaid")}
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ── Card 2: payment history of the picked month ──────────── */}
              <AnimatePresence mode="wait">
                {advanceMonth !== null && (
                  <motion.div
                    key={`advance-${advanceMonth}`}
                    className={styles.sideWrapper}
                    initial={{ opacity: 0, x: -18, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -18, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <AdvanceCard
                      employeeId={emp?.id}
                      year={year}
                      month={advanceMonth}
                      title={`${monthLabel(advanceMonth)} ${year}`}
                      existing={byMonth.get(advanceMonth)?.advance || 0}
                      monthSalary={
                        byMonth.get(advanceMonth)?.base_salary ??
                        carrierMonth?.base_salary ??
                        0
                      }
                      onClose={() => setAdvanceMonth(null)}
                      onChanged={onChanged}
                    />
                  </motion.div>
                )}

                {advanceMonth === null && loanOpen && (
                  <motion.div
                    key="loan"
                    className={styles.sideWrapper}
                    initial={{ opacity: 0, x: -18, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -18, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <LoanCard
                      employeeId={emp?.id}
                      onClose={() => setLoanOpen(false)}
                      onChanged={onChanged}
                    />
                  </motion.div>
                )}

                {advanceMonth === null && !loanOpen && debtHistoryOpen && (
                  <motion.div
                    key="debt-history"
                    className={styles.sideWrapper}
                    initial={{ opacity: 0, x: -18, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -18, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <DebtHistoryCard
                      employeeId={emp?.id}
                      year={year}
                      onClose={() => setDebtHistoryOpen(false)}
                      onChanged={onChanged}
                    />
                  </motion.div>
                )}

                {advanceMonth === null && !loanOpen && !debtHistoryOpen && selected && (
                  <motion.div
                    key={`${selected.item_id}-${totalPayOpen ? "total" : payOnOpen ? "pay" : "log"}`}
                    className={styles.sideWrapper}
                    initial={{ opacity: 0, x: -18, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -18, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <PaymentHistoryCard
                      month={selected}
                      title={
                        totalPayOpen
                          ? `${t("total")} ${year}`
                          : `${monthLabel(selected.month)} ${year}`
                      }
                      isTotal={totalPayOpen}
                      allMonths={months}
                      onClose={() => {
                        setTotalPayOpen(false);
                        setSelectedItemId(null);
                      }}
                      onChanged={onChanged}
                      payOnOpen={payOnOpen}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    portalContainer,
  );
}
