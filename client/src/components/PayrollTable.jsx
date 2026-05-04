import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";
import styles from "./PayrollTable.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

const SALARY_TYPE_LABELS = {
  monthly: "salaryTypeMonthly",
  hourly: "salaryTypeHourly",
  piecework: "salaryTypePiecework",
};

// ── Icons ──────────────────────────────────────────────────────────────────────

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

// ── AdjustmentPopover ──────────────────────────────────────────────────────────

function AdjustmentPopover({ item, onClose, onSave }) {
  const { t } = useTranslation();
  const popRef = useRef();
  const [amount, setAmount] = useState(
    String(Number(item.manual_adjustment) || 0),
  );
  const [comment, setComment] = useState(item.adjustment_comment || "");
  const [commentError, setCommentError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleSave = async () => {
    const numAmount = Number(amount);
    if (numAmount !== 0 && !comment.trim()) {
      setCommentError(true);
      return;
    }
    setSaving(true);
    try {
      await onSave(item.id, {
        manual_adjustment: numAmount,
        adjustment_comment: numAmount !== 0 ? comment.trim() : null,
      });
      onClose();
    } catch {
      /* handled */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={popRef} className={styles.popover}>
      <div className={styles.popoverTitle}>{t("manualAdjustment")}</div>
      <div className={styles.popoverField}>
        <label className={styles.fieldLabel}>{t("adjustmentHint")}</label>
        <input
          type="text"
          inputMode="numeric"
          className={styles.popoverInput}
          value={(() => {
            if (amount === "" || amount === "-") return amount;
            const n = Number(amount);
            if (isNaN(n)) return amount;
            const abs = fmt(Math.abs(n));
            return n < 0 ? `-${abs}` : abs;
          })()}
          placeholder="0"
          onChange={(e) => {
            let v = e.target.value
              .replace(/[\u00A0\s]/g, "")
              .replace(/[^\d\-]/g, "");
            if (v.length > 1)
              v =
                v[0] === "-"
                  ? "-" + v.slice(1).replace(/-/g, "")
                  : v.replace(/-/g, "");
            setAmount(v);
            setCommentError(false);
          }}
        />
      </div>
      <div className={styles.popoverField}>
        <label className={styles.fieldLabel}>{t("commentRequired")} *</label>
        <input
          type="text"
          className={`${styles.popoverInput} ${commentError ? styles.inputError : ""}`}
          value={comment}
          placeholder={t("adjCommentPlaceholder")}
          onChange={(e) => {
            setComment(e.target.value);
            setCommentError(false);
          }}
        />
      </div>
      <div className={styles.popoverActions}>
        <button className={styles.cancelBtn} onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}

// ── PayrollTable ───────────────────────────────────────────────────────────────

const PayrollTable = ({
  items = [],
  onItemUpdate,
  selectedIds = [],
  onToggleSelect,
  onToggleAll,
  onApproveItem,
  onUnapproveItem,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const [activePopover, setActivePopover] = useState(null);
  const headerCheckRef = useRef(null);

  const allSelected =
    items.length > 0 && items.every((it) => selectedIds.includes(it.id));
  const someSelected = items.some((it) => selectedIds.includes(it.id));

  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const handleCellClick = (e, itemId) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActivePopover((prev) =>
      prev?.itemId === itemId ? null : { itemId, rect },
    );
  };

  const handleSave = async (itemId, payload) => {
    const res = await payrollApi.updateItem(itemId, payload);
    if (res.success) {
      onItemUpdate(res.data);
      showAlert(t("saved"), "success");
    } else {
      showAlert(res.message || t("error"), "error");
      throw new Error(res.message);
    }
  };

  const handleToggleApply = async (itemId, field, currentValue) => {
    const res = await payrollApi.updateItem(itemId, { [field]: !currentValue });
    if (res.success) {
      onItemUpdate(res.data);
    } else {
      showAlert(res.message || t("error"), "error");
    }
  };

  const getFullName = (emp) =>
    [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(" ");

  const getPopoverStyle = (rect) => {
    if (!rect) return {};
    return {
      position: "fixed",
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 330),
      zIndex: 1000,
    };
  };

  const activeItem = items.find((it) => it.id === activePopover?.itemId);

  const fmtTime = (mins) => {
    if (!mins) return "00:00";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

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
            <th>{t("salaryType")}</th>
            <th>{t("baseSalary")}</th>
            <th>{t("days")}</th>
            <th>{t("hours")}</th>
            <th>{t("accrued")}</th>
            <th>{t("lateCol")}</th>
            <th>{t("overtimeCol")}</th>
            <th>{t("adjustment")}</th>
            <th className={styles.netCol}>{t("net")}</th>
            <th>{t("status")}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={13} className={styles.noData}>
                {t("noData")}
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const emp = item.employee;
              const adjustment = Number(item.manual_adjustment);
              const hasAdj = adjustment !== 0;
              const isSelected = selectedIds.includes(item.id);
              const itemApproved     = item.status === "approved";
              const itemPaid         = item.payout_status === "paid";
              const itemPartiallyPaid = item.payout_status === "partially_paid";

              const lateMin = item.late_minutes || 0;
              const otMin = item.overtime_minutes || 0;
              const lateAmt = Number(item.late_amount || 0);
              const otAmt = Number(item.overtime_amount || 0);

              const hoursDisplay = item.total_work_hours
                ? `${item.worked_hours || "00:00"} / ${item.total_work_hours}`
                : item.worked_hours || "—";

              return (
                <tr
                  key={item.id}
                  className={isSelected ? styles.rowSelected : ""}
                >
                  <td className={styles.checkCol}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(item.id)}
                    />
                  </td>

                  <td className={styles.numColTd}>{idx + 1}</td>

                  <td>
                    <div className={styles.empCell}>
                      <span className={styles.empName}>
                        {`${getFullName(emp)} (${emp.id})`}
                      </span>
                      <span className={styles.empSub}>
                        {[emp.branch?.name, emp.department?.name]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span
                      className={`${styles.typeBadge} ${styles[item.salary_type || "notSet"] || styles.notSet}`}
                    >
                      {t(SALARY_TYPE_LABELS[item.salary_type] || "notSet")}
                    </span>
                  </td>

                  <td className={styles.numCell}>{fmt(item.base_salary)}</td>

                  <td className={styles.numCell}>
                    <span
                      className={item.worked_days === 0 ? styles.zeroVal : ""}
                    >
                      {item.worked_days} / {item.total_work_days}
                    </span>
                  </td>

                  <td className={styles.numCell}>{hoursDisplay}</td>

                  <td className={styles.numCell}>{fmt(item.accrued)}</td>

                  {/* Late column */}
                  <td
                    className={`${styles.flagCell} ${item.apply_late ? styles.lateActive : ""}`}
                  >
                    <div className={styles.flagContainer}>
                      <div className={styles.flagInfo}>
                        <span className={styles.flagTime}>
                          {fmtTime(lateMin)}
                        </span>
                        {lateAmt > 0 && (
                          <span className={styles.flagAmt}>
                            −{fmt(lateAmt)}
                          </span>
                        )}
                      </div>
                      <label
                        className={styles.flagCheck}
                        title={t("applyLate")}
                      >
                        <input
                          type="checkbox"
                          checked={!!item.apply_late}
                          onChange={() =>
                            handleToggleApply(
                              item.id,
                              "apply_late",
                              item.apply_late,
                            )
                          }
                        />
                      </label>
                    </div>
                  </td>

                  {/* Overtime column */}
                  <td
                    className={`${styles.flagCell} ${item.apply_overtime ? styles.otActive : ""}`}
                  >
                    <div className={styles.flagContainer}>
                      <div className={styles.flagInfo}>
                        <span className={styles.flagTime}>
                          {fmtTime(otMin)}
                        </span>
                        {otAmt > 0 && (
                          <span className={styles.flagAmt}>+{fmt(otAmt)}</span>
                        )}
                      </div>
                      <label
                        className={styles.flagCheck}
                        title={t("applyOvertime")}
                      >
                        <input
                          type="checkbox"
                          checked={!!item.apply_overtime}
                          onChange={() =>
                            handleToggleApply(
                              item.id,
                              "apply_overtime",
                              item.apply_overtime,
                            )
                          }
                        />
                      </label>
                    </div>
                  </td>

                  {/* Adjustment cell */}
                  <td
                    className={`${styles.clickableCell} ${
                      hasAdj
                        ? adjustment > 0
                          ? styles.hasBonus
                          : styles.hasPenalty
                        : ""
                    } ${activePopover?.itemId === item.id ? styles.cellActive : ""}`}
                    onClick={(e) => handleCellClick(e, item.id)}
                    title={t("clickToAdjust")}
                  >
                    {hasAdj
                      ? adjustment > 0
                        ? `+${fmt(adjustment)}`
                        : fmt(adjustment)
                      : "—"}
                  </td>

                  <td className={styles.netCell}>{fmt(item.net)}</td>

                  {/* Status + per-row actions */}
                  <td className={styles.actionsCell}>
                    {!itemApproved ? (
                      <button
                        className={styles.approveItemBtn}
                        onClick={() => onApproveItem(item.id)}
                        title={t("approveItem")}
                      >
                        <IconCheck /> {t("approveItem")}
                      </button>
                    ) : (
                      <>
                        {itemPaid ? (
                          <span className={styles.paidBadge}>{t("statusPaid")}</span>
                        ) : itemPartiallyPaid ? (
                          <span className={styles.partiallyPaidBadge}>{t("statusPartiallyPaid")}</span>
                        ) : (
                          <span className={styles.approvedBadge}>
                            <IconCheck /> {t("approved")}
                          </span>
                        )}
                        <button
                          className={styles.revertBtn}
                          onClick={() => onUnapproveItem(item.id)}
                          title={t("unapproveItem")}
                        >
                          <IconUndo />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Popover */}
      {activePopover && activeItem && (
        <div style={getPopoverStyle(activePopover.rect)}>
          <AdjustmentPopover
            item={activeItem}
            onClose={() => setActivePopover(null)}
            onSave={handleSave}
          />
        </div>
      )}
    </div>
  );
};

export default PayrollTable;
