import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import SortArrow from "./SortArrow";
import DownloadButton from "./DownloadButton";

import styles from "./AttendanceTableByStatus.module.scss";
import { formatLateMinutesToHours } from "../helpers/time";

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
    title: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "name",
    title: "Филиал",
    sortable: true,
  },
  {
    key: "activeEmployeesCount",
    title: "Количество сотрудников",
    sortable: true,
  },
];

export const departmentsColumns = [
  {
    key: "index",
    title: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "branchName",
    title: "Филиал",
    sortable: true,
  },
  {
    key: "name",
    title: "Отдел",
    sortable: true,
  },
  {
    key: "activeEmployeesCount",
    title: "Количество сотрудников",
    sortable: true,
  },
];

export const employeesColumns = [
  {
    key: "index",
    title: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "employeeFullName",
    title: "Сотрудник",
    sortable: true,
    render: (row) => (
      <div className={styles.employee}>
        {row.employeeFullName}
        {row.photo && <img src={row.photo} alt="employee" />}
      </div>
    ),
  },
  {
    key: "employeeNumber",
    title: "Таб. №",
    sortable: true,
  },
  {
    key: "branchName",
    title: "Филиал",
    sortable: true,
  },
  {
    key: "departmentName",
    title: "Отдел",
    sortable: true,
  },
  {
    key: "positionName",
    title: "Должность",
    sortable: true,
  },
];

export const presentColumns = [
  {
    key: "index",
    title: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "employeeFullName",
    title: "Сотрудник",
    sortable: true,
    render: (row) => (
      <div className={styles.employee}>
        {row.employeeFullName}
        {row.employeePhoto && <img src={row.employeePhoto} alt="employee" />}
      </div>
    ),
  },
  {
    key: "employeeNumber",
    title: "Таб. №",
    sortable: true,
  },
  {
    key: "branchName",
    title: "Филиал",
    sortable: true,
  },
  {
    key: "departmentName",
    title: "Отдел",
    sortable: true,
  },
  {
    key: "positionName",
    title: "Должность",
    sortable: true,
  },
  {
    key: "firstEntry",
    title: "Вход",
    sortable: true,
    render: (row) => {
      return row.firstEntry || "Зафиксирован только выход";
    },
  },
];

export const lateColumns = [
  {
    key: "index",
    title: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "employeeFullName",
    title: "Сотрудник",
    sortable: true,
    render: (row) => (
      <div className={styles.employee}>
        {row.employeeFullName}
        {row.employeePhoto && <img src={row.employeePhoto} alt="employee" />}
      </div>
    ),
  },
  {
    key: "employeeNumber",
    title: "Таб. №",
    sortable: true,
  },
  {
    key: "branchName",
    title: "Филиал",
    sortable: true,
  },
  {
    key: "departmentName",
    title: "Отдел",
    sortable: true,
  },
  {
    key: "positionName",
    title: "Должность",
    sortable: true,
  },
  {
    key: "scheduledStart",
    title: "По графику",
    sortable: true,
  },
  {
    key: "actualStart",
    title: "Вход",
    sortable: true,
  },
  {
    key: "lateMinutes",
    title: "Опоздание (чч:мм)",
    sortable: true,
    render: (row) => formatLateMinutesToHours(row.lateMinutes),
  },
];

export const leftColumns = [
  {
    key: "index",
    title: "№",
    render: (_, i) => i + 1,
  },
  {
    key: "employeeFullName",
    title: "Сотрудник",
    sortable: true,
    render: (row) => (
      <div className={styles.employee}>
        {row.employeeFullName}
        {row.employeePhoto && <img src={row.employeePhoto} alt="employee" />}
      </div>
    ),
  },
  {
    key: "employeeNumber",
    title: "Таб. №",
    sortable: true,
  },
  {
    key: "branchName",
    title: "Филиал",
    sortable: true,
  },
  {
    key: "departmentName",
    title: "Отдел",
    sortable: true,
  },
  {
    key: "positionName",
    title: "Должность",
    sortable: true,
  },
  {
    key: "lastExit",
    title: "Выход",
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

const AttendanceTableByStatus = ({
  data = [],
  modalType = "",
  modalTitle = "",
  emptyText = "Нет данных",
}) => {
  const [sortField, setSortField] = useState("employeeFullName" || "name");
  const [sortOrder, setSortOrder] = useState("asc");
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    if (!search.trim()) return data[modalType];

    const lower = search.toLowerCase();

    return data[modalType].filter((row) =>
      searchFields.some((field) =>
        String(row[field] ?? "")
          .toLowerCase()
          .includes(lower)
      )
    );
  }, [search, data[modalType], searchFields]);

  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Сортируем поля времени HH:mm
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

      // Сортируем опоздание (кол-во минут)
      if (sortField === "lateMinutes") {
        // если у тебя camelCase
        aVal = aVal ?? -1;
        bVal = bVal ?? -1;
      }

      // Для строк
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Для null/undefined
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Для чисел
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
                    {col.title}
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
            {sortedData.length ? (
              sortedData.map((row, i) => (
                <tr key={row.id ?? i}>
                  {columns[modalType].map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row, i) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns[modalType].length}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceTableByStatus;
