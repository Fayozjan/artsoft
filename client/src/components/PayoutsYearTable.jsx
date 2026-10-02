import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Icons } from "../icons/icons";
import EmployeeCell from "./EmployeeCell";
import PayMonthModal from "./PayMonthModal";
import SortArrow from "./SortArrow";
import styles from "./PayoutsYearTable.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// One row per employee for the selected year: current salary rate, last
// accrual, what is still owed and year totals. Clicking a row opens the
// month-by-month modal; the action cell pays the latest month directly.
const PayoutsYearTable = ({
  items = [],
  selectedIds = [],
  onToggleSelect,
  onToggleAll,
  onOpenEmployee,
  onChanged,
  onScroll,
}) => {
  const { t } = useTranslation();
  const headerCheckRef = useRef(null);

  // item_id of the month whose centred payment dialog is open
  const [payItemId, setPayItemId] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const pageItemIds = items.map((r) => r.current?.item_id).filter(Boolean);
  const allSelected =
    pageItemIds.length > 0 && pageItemIds.every((id) => selectedIds.includes(id));
  const someSelected = pageItemIds.some((id) => selectedIds.includes(id));

  useEffect(() => {
    if (headerCheckRef.current)
      headerCheckRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const monthLabel = (m) => (m ? t(`months.${m}`) : "—");

  const payRow = items.find((r) =>
    (r.months || []).some((m) => m.item_id === payItemId),
  );
  const payItem = (payRow?.months || []).find((m) => m.item_id === payItemId);
  const payEmployeeName = payRow
    ? [
        payRow.employee?.last_name,
        payRow.employee?.first_name,
        payRow.employee?.middle_name,
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const payEmployeeCode = payRow?.employee?.employee_number || payRow?.employee?.id;

  const empFullName = (row) =>
    [row.employee?.last_name, row.employee?.first_name, row.employee?.middle_name]
      .filter(Boolean)
      .join(" ");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortValue = (row, field) => {
    switch (field) {
      case "employee":
        return empFullName(row);
      case "currentSalary":
        return Number(row.current?.base_salary || 0);
      case "lastAccrual":
        return Number(row.last_accrual?.net || 0);
      case "yearAccrued":
        return Number(row.totals?.net || 0);
      case "yearPaid":
        return Number(row.totals?.paid_amount || 0);
      case "outstanding":
        return Number(row.outstanding || 0);
      default:
        return row[field];
    }
  };

  const sortedItems = sortField
    ? [...items].sort((a, b) => {
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
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
            <th style={{ textAlign: "left" }} onClick={() => handleSort("employee")}>
              <span className={styles.headerContent}>
                {t("employee")}
                <SortArrow active={sortField === "employee"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("currentSalary")}>
              <span className={styles.headerContent}>
                {t("currentSalary")}
                <SortArrow active={sortField === "currentSalary"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("lastAccrual")}>
              <span className={styles.headerContent}>
                {t("lastAccrual")}
                <SortArrow active={sortField === "lastAccrual"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("yearAccrued")}>
              <span className={styles.headerContent}>
                {t("yearAccrued")}
                <SortArrow active={sortField === "yearAccrued"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("yearPaid")}>
              <span className={styles.headerContent}>
                {t("yearPaid")}
                <SortArrow active={sortField === "yearPaid"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("outstanding")}>
              <span className={styles.headerContent}>
                {t("outstanding")}
                <SortArrow active={sortField === "outstanding"} order={sortOrder} />
              </span>
            </th>
            <th>{t("action")}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={9} className={styles.noData}>
                {t("noData")}
              </td>
            </tr>
          ) : (
            sortedItems.map((row, idx) => {
              const emp = row.employee;
              const outstanding = Number(row.outstanding || 0);
              const itemId = row.current?.item_id;
              const isSelected = itemId ? selectedIds.includes(itemId) : false;
              const lastMonth = row.months?.[row.months.length - 1];
              const isPayActive = payItemId === lastMonth?.item_id;

              return (
                <tr
                  key={emp.id}
                  className={`${styles.mainRow} ${isSelected ? styles.rowSelected : ""}`}
                  onClick={() => onOpenEmployee?.(row)}
                  title={t("monthlyBreakdown")}
                >
                  <td
                    className={styles.checkCol}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!itemId}
                      onChange={() => onToggleSelect?.(itemId)}
                    />
                  </td>

                  <td className={styles.numColTd}>{idx + 1}</td>

                  <td>
                    <EmployeeCell
                      photo={emp?.photo}
                      lastName={emp?.last_name}
                      firstName={emp?.first_name}
                      middleName={emp?.middle_name}
                      id={emp?.id}
                      branch={emp?.branch?.name}
                      department={emp?.department?.name}
                      active={emp?.status}
                    />
                  </td>

                  {/* Текущая зарплата — ставка сотрудника на последний месяц */}
                  <td className={styles.numCell}>
                    {fmt(row.current?.base_salary)}
                  </td>

                  {/* Последнее начисление — последний УТВЕРЖДЁННЫЙ месяц:
                      черновой в зарплату ещё не входит */}
                  <td className={styles.netCell}>
                    {fmt(row.last_accrual?.net)}
                    <span className={styles.cellSub}>
                      {monthLabel(row.last_accrual?.month)}
                    </span>
                  </td>

                  {/* Начислено за год */}
                  <td className={styles.numCell}>{fmt(row.totals?.net)}</td>

                  {/* Выплачено за год */}
                  <td
                    className={`${styles.numCell} ${row.totals?.paid_amount > 0 ? styles.paidAmtVal : ""}`}
                  >
                    {row.totals?.paid_amount > 0
                      ? fmt(row.totals.paid_amount)
                      : "—"}
                  </td>

                  {/* Остаток к выплате */}
                  <td
                    className={`${styles.numCell} ${outstanding > 0 ? styles.outstandingVal : ""}`}
                  >
                    {fmt(outstanding)}
                  </td>

                  {/* Оплата последнего месяца */}
                  <td
                    className={styles.actionsCell}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={styles.actionsCellInner}>
                      {lastMonth &&
                        (lastMonth.remaining > 0 ? (
                          <button
                            className={`${styles.payBtn} ${isPayActive ? styles.payBtnActive : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayItemId(lastMonth.item_id);
                            }}
                          >
                            {t("markPaid")}
                          </button>
                        ) : (
                          <span className={styles.paidBadge}>
                            {Icons.check} {t("paid")}
                          </span>
                        ))}                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <PayMonthModal
        isOpen={Boolean(payItem)}
        item={
          payItem && {
            id: payItem.item_id,
            net: payItem.net,
            paid_amount: payItem.paid_amount,
            remaining: payItem.remaining,
          }
        }
        employeeName={payEmployeeName}
        employeeCode={payEmployeeCode}
        months={payRow?.months || []}
        onChanged={() => onChanged?.()}
        onClose={() => setPayItemId(null)}
      />    </div>
  );
};

export default PayoutsYearTable;
