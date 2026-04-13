import { useState } from "react";
import styles from "./MonthlyLateReport.module.scss";

function formatLateMinutesToHours(minutes) {
  if (!minutes && minutes !== 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const columns = [
  { label: "№", render: (_, __, i) => i + 1 },
  {
    label: "ФИО",
    accessor: "employeeFullName",
    render: (_, item) => (
      <div className={styles.employee}>
        <span>{item.employeeFullName}</span>
        {item.employeePhoto && (
          <img src={`/api/employees/image/${item.employeePhoto}`} alt="photo" />
        )}
      </div>
    ),
  },
  { label: "Филиал", accessor: "branchName" },
  { label: "Отдел", accessor: "departmentName" },
  { label: "Должность", accessor: "positionName" },
  { label: "Кол-во опозданий за месяц", accessor: "monthlyLateCount" },
  {
    label: "Суммарное время опоздания",
    accessor: "monthlyLateMinutes",
    render: (_, item) => formatLateMinutesToHours(item.monthlyLateMinutes),
  },
  { label: "Сумма за опоздания", accessor: "monthlyLateMoney" },
  {
    label: "Действие",
    render: (_, item, __, onMore) => (
      <button className={styles.btnMore} onClick={() => onMore && onMore(item)}>
        Подробно
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

const EmployeesTable = ({ data = [], onMore }) => {
  const [sortConfig, setSortConfig] = useState({
    key: "employeeFullName",
    direction: "asc",
  });

  const handleSort = (accessor) => {
    setSortConfig((prev) => ({
      key: accessor,
      direction:
        prev.key === accessor && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedData = [...data].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (!key) return 0;
    const aVal = a[key],
      bVal = b[key];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === "number" && typeof bVal === "number")
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    return direction === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                onClick={() => col.accessor && handleSort(col.accessor)}
                style={{ cursor: col.accessor ? "pointer" : "default" }}
              >
                <span className={styles.headerContent}>
                  {col.label}
                  {sortConfig.key === col.accessor &&
                    (sortConfig.direction === "asc" ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width={20}
                        height={20}
                      >
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="m17 14l-5-5m0 0l-5 5"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width={20}
                        height={20}
                      >
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="m7 10l5 5m0 0l5-5"
                        />
                      </svg>
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center" }}>
                Нет данных
              </td>
            </tr>
          ) : (
            sortedData.map((item, i) => (
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

const EmployeeCard = ({ emp }) => (
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
        <span className={styles.timeLabel}>По графику</span>
        <span className={styles.timeValue}>{emp.scheduledStart}</span>
      </div>
      <div className={styles.timeArrow}>→</div>
      <div className={styles.timeBlock}>
        <span className={styles.timeLabel}>Пришёл</span>
        <span className={`${styles.timeValue} ${styles.timeActual}`}>
          {emp.actualStart}
        </span>
      </div>
    </div>

    <div className={styles.lateBadge}>
      +{formatLateMinutesToHours(emp.lateMinutes)}
      {emp.havePermission && (
        <span className={styles.permissionTag}>Разрешение</span>
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
        Фото
      </a>
    )}
  </div>
);

const BranchesView = ({ data = [] }) => {
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
            <th className={styles.gridBranchTh}>Филиал</th>
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
            <th className={styles.gridTotalTh}>Итого</th>
          </tr>
        </thead>

        <tbody>
          {sortedData.map((branch) => {
            const totalLate = branch.days.reduce((s, d) => s + d.lateCount, 0);

            // Find the active date for this branch (if any)
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
                          title={`${day.lateCount} опоздание(й) — нажмите чтобы раскрыть`}
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
