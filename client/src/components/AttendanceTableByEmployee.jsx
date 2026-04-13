import { useState } from "react";
import { useTranslation } from "react-i18next";

import SortArrow from "./SortArrow";
import DownloadButton from "./DownloadButton";

import styles from "./AttendanceTableByEmployee.module.scss";
import { formatLateMinutesToHours } from "../helpers/time";

export const columns = [
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
    render: (row) => row.departmentName || "-",
  },
  {
    key: "positionName",
    title: "Должность",
    sortable: true,
    render: (row) => row.positionName || "-",
  },
  {
    key: "status",
    title: "Статус",
    sortable: true,
    render: (row) => getStatus(row),
  },
  {
    key: "firstEntry",
    title: "Вход",
    sortable: true,
    render: (row) => {
      if (!row.firstEntry && row.lastExit) {
        return "Зафиксирован только выход";
      }

      return row.firstEntry || "-";
    },
  },
  {
    key: "lastExit",
    title: "Выход",
    sortable: true,
    render: (row) => row.lastExit || "-",
  },
  {
    key: "late",
    title: "Опоздал",
    sortable: true,
    render: (row) => (row.late ? "Да" : "Нет"),
  },
  {
    key: "lateMinutes",
    title: "Опоздание (чч:мм)",
    sortable: true,
    render: (row) => formatLateMinutesToHours(row?.lateMinutes) || "",
  },
];

const getStatus = (row) => {
  if (row.left) return "Ушел";
  if (row.inside) return "На месте";
  if (row.late) return "Опоздал";
  if (row.present) return "Пришел";
  if (row.absent) return "Отсутствует";
  return "-";
};

const AttendanceTableByEmployee = ({ data = [] }) => {
  const [sortField, setSortField] = useState("employeeFullName" || "name");
  const [sortOrder, setSortOrder] = useState("asc");
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Пустые значения идут в конец
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Преобразование к числу, если возможно
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      const isNumberA = !isNaN(aNum);
      const isNumberB = !isNaN(bNum);

      if (isNumberA && isNumberB) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Сравнение как строки
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className={styles.wrapper}>
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
        {Object.keys(data).length > 0 && (
          <DownloadButton text={t("save")} onClick={() => {}} />
        )}
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
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
            {data.length ? (
              getSortedData().map((row, i) => (
                <tr key={row.id ?? i}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row, i) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceTableByEmployee;
