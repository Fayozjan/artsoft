import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { t as i18t } from "i18next";

import SortArrow from "./SortArrow";
import DownloadButton from "./DownloadButton";

import styles from "./AttendanceTableByStatus.module.scss";
import { formatLateMinutesToHours } from "../helpers/time";

const PAGE_SIZE = 50;

const searchFields = [
  "employeeFullName",
  "employeeNumber",
  "branchName",
  "name",
  "departmentName",
  "positionName",
];

export const branchesColumns = [
  {
    key: "index",
    titleKey: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "name",
    titleKey: "branch",
    sortable: true,
  },
  {
    key: "activeEmployeesCount",
    titleKey: "employeeCount2",
    sortable: true,
  },
];

export const departmentsColumns = [
  {
    key: "index",
    titleKey: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "branchName",
    titleKey: "branch",
    sortable: true,
  },
  {
    key: "name",
    titleKey: "department",
    sortable: true,
  },
  {
    key: "activeEmployeesCount",
    titleKey: "employeeCount2",
    sortable: true,
  },
];

export const employeesColumns = [
  {
    key: "index",
    titleKey: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "employeeFullName",
    titleKey: "employee",
    sortable: true,
    render: (row) => (
      <div className={styles.employee}>
        {row.employeeFullName}
        {row.employeePhoto && (
          <img
            src={`/api/employees/image/${row.employeePhoto}`}
            alt="employee"
          />
        )}
      </div>
    ),
  },
  {
    key: "employeeNumber",
    titleKey: "tabNumber",
    sortable: true,
  },
  {
    key: "branchName",
    titleKey: "branch",
    sortable: true,
  },
  {
    key: "departmentName",
    titleKey: "department",
    sortable: true,
  },
  {
    key: "positionName",
    titleKey: "position",
    sortable: true,
  },
];

export const presentColumns = [
  {
    key: "index",
    titleKey: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "employeeFullName",
    titleKey: "employee",
    sortable: true,
    render: (row) => (
      <div className={styles.employee}>
        {row.employeeFullName}
        {row.employeePhoto && (
          <img
            src={`/api/employees/image/${row.employeePhoto}`}
            alt="employee"
          />
        )}
      </div>
    ),
  },
  {
    key: "employeeNumber",
    titleKey: "tabNumber",
    sortable: true,
  },
  {
    key: "branchName",
    titleKey: "branch",
    sortable: true,
  },
  {
    key: "departmentName",
    titleKey: "department",
    sortable: true,
  },
  {
    key: "positionName",
    titleKey: "position",
    sortable: true,
  },
  {
    key: "firstEntry",
    titleKey: "entryTime",
    sortable: true,
    render: (row) => {
      return row.firstEntry || i18t("onlyExitRecorded");
    },
  },
];

export const lateColumns = [
  {
    key: "index",
    titleKey: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "employeeFullName",
    titleKey: "employee",
    sortable: true,
    render: (row) => (
      <div className={styles.employee}>
        {row.employeeFullName}
        <img src={`/api/employees/image/${row.employeePhoto}`} alt="employee" />
      </div>
    ),
  },
  {
    key: "employeeNumber",
    titleKey: "tabNumber",
    sortable: true,
  },
  {
    key: "branchName",
    titleKey: "branch",
    sortable: true,
  },
  {
    key: "departmentName",
    titleKey: "department",
    sortable: true,
  },
  {
    key: "positionName",
    titleKey: "position",
    sortable: true,
  },
  {
    key: "scheduledStart",
    titleKey: "scheduledTime",
    sortable: true,
  },
  {
    key: "actualStart",
    titleKey: "entryTime",
    sortable: true,
  },
  {
    key: "lateMinutes",
    titleKey: "lateTimeHhMm",
    sortable: true,
    render: (row) => formatLateMinutesToHours(row.lateMinutes),
  },
];

export const leftColumns = [
  {
    key: "index",
    titleKey: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "employeeFullName",
    titleKey: "employee",
    sortable: true,
    render: (row) => (
      <div className={styles.employee}>
        {row.employeeFullName}
        {row.employeePhoto && (
          <img
            src={`/api/employees/image/${row.employeePhoto}`}
            alt="employee"
          />
        )}
      </div>
    ),
  },
  {
    key: "employeeNumber",
    titleKey: "tabNumber",
    sortable: true,
  },
  {
    key: "branchName",
    titleKey: "branch",
    sortable: true,
  },
  {
    key: "departmentName",
    titleKey: "department",
    sortable: true,
  },
  {
    key: "positionName",
    titleKey: "position",
    sortable: true,
  },
  {
    key: "lastExit",
    titleKey: "exit",
    sortable: true,
  },
];

const columns = {
  branches: branchesColumns,
  departments: departmentsColumns,
  employees: employeesColumns,
  present: presentColumns,
  absent: employeesColumns,
  late: lateColumns,
  inside: employeesColumns,
  left: leftColumns,
};

const defaultSorts = {
  branches: { field: "name", order: "asc" },
  departments: { field: "branchName", order: "asc" },
  employees: { field: "employeeFullName", order: "asc" },
  present: { field: "employeeFullName", order: "asc" },
  absent: { field: "employeeFullName", order: "asc" },
  late: { field: "employeeFullName", order: "asc" },
  inside: { field: "employeeFullName", order: "asc" },
  left: { field: "employeeFullName", order: "asc" },
};

const AttendanceTableByStatus = ({
  data = [],
  modalType = "",
  modalTitle = "",
}) => {
  const [sortField, setSortField] = useState(
    () => defaultSorts[modalType]?.field ?? "employeeFullName",
  );
  const [sortOrder, setSortOrder] = useState(
    () => defaultSorts[modalType]?.order ?? "asc",
  );
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef(null);

  const filteredData = useMemo(() => {
    if (!search.trim()) return data[modalType];

    const lower = search.toLowerCase();

    return data[modalType].filter((row) =>
      searchFields.some((field) =>
        String(row[field] ?? "")
          .toLowerCase()
          .includes(lower),
      ),
    );
  }, [search, data[modalType], searchFields]);

  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      const timeFields = [
        "actualStart",
        "actualEnd",
        "scheduledStart",
        "firstEntry",
      ];
      if (timeFields.includes(sortField)) {
        const toMinutes = (timeStr) => {
          if (!timeStr) return -1;
          const [h, m] = timeStr.split(":").map(Number);
          return h * 60 + m;
        };
        aVal = toMinutes(aVal);
        bVal = toMinutes(bVal);
      }

      if (sortField === "lateMinutes") {
        aVal = aVal ?? -1;
        bVal = bVal ?? -1;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filteredData, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const visibleData = useMemo(
    () => sortedData.slice(0, visibleCount),
    [sortedData, visibleCount],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + PAGE_SIZE, sortedData.length),
          );
        }
      },
      { threshold: 0.1 },
    );

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [sortedData.length]);

  return (
    <div className={styles.wrapper}>
      <h4>{modalTitle}</h4>
      <div className={styles.header}>
        <div className={styles.searchInput}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="19"
            viewBox="0 0 24 24"
          >
            <path
              fill="#000000"
              d="M15.096 5.904a6.5 6.5 0 1 0-9.192 9.192a6.5 6.5 0 0 0 9.192-9.192ZM4.49 4.49a8.5 8.5 0 0 1 12.686 11.272l5.345 5.345l-1.414 1.414l-5.345-5.345A8.501 8.501 0 0 1 4.49 4.49Z"
            />
          </svg>
          <input
            type="text"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <svg
              className={styles.clearBtn}
              onClick={() => setSearch("")}
              xmlns="http://www.w3.org/2000/svg"
              width="19"
              height="18"
              viewBox="0 0 24 24"
            >
              <path
                fill="none"
                stroke="#000000"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>
        {Object.keys(data[modalType]).length > 0 && (
          <DownloadButton text={t("save")} onClick={() => {}} />
        )}
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns[modalType].map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className={styles.headerCell}>
                    {col.titleKey === "№" ? "№" : t(col.titleKey)}
                    {col.sortable && (
                      <SortArrow
                        active={sortField === col.key}
                        order={sortOrder}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.length ? (
              <>
                {visibleData.map((row, i) => (
                  <tr key={row.id ?? i}>
                    {columns[modalType].map((col) => (
                      <td key={col.key}>
                        {col.render ? col.render(row, i) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
                {visibleCount < sortedData.length && (
                  <tr ref={loaderRef}>
                    <td
                      colSpan={columns[modalType].length}
                      style={{ textAlign: "center", padding: "12px" }}
                    >
                      {t("loading")}
                    </td>
                  </tr>
                )}
              </>
            ) : (
              <tr>
                <td colSpan={columns[modalType].length}>{t("noData")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceTableByStatus;
