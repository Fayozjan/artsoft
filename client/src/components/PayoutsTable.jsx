import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";
import styles from "./PayoutsTable.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const today = () => new Date().toISOString().slice(0, 10);

const IconCheck = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconUndo = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7v6h6" />
    <path d="M3 13C5 8.5 9.5 5 15 5a9 9 0 0 1 6 15" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

// ── AmountPickerPopover (debt only) ────────────────────────────────────────────

const QUICK_PCTS = [25, 50, 75, 100];

function AmountPickerPopover({
  title,
  rows = [],
  maxAmount = 0,
  initialAmount = 0,
  showComment = false,
  accentColor = "#3b82f6",
  saveLabel,
  onSave,
  onClose,
}) {
  const { t } = useTranslation();
  const popRef = useRef();

  const [amount, setAmount] = useState(
    initialAmount > 0 ? String(initialAmount) : "",
  );
  const [pct, setPct] = useState(
    initialAmount > 0 && maxAmount > 0
      ? String(Math.round((initialAmount / maxAmount) * 100))
      : "",
  );
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fn = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);

  const applyAmount = (val) => {
    const n = Math.min(Math.max(Number(val) || 0, 0), maxAmount);
    setAmount(String(n));
    setPct(maxAmount > 0 ? String(Math.round((n / maxAmount) * 100)) : "0");
  };

  const applyPct = (p) => {
    const n = parseFloat(
      ((Math.min(Math.max(Number(p) || 0, 0), 100) / 100) * maxAmount).toFixed(
        2,
      ),
    );
    setAmount(String(n));
    setPct(String(Math.min(Math.max(Number(p) || 0, 0), 100)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Number(amount) || 0, comment.trim() || null);
      onClose();
    } catch {
      /* handled by caller */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={popRef}
      className={styles.popover}
      style={{ "--accent": accentColor }}
    >
      <div className={styles.popoverTitle}>{title}</div>

      {rows.map((r) => (
        <div key={r.label} className={styles.popoverRow}>
          <span className={styles.popoverRowLabel}>{r.label}</span>
          <span className={styles.popoverRowValue} style={{ color: r.color }}>
            {r.value}
          </span>
        </div>
      ))}

      <div className={styles.quickBtns}>
        {QUICK_PCTS.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.quickBtn} ${Number(pct) === p ? styles.quickBtnActive : ""}`}
            onClick={() => applyPct(p)}
          >
            {p}%
          </button>
        ))}
      </div>

      <div className={styles.inputRow}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>{t("amountLabel")}</label>
          <input
            type="text"
            inputMode="numeric"
            className={styles.popoverInput}
            value={amount !== "" ? fmt(amount) : ""}
            placeholder="0"
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              if (raw === "") { setAmount(""); setPct(""); }
              else applyAmount(raw);
            }}
          />
        </div>
        <div className={styles.inputSep}>%</div>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>{t("percentLabel")}</label>
          <input
            type="number"
            className={`${styles.popoverInput} ${styles.pctInput}`}
            value={pct}
            min={0}
            max={100}
            placeholder="0"
            onChange={(e) => applyPct(e.target.value)}
          />
        </div>
      </div>

      {showComment && (
        <div className={styles.popoverField}>
          <input
            type="text"
            className={styles.popoverInput}
            value={comment}
            placeholder={t("debtCommentPlaceholder")}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      )}

      <div className={styles.popoverActions}>
        <button className={styles.cancelBtn} onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          className={styles.saveBtn}
          style={{ background: accentColor, borderColor: accentColor }}
          onClick={handleSave}
          disabled={saving || !amount || Number(amount) <= 0}
        >
          {saveLabel || t("save")}
        </button>
      </div>
    </div>
  );
}

// ── PaymentPopover ─────────────────────────────────────────────────────────────
// Dedicated popover for payments: date picker + history + new amount

function PaymentPopover({ item, onSave, onDelete, onClose }) {
  const { t } = useTranslation();
  const popRef = useRef();

  const salaryBal = Number(item.salary_balance || 0);
  const net = Number(item.net || 0);
  const totalDue = net + salaryBal;
  const advanceAmt = Number(item.advance_total || 0);
  const alreadyPaid = Number(item.paid_amount || 0);
  const remaining = Math.max(0, totalDue - advanceAmt - alreadyPaid);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const fn = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);

  useEffect(() => {
    setLogsLoading(true);
    payrollApi
      .getPaymentLogs(item.id)
      .then((res) => setLogs(res.success ? res.data : []))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }, [item.id]);

  const applyAmount = (val) => {
    const n = Math.min(Math.max(Number(val) || 0, 0), remaining);
    setAmount(String(n));
    setPct(remaining > 0 ? String(Math.round((n / remaining) * 100)) : "0");
  };

  const applyPct = (p) => {
    const n = parseFloat(
      ((Math.min(Math.max(Number(p) || 0, 0), 100) / 100) * remaining).toFixed(
        2,
      ),
    );
    setAmount(String(n));
    setPct(String(Math.min(Math.max(Number(p) || 0, 0), 100)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedItem = await onSave(item.id, {
        amount: Number(amount),
        payment_date: payDate,
        note: note.trim() || null,
      });
      // Refresh logs
      if (updatedItem) {
        const res = await payrollApi.getPaymentLogs(item.id);
        if (res.success) setLogs(res.data);
      }
      setAmount("");
      setPct("");
      setNote("");
    } catch {
      /* handled by caller */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (logId) => {
    setDeletingId(logId);
    try {
      await onDelete(item.id, logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch {
      /* handled by caller */
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      ref={popRef}
      className={styles.popover}
      style={{ "--accent": "#3b82f6", width: 320 }}
    >
      <div className={styles.popoverTitle}>{t("paymentTitle")}</div>

      {/* Summary */}
      {salaryBal > 0 && (
        <div className={styles.popoverRow}>
          <span className={styles.popoverRowLabel}>{t("salaryBalance")}</span>
          <span className={styles.popoverRowValue} style={{ color: "#f59e0b" }}>
            {fmt(salaryBal)}
          </span>
        </div>
      )}
      <div className={styles.popoverRow}>
        <span className={styles.popoverRowLabel}>{t("net")}</span>
        <span className={styles.popoverRowValue}>{fmt(net)}</span>
      </div>
      <div className={styles.popoverRow}>
        <span className={styles.popoverRowLabel}>{t("totalDue")}</span>
        <span className={styles.popoverRowValue} style={{ color: "#1d4ed8" }}>
          {fmt(totalDue)}
        </span>
      </div>
      {advanceAmt > 0 && (
        <div className={styles.popoverRow}>
          <span className={styles.popoverRowLabel}>{t("advancePrePaid")}</span>
          <span className={styles.popoverRowValue} style={{ color: "#7c3aed" }}>
            −{fmt(advanceAmt)}
          </span>
        </div>
      )}
      {alreadyPaid > 0 && (
        <div className={styles.popoverRow}>
          <span className={styles.popoverRowLabel}>{t("alreadyPaid")}</span>
          <span className={styles.popoverRowValue} style={{ color: "#16a34a" }}>
            {fmt(alreadyPaid)}
          </span>
        </div>
      )}
      {remaining > 0 && (
        <div className={styles.popoverRow}>
          <span className={styles.popoverRowLabel}>{t("remainingToPay")}</span>
          <span
            className={styles.popoverRowValue}
            style={{ color: "#3b82f6", fontWeight: 700 }}
          >
            {fmt(remaining)}
          </span>
        </div>
      )}

      {/* Payment history */}
      {(logsLoading || logs.length > 0) && (
        <div className={styles.paymentHistory}>
          <div className={styles.paymentHistoryTitle}>
            {t("paymentHistory")}
          </div>
          {logsLoading ? (
            <div className={styles.paymentHistoryLoading}>…</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={styles.paymentLogItem}>
                <span className={styles.paymentLogDate}>
                  {fmtDate(log.payment_date)}
                </span>
                <span className={styles.paymentLogAmount}>
                  {fmt(log.amount)}
                </span>
                {log.note && (
                  <span className={styles.paymentLogNote}>{log.note}</span>
                )}
                <button
                  className={styles.paymentLogDelete}
                  onClick={() => handleDelete(log.id)}
                  disabled={deletingId === log.id}
                  title={t("confirmDelete")}
                >
                  <IconTrash />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* New payment form */}
      {remaining > 0 && (
        <>
          <div className={styles.popoverSectionLabel}>{t("addPayment")}</div>

          <div className={styles.quickBtns}>
            {QUICK_PCTS.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.quickBtn} ${Number(pct) === p ? styles.quickBtnActive : ""}`}
                onClick={() => applyPct(p)}
              >
                {p}%
              </button>
            ))}
          </div>

          <div className={styles.inputRow}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>{t("amountLabel")}</label>
              <input
                type="text"
                inputMode="numeric"
                className={styles.popoverInput}
                value={amount !== "" ? fmt(amount) : ""}
                placeholder="0"
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  if (raw === "") { setAmount(""); setPct(""); }
                  else applyAmount(raw);
                }}
              />
            </div>
            <div className={styles.inputSep}>%</div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>{t("percentLabel")}</label>
              <input
                type="number"
                className={`${styles.popoverInput} ${styles.pctInput}`}
                value={pct}
                min={0}
                max={100}
                placeholder="0"
                onChange={(e) => applyPct(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.popoverField}>
            <label className={styles.inputLabel}>{t("paymentDate")}</label>
            <input
              type="date"
              className={styles.popoverInput}
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>

          <div className={styles.popoverField}>
            <input
              type="text"
              className={styles.popoverInput}
              value={note}
              placeholder={t("note")}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className={styles.popoverActions}>
            <button className={styles.cancelBtn} onClick={onClose}>
              {t("cancel")}
            </button>
            <button
              className={styles.saveBtn}
              style={{ background: "#3b82f6", borderColor: "#3b82f6" }}
              onClick={handleSave}
              disabled={saving || !amount || Number(amount) <= 0 || !payDate}
            >
              {t("payBtn")}
            </button>
          </div>
        </>
      )}

      {remaining <= 0 && (
        <div className={styles.popoverActions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── PayoutsTable ───────────────────────────────────────────────────────────────

const PayoutsTable = ({
  items = [],
  selectedIds = [],
  onToggleSelect,
  onToggleAll,
  onPayItem,
  onRevertItem,
  onItemUpdate,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const headerCheckRef = useRef(null);

  // activePopover: { type: "payment"|"debt", itemId, rect }
  const [activePopover, setActivePopover] = useState(null);

  const allSelected =
    items.length > 0 && items.every((it) => selectedIds.includes(it.id));
  const someSelected = items.some((it) => selectedIds.includes(it.id));

  useEffect(() => {
    if (headerCheckRef.current)
      headerCheckRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const getFullName = (emp) =>
    [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(" ");

  const openPopover = (e, itemId, type) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActivePopover((prev) =>
      prev?.itemId === itemId && prev?.type === type
        ? null
        : { type, itemId, rect },
    );
  };

  const getPopoverStyle = (rect) => {
    if (!rect) return {};
    return {
      position: "fixed",
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 400),
      zIndex: 1000,
    };
  };

  const handleSavePayment = useCallback(
    async (itemId, payload) => {
      const res = await payrollApi.addPaymentLog(itemId, payload);
      if (res.success) {
        onItemUpdate?.(res.data);
        showAlert(t("saved"), "success");
        return res.data;
      } else {
        showAlert(res.message || t("error"), "error");
        throw new Error(res.message);
      }
    },
    [onItemUpdate, showAlert, t],
  );

  const handleDeletePaymentLog = useCallback(
    async (itemId, logId) => {
      const res = await payrollApi.deletePaymentLog(itemId, logId);
      if (res.success) {
        onItemUpdate?.(res.data);
        showAlert(t("saved"), "success");
      } else {
        showAlert(res.message || t("error"), "error");
        throw new Error(res.message);
      }
    },
    [onItemUpdate, showAlert, t],
  );

  const handleSaveDebt = async (itemId, amount, comment) => {
    const res = await payrollApi.updateItem(itemId, {
      debt_deduction: amount,
      debt_mode: amount <= 0 ? "skip" : "partial",
      debt_comment: comment,
    });
    if (res.success) {
      onItemUpdate?.(res.data);
      showAlert(t("saved"), "success");
    } else {
      showAlert(res.message || t("error"), "error");
      throw new Error(res.message);
    }
  };

  const activeItem = items.find((it) => it.id === activePopover?.itemId);

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.checkCol}>
              <input
                ref={headerCheckRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
              />
            </th>
            <th className={styles.numCol}>#</th>
            <th style={{ textAlign: "left" }}>{t("employee")}</th>
            <th>{t("salaryBalance")}</th>
            <th>{t("accrued")}</th>
            <th>{t("debtBalance")}</th>
            <th>{t("advances")}</th>
            <th>{t("penalties")}</th>
            <th className={styles.netCol}>{t("net")}</th>
            <th>{t("paidAmount")}</th>
            <th>{t("status")}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={11} className={styles.noData}>
                {t("noData")}
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const emp = item.employee;
              const isPaid = item.payout_status === "paid";
              const isSelected = selectedIds.includes(item.id);

              const salaryBal = Number(item.salary_balance || 0);
              const debtBal = Number(item.debt_balance || 0);
              const debtDed = Number(item.debt_deduction || 0);
              const advanceAmt = Number(item.advance_total || 0);
              const paidAmt = Number(item.paid_amount || 0);
              const net = Number(item.net || 0);
              const totalDue = net + salaryBal;
              const remaining = Math.max(0, totalDue - advanceAmt - paidAmt);

              const isPayActive =
                activePopover?.itemId === item.id &&
                activePopover?.type === "payment";
              const isDebtActive =
                activePopover?.itemId === item.id &&
                activePopover?.type === "debt";

              return (
                <tr
                  key={item.id}
                  className={
                    isSelected
                      ? styles.rowSelected
                      : isPaid
                        ? styles.rowPaid
                        : ""
                  }
                >
                  <td className={styles.checkCol}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(item.id)}
                    />
                  </td>

                  <td className={styles.numColTd}>{idx + 1}</td>

                  {/* Сотрудник */}
                  <td>
                    <div className={styles.empCell}>
                      <span
                        className={styles.empName}
                      >{`${getFullName(emp)} (${emp.id})`}</span>
                      <span className={styles.empSub}>
                        {[emp.branch?.name, emp.department?.name]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </div>
                  </td>

                  {/* Остаток зарплаты */}
                  <td
                    className={`${styles.numCell} ${salaryBal > 0 ? styles.salaryBalVal : ""}`}
                  >
                    {salaryBal > 0 ? fmt(salaryBal) : "—"}
                  </td>

                  {/* Начислено */}
                  <td className={styles.numCell}>{fmt(item.accrued)}</td>

                  {/* Удержание долга */}
                  <td
                    className={`${styles.debtCell} ${debtBal > 0 ? styles.hasDebt : ""} ${isDebtActive ? styles.cellActive : ""}`}
                    onClick={
                      debtBal > 0
                        ? (e) => openPopover(e, item.id, "debt")
                        : undefined
                    }
                    title={debtBal > 0 ? t("clickToManageDebt") : undefined}
                  >
                    {debtBal > 0 ? (
                      <div className={styles.debtCellInner}>
                        <span className={styles.debtBal}>{fmt(debtBal)}</span>
                        {debtDed > 0 && (
                          <span className={styles.debtDed}>
                            −{fmt(debtDed)}
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* Авансы */}
                  <td className={`${styles.numCell} ${advanceAmt > 0 ? styles.advanceVal : ""}`}>
                    {advanceAmt > 0 ? fmt(advanceAmt) : "—"}
                  </td>

                  {/* Штрафы */}
                  <td className={styles.numCell}>—</td>

                  {/* К выплате */}
                  <td className={styles.netCell}>{fmt(net)}</td>

                  {/* Выплачено */}
                  <td
                    className={`${styles.numCell} ${paidAmt > 0 ? styles.paidAmtVal : ""}`}
                  >
                    {paidAmt > 0 ? fmt(paidAmt) : "—"}
                  </td>

                  {/* Статус + действие */}
                  <td className={styles.actionsCell}>
                    {isPaid ? (
                      <div className={styles.actionsCellInner}>
                        <span className={styles.paidBadge}>
                          <IconCheck /> {t("paid")}
                        </span>
                        <button
                          className={`${styles.payItemBtn} ${isPayActive ? styles.payItemBtnActive : ""}`}
                          onClick={(e) => openPopover(e, item.id, "payment")}
                          title={t("paymentHistory")}
                        >
                          {t("history")}
                        </button>
                        <button
                          className={styles.revertBtn}
                          onClick={() => onRevertItem(item.id)}
                          title={t("markUnpaid")}
                        >
                          <IconUndo />
                        </button>
                      </div>
                    ) : (
                      <button
                        className={`${styles.payItemBtn} ${isPayActive ? styles.payItemBtnActive : ""}`}
                        onClick={(e) => openPopover(e, item.id, "payment")}
                      >
                        {paidAmt > 0 ? (
                          <>
                            {t("remainingToPay")}: {fmt(remaining)}
                          </>
                        ) : (
                          <>
                            <IconCheck /> {t("markPaid")}
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* ── Popovers ─────────────────────────────────────────────────────────── */}
      {activePopover && activeItem && (
        <div style={getPopoverStyle(activePopover.rect)}>
          {activePopover.type === "payment" && (
            <PaymentPopover
              item={activeItem}
              onSave={handleSavePayment}
              onDelete={handleDeletePaymentLog}
              onClose={() => setActivePopover(null)}
            />
          )}

          {activePopover.type === "debt" &&
            (() => {
              const debtBal = Number(activeItem.debt_balance || 0);
              const debtDed = Number(activeItem.debt_deduction || 0);
              const maxDeduct = Math.min(
                debtBal,
                Number(activeItem.accrued || 0) + Number(activeItem.salary_balance || 0),
              );
              const rows = [
                {
                  label: t("debtBalance"),
                  value: fmt(debtBal),
                  color: "#f59e0b",
                },
                ...(debtDed > 0
                  ? [
                      {
                        label: t("currentDeduction"),
                        value: `−${fmt(debtDed)}`,
                        color: "#dc2626",
                      },
                    ]
                  : []),
              ];
              return (
                <AmountPickerPopover
                  title={t("debtDeductionTitle")}
                  rows={rows}
                  maxAmount={maxDeduct}
                  initialAmount={debtDed}
                  showComment
                  accentColor="#f59e0b"
                  saveLabel={t("applyDeduction")}
                  onClose={() => setActivePopover(null)}
                  onSave={(amount, comment) =>
                    handleSaveDebt(activeItem.id, amount, comment)
                  }
                />
              );
            })()}
        </div>
      )}
    </div>
  );
};

export default PayoutsTable;
