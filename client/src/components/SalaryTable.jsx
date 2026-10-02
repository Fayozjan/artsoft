import { useTranslation } from "react-i18next";

import { useState } from "react";
import Badge from "./Badge";
import EmployeeCell from "./EmployeeCell";
import SortArrow from "./SortArrow";
import styles from "./SalaryTable.module.scss";

const SALARY_TYPE_COLORS = {
  monthly: { bg: "#eff6ff", color: "#1d4ed8", label: "salaryTypeMonthly" },
  hourly: { bg: "#f0fdf4", color: "#15803d", label: "salaryTypeHourly" },
  piecework: { bg: "#fef3c7", color: "#b45309", label: "salaryTypePiecework" },
};

const SalaryBadge = ({ type }) => {
  const { t } = useTranslation();
  const cfg = SALARY_TYPE_COLORS[type];
  if (!cfg) return <span>—</span>;
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        padding: "2px 8px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {t(cfg.label)}
    </span>
  );
};

const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("ru-RU");
};

const SalaryTable = ({
  data = [],
  currentPage = 1,
  pageSize = 50,
  onOpenHistory,
  onOpenAdd,
  onScroll,
}) => {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortValue = (item, field) => {
    const salary = item.employeeSalaryHistory?.[0];
    switch (field) {
      case "employee":
        return [item.last_name, item.first_name, item.middle_name]
          .filter(Boolean)
          .join(" ");
      case "position":
        return item.position?.name || "";
      case "salaryType":
        return salary?.salary_type || "";
      case "amount":
        return Number(salary?.amount || 0);
      case "salaryPeriod":
        return salary?.date_from || "";
      default:
        return item[field];
    }
  };

  const sortedData = sortField
    ? [...data].sort((a, b) => {
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        }

        return sortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : data;

  const handleRowClick = (item) => {
    const salary = item.employeeSalaryHistory?.[0];
    if (salary) {
      onOpenHistory(item.id);
    } else {
      onOpenAdd(item.id);
    }
  };

  return (
    <div className={styles.tableContainer} onScroll={onScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <span className={styles.headerContent}>№</span>
            </th>
            <th onClick={() => handleSort("employee")}>
              <span className={styles.headerContent}>
                {t("employee")}
                <SortArrow active={sortField === "employee"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("employee_number")}>
              <span className={styles.headerContent}>
                {t("employeeNumber")}
                <SortArrow active={sortField === "employee_number"} order={sortOrder} />
              </span>
            </th>

            <th onClick={() => handleSort("position")}>
              <span className={styles.headerContent}>
                {t("position")}
                <SortArrow active={sortField === "position"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("salaryType")}>
              <span className={styles.headerContent}>
                {t("salaryType")}
                <SortArrow active={sortField === "salaryType"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("amount")}>
              <span className={styles.headerContent}>
                {t("amount")}
                <SortArrow active={sortField === "amount"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("salaryPeriod")}>
              <span className={styles.headerContent}>
                {t("salaryPeriod")}
                <SortArrow active={sortField === "salaryPeriod"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("status")}>
              <span className={styles.headerContent}>
                {t("status")}
                <SortArrow active={sortField === "status"} order={sortOrder} />
              </span>
            </th>
            <th>
              <span className={styles.headerContent}>{t("action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            sortedData.map((item, i) => {
              const salary = item.employeeSalaryHistory?.[0];
              return (
                <tr
                  key={item.id}
                  className={styles.clickableRow}
                  onClick={() => handleRowClick(item)}
                >
                  <td>{(currentPage - 1) * pageSize + i + 1}</td>
                  <td>
                    <EmployeeCell
                      photo={item.photo}
                      lastName={item.last_name}
                      firstName={item.first_name}
                      middleName={item.middle_name}
                      id={item.id}
                      branch={item.branch?.name}
                      department={item.department?.name}
                      active={item.status}
                    />
                  </td>
                  <td>{item.employee_number || "—"}</td>
                  <td>{item.position?.name || "—"}</td>
                  <td>
                    {salary ? (
                      <SalaryBadge type={salary.salary_type} />
                    ) : (
                      <span className={styles.noSalary}>{t("notSet")}</span>
                    )}
                  </td>
                  <td>
                    {salary ? (
                      <span className={styles.amount}>
                        {Number(salary.amount).toLocaleString()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {salary ? (
                      <span className={styles.period}>
                        {formatDate(salary.date_from)}
                        {" → "}
                        {salary.date_to
                          ? formatDate(salary.date_to)
                          : t("toPresent")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <Badge text={item.status ? "active" : "terminated"} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className={styles.actions}>
                      {salary ? (
                        <button
                          className={styles.historyBtn}
                          onClick={() => onOpenHistory(item.id)}
                          title={t("salaryHistory")}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                              fill="currentColor"
                            />
                          </svg>
                          {t("edit")}
                        </button>
                      ) : (
                        <button
                          className={styles.addBtn}
                          onClick={() => onOpenAdd(item.id)}
                          title={t("addSalaryRecord")}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M12 5v14M5 12h14"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                          {t("add")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={11} className={styles.noData}>
                {t("text")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SalaryTable;
