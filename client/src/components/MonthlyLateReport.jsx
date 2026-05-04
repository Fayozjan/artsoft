import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./MonthlyLateReport.module.scss";

function formatLateMinutesToHours(minutes) {
  if (!minutes && minutes !== 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const EmployeesTable = ({ data = [], onMore }) => {
  const { t } = useTranslation();

  const columns = [
    { label: "№", render: (_, __, i) => i + 1 },
    {
      label: t("fullName"),
      accessor: "employeeFullName",
      render: (_, item) => (
        <div className={styles.empCell}>
          {item.employeePhoto && (
            <img src={`/api/employees/image/${item.employeePhoto}`} alt="photo" />
          )}
          <div className={styles.empInfo}>
            <span className={styles.empName}>{item.employeeFullName}</span>
            <span className={styles.empSub}>
              {[item.branchName, item.departmentName].filter(Boolean).join(" / ")}
            </span>
          </div>
        </div>
      ),
    },
    { label: t("position"), accessor: "positionName" },
    {
      label: t("lateCount"),
      accessor: "monthlyArrivalLateCount",
      render: (_, item) => {
        const count = item.monthlyArrivalLateCount || 0;
        if (!count) return "—";
        return count;
      },
    },
    {
      label: t("lateTime"),
      accessor: "monthlyArrivalLateCount",
      render: (_, item) => {
        const count = item.monthlyArrivalLateCount || 0;
        const mins = item.monthlyLateMinutes || 0;
        if (!count) return "—";
        return mins > 0 && formatLateMinutesToHours(mins);
      },
    },
    {
      label: t("lateCountAfterBreak"),
      accessor: "monthlyLunchLateCount",
      render: (_, item) => {
        const count = item.monthlyLunchLateCount || 0;
        if (!count) return "—";
        return count;
      },
    },
    {
      label: t("lateTimeAfterBreak"),
      accessor: "monthlyLunchLateCount",
      render: (_, item) => {
        const count = item.monthlyLunchLateCount || 0;
        const mins = item.monthlyBreakReturnLateMinutes || 0;
        if (!count) return "—";
        return mins > 0 && formatLateMinutesToHours(mins);
      },
    },
    {
      label: t("totalLateAmount"),
      accessor: "monthlyLateMoney",
      render: (v) =>
        v
          ? String(Math.round(Number(v))).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
          : "—",
    },
    {
      label: t("action"),
      render: (_, item, __, onMore) => (
        <button className={styles.btnMore} onClick={() => onMore && onMore(item)}>
          {t("details")}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="m10 17l5-5m0 0l-5-5"
            />
          </svg>
        </button>
      ),
    },
  ];

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>
                <span className={styles.headerContent}>{col.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center" }}>
                {t("noData")}
              </td>
            </tr>
          ) : (
            data.map((item, i) => (
              <tr key={item.identifier || i} className="fade-in">
                {columns.map((col, j) => (
                  <td key={j}>
                    {col.render
                      ? col.render(item[col.accessor], item, i, onMore)
                      : item[col.accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const EmployeeCard = ({ emp }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.employeeCard}>
      <div className={styles.empLeft}>
        {emp.employeePhoto ? (
          <img
            src={`/api/employees/image/${emp.employeePhoto}`}
            alt={emp.employeeFullName}
            className={styles.empPhoto}
          />
        ) : (
          <div className={styles.empPhotoPlaceholder}>
            {emp.employeeFullName?.[0] ?? "?"}
          </div>
        )}
        <div className={styles.empInfo}>
          <span className={styles.empName}>{emp.employeeFullName}</span>
          <span className={styles.empMeta}>
            {emp.departmentName} · {emp.positionName}
          </span>
        </div>
      </div>

      <div className={styles.empTimes}>
        <div className={styles.timeBlock}>
          <span className={styles.timeLabel}>{t("scheduledStart")}</span>
          <span className={styles.timeValue}>{emp.scheduledStart}</span>
        </div>
        <div className={styles.timeArrow}>→</div>
        <div className={styles.timeBlock}>
          <span className={styles.timeLabel}>{t("arrived")}</span>
          <span className={`${styles.timeValue} ${styles.timeActual}`}>
            {emp.actualStart}
          </span>
        </div>
      </div>

      <div className={styles.lateBadge}>
        +{formatLateMinutesToHours(emp.lateMinutes)}
        {emp.havePermission && (
          <span className={styles.permissionTag}>{t("latePermission")}</span>
        )}
      </div>

      {emp.actualStartPhoto && (
        <a
          href={`/api/face-passes/image/${emp.actualStartPhoto}`}
          target="_blank"
          rel="noreferrer"
          className={styles.photoLink}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 8h.01M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm0 6l4-4a3 5 0 0 1 3 0l4 4"
            />
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="m14 14l1-1a3 5 0 0 1 3 0l3 3"
            />
          </svg>
          {t("uploadPhoto")}
        </a>
      )}
    </div>
  );
};

const BranchesView = ({ data = [] }) => {
  const { t } = useTranslation();
  const [activeCell, setActiveCell] = useState(null);

  const sortedData = [...data].sort((a, b) =>
    a.branchName.localeCompare(b.branchName),
  );

  const allDates = (() => {
    const firstDate = data.flatMap((b) => b.days.map((d) => d.date)).sort()[0];
    if (!firstDate) return [];
    const [year, month] = firstDate.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      return `${year}-${mm}-${day}`;
    });
  })();

  const toggleCell = (branchName, date) => {
    const key = `${branchName}__${date}`;
    setActiveCell((prev) => (prev === key ? null : key));
  };

  const lookup = {};
  data.forEach((branch) => {
    lookup[branch.branchName] = {};
    branch.days.forEach((day) => {
      lookup[branch.branchName][day.date] = day;
    });
  });

  return (
    <div className={styles.gridWrapper}>
      <table className={styles.gridTable}>
        <thead>
          <tr>
            <th className={styles.gridBranchTh}>{t("branch")}</th>
            {allDates.map((date) => {
              const [y, mo, da] = date.split("-").map(Number);
              const d = new Date(y, mo - 1, da);
              return (
                <th key={date} className={styles.gridDayTh}>
                  <span className={styles.gridDayNum}>
                    {d.toLocaleDateString("ru-RU", { day: "2-digit" })}
                  </span>
                  <span className={styles.gridDayName}>
                    {d.toLocaleDateString("ru-RU", { weekday: "short" })}
                  </span>
                </th>
              );
            })}
            <th className={styles.gridTotalTh}>{t("total")}</th>
          </tr>
        </thead>

        <tbody>
          {sortedData.map((branch) => {
            const totalLate = branch.days.reduce((s, d) => s + d.lateCount, 0);

            const activeDateForBranch = activeCell?.startsWith(
              `${branch.branchName}__`,
            )
              ? activeCell.split("__")[1]
              : null;
            const activeDay = activeDateForBranch
              ? lookup[branch.branchName]?.[activeDateForBranch]
              : null;

            return (
              <>
                <tr key={branch.branchName} className={styles.gridRow}>
                  <td className={styles.gridBranchCell}>{branch.branchName}</td>

                  {allDates.map((date) => {
                    const day = lookup[branch.branchName]?.[date];
                    const key = `${branch.branchName}__${date}`;
                    const isActive = activeCell === key;

                    if (!day) {
                      return (
                        <td key={date} className={styles.gridEmptyCell}>
                          <span className={styles.gridZero}>0</span>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={date}
                        className={`${styles.gridCell} ${isActive ? styles.gridCellActive : ""}`}
                      >
                        <button
                          className={`${styles.gridCellBtn} ${isActive ? styles.gridCellBtnActive : ""}`}
                          onClick={() => toggleCell(branch.branchName, date)}
                        >
                          <span className={styles.gridCount}>
                            {day.lateCount}
                          </span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            className={`${styles.gridChevron} ${isActive ? styles.gridChevronOpen : ""}`}
                          >
                            <path
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="m6 9l6 6l6-6"
                            />
                          </svg>
                        </button>
                      </td>
                    );
                  })}

                  <td className={styles.gridTotalCell}>
                    <span className={styles.gridTotalBadge}>{totalLate}</span>
                  </td>
                </tr>

                {activeDay && (
                  <tr
                    key={`${branch.branchName}__expand`}
                    className={styles.gridExpandRow}
                  >
                    <td
                      colSpan={allDates.length + 2}
                      className={styles.gridExpandCell}
                    >
                      <div className={styles.gridExpandHeader}>
                        <span>
                          {(() => {
                            const [y, mo, da] = activeDateForBranch
                              .split("-")
                              .map(Number);
                            return new Date(y, mo - 1, da).toLocaleDateString(
                              "ru-RU",
                              {
                                day: "2-digit",
                                month: "long",
                                weekday: "long",
                              },
                            );
                          })()}
                          {" · "}
                          {branch.branchName}
                        </span>
                        <button
                          className={styles.gridExpandClose}
                          onClick={() => setActiveCell(null)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M18 6L6 18M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className={styles.employeeList}>
                        {activeDay.employees.map((emp) => (
                          <EmployeeCard key={emp.employeeId} emp={emp} />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const MonthlyLateReport = ({ data, viewType, onMore }) => {
  if (viewType === "branches") {
    return <BranchesView data={data?.lateByBranchAndDay} />;
  }

  return <EmployeesTable data={data?.lateEmployeesByMonth} onMore={onMore} />;
};

export default MonthlyLateReport;
