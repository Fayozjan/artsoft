import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";
import { Icons } from "../icons/icons";
import EmployeeCell from "./EmployeeCell";
import SortArrow from "./SortArrow";
import styles from "./PayrollTable.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

const SALARY_TYPE_LABELS = {
  monthly: "salaryTypeMonthly",
  hourly: "salaryTypeHourly",
  piecework: "salaryTypePiecework",
};


// ── AdjustmentModal ────────────────────────────────────────────────────────────

// Центрированная модалка ручной корректировки.
// Знак задаётся режимом, в поле всегда модуль суммы.
function AdjustmentModal({ item, onClose, onSave }) {
  const { t } = useTranslation();
  const [portalContainer, setPortalContainer] = useState(null);

  const initialAdj = Number(item.manual_adjustment) || 0;
  const canDeduct = Math.max(0, Number(item.accrued) || 0) > 0;
  const [mode, setMode] = useState(
    initialAdj < 0 && canDeduct ? "deduction" : "bonus",
  );
  const [amount, setAmount] = useState(
    initialAdj !== 0 ? String(Math.abs(initialAdj)) : "",
  );
  const [comment, setComment] = useState(item.adjustment_comment || "");
  const [commentError, setCommentError] = useState(false);
  const [amountError, setAmountError] = useState("");
  const [saving, setSaving] = useState(false);

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
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const maxDeduction = Math.max(0, Number(item.accrued) || 0);

  const absAmount = Math.abs(Number(amount) || 0);
  const signedAmount = mode === "deduction" ? -absAmount : absAmount;
  // net линейно зависит от manual_adjustment — подменяем старое значение
  const previewNet = (Number(item.net) || 0) - initialAdj + signedAmount;

  const emp = item.employee || {};
  const fullName = [emp.last_name, emp.first_name, emp.middle_name]
    .filter(Boolean)
    .join(" ");

  const handleSave = async () => {
    if (!Number.isFinite(absAmount)) {
      setAmountError(t("adjustmentInvalid"));
      return;
    }
    // Вычет не может увести начисление в минус
    if (mode === "deduction" && absAmount > maxDeduction) {
      setAmountError(t("adjustmentExceedsAccrued"));
      return;
    }
    if (signedAmount !== 0 && !comment.trim()) {
      setCommentError(true);
      return;
    }
    setSaving(true);
    try {
      await onSave(item.id, {
        manual_adjustment: signedAmount,
        adjustment_comment: signedAmount !== 0 ? comment.trim() : null,
      });
      onClose();
    } catch {
      /* handled */
    } finally {
      setSaving(false);
    }
  };

  // Enter в любом поле — сохранить корректировку
  const handleKeyDown = (e) => {
    if (e.key !== "Enter" || e.nativeEvent?.isComposing) return;
    e.preventDefault();
    if (!saving) handleSave();
  };

  if (!portalContainer) return null;

  return createPortal(
    <AnimatePresence>
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
          <div className={styles.modalHeader}>
            <div className={styles.modalHeaderMain}>
              <span className={styles.modalName}>{fullName}</span>
              <span className={styles.modalSubtitle}>
                {t("manualAdjustment")}
              </span>
            </div>
            <button
              type="button"
              className={styles.modalClose}
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.summary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>{t("accrued")}</span>
                <span className={styles.summaryValue}>{fmt(item.accrued)}</span>
              </div>
              <span className={styles.summaryArrow}>→</span>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>{t("net")}</span>
                <span
                  className={`${styles.summaryValue} ${
                    signedAmount > 0
                      ? styles.summaryValueBonus
                      : signedAmount < 0
                        ? styles.summaryValuePenalty
                        : ""
                  }`}
                >
                  {fmt(previewNet)}
                </span>
              </div>
            </div>

            <div className={styles.modeSwitch}>
              <button
                type="button"
                className={
                  mode === "bonus" ? styles.modeBtnBonusActive : styles.modeBtn
                }
                onClick={() => {
                  setMode("bonus");
                  setAmountError("");
                }}
              >
                + {t("adjustmentTypeBonus")}
              </button>
              <button
                type="button"
                disabled={!canDeduct}
                title={!canDeduct ? t("adjustmentNoAccrued") : undefined}
                className={
                  !canDeduct
                    ? styles.modeBtnDisabled
                    : mode === "deduction"
                      ? styles.modeBtnDeductionActive
                      : styles.modeBtn
                }
                onClick={() => {
                  setMode("deduction");
                  setAmountError("");
                }}
              >
                − {t("adjustmentTypeDeduction")}
              </button>
            </div>

            {!canDeduct && (
              <div className={styles.modeNote}>{t("adjustmentNoAccrued")}</div>
            )}

            <div className={styles.popoverField}>
              <label className={styles.fieldLabel}>{t("amount")}</label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                className={`${styles.popoverInput} ${amountError ? styles.inputError : ""}`}
                value={(() => {
                  if (amount === "") return amount;
                  const n = Number(amount);
                  if (isNaN(n)) return amount;
                  return fmt(Math.abs(n));
                })()}
                placeholder="0"
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                  let v = e.target.value
                    .replace(/[\u00A0\s]/g, "")
                    .replace(/[^\d]/g, "");
                  setAmount(v);
                  setCommentError(false);
                  setAmountError("");
                }}
              />
              {amountError && (
                <div className={styles.fieldError}>{amountError}</div>
              )}
              {!amountError && mode === "deduction" && (
                <div className={styles.fieldHint}>
                  {t("maxDeduct")}: {fmt(maxDeduction)}
                </div>
              )}
            </div>

            <div className={styles.popoverField}>
              <label className={styles.fieldLabel}>
                {t("commentRequired")} *
              </label>
              <input
                type="text"
                className={`${styles.popoverInput} ${commentError ? styles.inputError : ""}`}
                value={comment}
                placeholder={t("adjCommentPlaceholder")}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                  setComment(e.target.value);
                  setCommentError(false);
                }}
              />
            </div>
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
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    portalContainer,
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
  onScroll,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const [activePopover, setActivePopover] = useState(null);
  const headerCheckRef = useRef(null);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

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
    setActivePopover((prev) => (prev?.itemId === itemId ? null : { itemId }));
  };

  // Сервер отдаёт ключ локали в message; axios режектит на 4xx — читаем из response
  const errText = (res, err) => {
    const key = err?.response?.data?.message || res?.message;
    return key ? t(key) : t("error");
  };

  const handleSave = async (itemId, payload) => {
    let res;
    try {
      res = await payrollApi.updateItem(itemId, payload);
    } catch (err) {
      showAlert(errText(null, err), "error");
      throw err;
    }
    if (res.success) {
      onItemUpdate(res.data);
      showAlert(t("saved"), "success");
    } else {
      showAlert(errText(res), "error");
      throw new Error(res.message);
    }
  };

  const handleToggleApply = async (itemId, field, currentValue) => {
    let res;
    try {
      res = await payrollApi.updateItem(itemId, { [field]: !currentValue });
    } catch (err) {
      showAlert(errText(null, err), "error");
      return;
    }
    if (res.success) {
      onItemUpdate(res.data);
    } else {
      showAlert(errText(res), "error");
    }
  };

  const getFullName = (emp) =>
    [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(" ");

  const activeItem = items.find((it) => it.id === activePopover?.itemId);

  const fmtTime = (mins) => {
    if (!mins) return "00:00";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortValue = (item, field) => {
    switch (field) {
      case "employee":
        return getFullName(item.employee);
      case "workSchedule":
        return item.employee.workSchedule?.name || "";
      case "salary_type":
        return t(SALARY_TYPE_LABELS[item.salary_type] || "notSet");
      default:
        return item[field];
    }
  };

  const sortedItems = sortField
    ? [...items].sort((a, b) => {
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
        }

        return sortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : items;

  return (
    <div className={styles.tableContainer} onScroll={onScroll}>
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
            <th
              className={styles.empCol}
              style={{ textAlign: "left" }}
              onClick={() => handleSort("employee")}
            >
              <span className={styles.headerContent}>
                {t("employee")}
                <SortArrow active={sortField === "employee"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("salary_type")}>
              <span className={styles.headerContent}>
                {t("salaryType")}
                <SortArrow active={sortField === "salary_type"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("base_salary")}>
              <span className={styles.headerContent}>
                {t("baseSalary")}
                <SortArrow active={sortField === "base_salary"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("workSchedule")}>
              <span className={styles.headerContent}>
                {t("scheduleCol")}
                <SortArrow active={sortField === "workSchedule"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("total_work_days")}>
              <span className={styles.headerContent}>
                {t("scheduleNormCol")}
                <SortArrow active={sortField === "total_work_days"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("worked_days")}>
              <span className={styles.headerContent}>
                {t("workedCol")}
                <SortArrow active={sortField === "worked_days"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("accrued")}>
              <span className={styles.headerContent}>
                {t("accrued")}
                <SortArrow active={sortField === "accrued"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("late_amount")}>
              <span className={styles.headerContent}>
                {t("lateCol")}
                <SortArrow active={sortField === "late_amount"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("overtime_amount")}>
              <span className={styles.headerContent}>
                {t("overtimeCol")}
                <SortArrow active={sortField === "overtime_amount"} order={sortOrder} />
              </span>
            </th>
            <th className={styles.adjCol} onClick={() => handleSort("manual_adjustment")}>
              <span className={styles.headerContent}>
                {t("adjustment")}
                <SortArrow active={sortField === "manual_adjustment"} order={sortOrder} />
              </span>
            </th>
            <th className={styles.netCol} onClick={() => handleSort("net")}>
              <span className={styles.headerContent}>
                {t("net")}
                <SortArrow active={sortField === "net"} order={sortOrder} />
              </span>
            </th>
            <th>{t("status")}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={14} className={styles.noData}>
                {t("noData")}
              </td>
            </tr>
          ) : (
            sortedItems.map((item, idx) => {
              const emp = item.employee;
              const adjustment = Number(item.manual_adjustment);
              const hasAdj = adjustment !== 0;
              const isSelected = selectedIds.includes(item.id);
              const itemApproved     = item.status === "approved";
              const itemPaid         = item.payout_status === "paid";
              const itemPartiallyPaid = item.payout_status === "partially_paid";

              const netVal = Number(item.net) || 0;

              const lateMin = item.late_minutes || 0;
              const otMin = item.overtime_minutes || 0;
              const lateAmt = Number(item.late_amount || 0);
              const otAmt = Number(item.overtime_amount || 0);

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

                  <td className={styles.empCol}>
                    <EmployeeCell
                      compact
                      photo={emp.photo}
                      lastName={emp.last_name}
                      firstName={emp.first_name}
                      middleName={emp.middle_name}
                      id={emp.id}
                      branch={emp.branch?.name}
                      department={emp.department?.name}
                      active={emp.status}
                    />
                  </td>

                  <td>
                    <span
                      className={`${styles.typeBadge} ${styles[item.salary_type || "notSet"] || styles.notSet}`}
                    >
                      {t(SALARY_TYPE_LABELS[item.salary_type] || "notSet")}
                    </span>
                  </td>

                  <td className={styles.numCell}>{fmt(item.base_salary)}</td>

                  <td>
                    {emp.workSchedule ? (
                      <div className={styles.scheduleCell}>
                        <span className={styles.scheduleName}>
                          {emp.workSchedule.name}
                        </span>
                        {emp.workSchedule.type && (
                          <span className={styles.scheduleType}>
                            {t(`scheduleType.${emp.workSchedule.type}`)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className={styles.zeroVal}>—</span>
                    )}
                  </td>

                  <td className={`${styles.numCell} ${styles.planCell}`}>
                    <div className={styles.planStack}>
                      <span>
                        {item.total_work_days ?? "—"} {t("daysAbbr")}
                      </span>
                      <span className={styles.planHours}>
                        {item.total_work_hours || "—"}
                      </span>
                    </div>
                  </td>

                  <td className={styles.numCell}>
                    <div className={styles.planStack}>
                      <span
                        className={item.worked_days === 0 ? styles.zeroVal : ""}
                      >
                        {item.worked_days} {t("daysAbbr")}
                      </span>
                      <span className={styles.planHours}>
                        {item.worked_hours || "—"}
                      </span>
                    </div>
                  </td>

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
                    className={`${styles.clickableCell} ${styles.adjCol} ${
                      hasAdj
                        ? adjustment > 0
                          ? styles.hasBonus
                          : styles.hasPenalty
                        : ""
                    } ${activePopover?.itemId === item.id ? styles.cellActive : ""}`}
                    onClick={(e) => handleCellClick(e, item.id)}
                    title={t("clickToAdjust")}
                  >
                    {hasAdj ? (
                      <span
                        className={`${styles.adjBadge} ${
                          adjustment > 0
                            ? styles.adjBadgeBonus
                            : styles.adjBadgePenalty
                        }`}
                      >
                        {adjustment > 0
                          ? `+${fmt(adjustment)}`
                          : fmt(adjustment)}
                        <span className={styles.adjEditIcon}>{Icons.edit}</span>
                      </span>
                    ) : (
                      <span className={styles.adjAddBtn}>
                        <span className={styles.adjPlus}>+</span>
                        {t("adjustAdd")}
                      </span>
                    )}
                  </td>

                  <td className={styles.netCell}>
                    <span
                      className={`${styles.netValue} ${
                        netVal < 0
                          ? styles.netValueNegative
                          : netVal === 0
                            ? styles.netValueZero
                            : ""
                      }`}
                    >
                      {fmt(item.net)}
                    </span>
                  </td>

                  {/* Status + per-row actions */}
                  <td className={styles.actionsCell}>
                    {!itemApproved ? (
                      <button
                        className={styles.approveItemBtn}
                        onClick={() => onApproveItem(item.id)}
                        title={t("approveItem")}
                      >
                        {Icons.check} {t("approveItem")}
                      </button>
                    ) : (
                      <div className={styles.actionsCellInner}>
                        {itemPaid ? (
                          <span className={styles.paidBadge}>{t("statusPaid")}</span>
                        ) : itemPartiallyPaid ? (
                          <span className={styles.partiallyPaidBadge}>{t("statusPartiallyPaid")}</span>
                        ) : (
                          <span className={styles.approvedBadge}>
                            {Icons.check} {t("approved")}
                          </span>
                        )}
                        <button
                          className={styles.revertBtn}
                          onClick={() => onUnapproveItem(item.id)}
                          title={t("unapproveItem")}
                        >
                          {Icons.undo}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Модалка ручной корректировки */}
      {activePopover && activeItem && (
        <AdjustmentModal
          item={activeItem}
          onClose={() => setActivePopover(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default PayrollTable;
