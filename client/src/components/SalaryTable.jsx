import { useTranslation } from "react-i18next";

import Badge from "./Badge";
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
}) => {
  const { t } = useTranslation();

  const handleRowClick = (item) => {
    const salary = item.employeeSalaryHistory?.[0];
    if (salary) {
      onOpenHistory(item.id);
    } else {
      onOpenAdd(item.id);
    }
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th><span className={styles.headerContent}>№</span></th>
            <th><span className={styles.headerContent}>{t("employee")}</span></th>
            <th><span className={styles.headerContent}>{t("employeeNumber")}</span></th>
            <th><span className={styles.headerContent}>{t("branch")}</span></th>
            <th><span className={styles.headerContent}>{t("department")}</span></th>
            <th><span className={styles.headerContent}>{t("position")}</span></th>
            <th><span className={styles.headerContent}>{t("salaryType")}</span></th>
            <th><span className={styles.headerContent}>{t("amount")}</span></th>
            <th><span className={styles.headerContent}>{t("salaryPeriod")}</span></th>
            <th><span className={styles.headerContent}>{t("status")}</span></th>
            <th><span className={styles.headerContent}>{t("action")}</span></th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item, i) => {
              const salary = item.employeeSalaryHistory?.[0];
              return (
                <tr
                  key={item.id}
                  className={styles.clickableRow}
                  onClick={() => handleRowClick(item)}
                >
                  <td>{(currentPage - 1) * pageSize + i + 1}</td>
                  <td>
                    <div className={styles.employeeCell}>
                      {item.photo && (
                        <img
                          src={`/api/employees/image/${item.photo}`}
                          alt=""
                          className={item.status ? styles.active : styles.terminated}
                        />
                      )}
                      <span>
                        {[item.last_name, item.first_name, item.middle_name]
                          .filter(Boolean)
                          .join(" ")}{" "}
                        {`(${item.id})`}
                      </span>
                    </div>
                  </td>
                  <td>{item.employee_number || "—"}</td>
                  <td>{item.branch?.name || "—"}</td>
                  <td>{item.department?.name || "—"}</td>
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
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
