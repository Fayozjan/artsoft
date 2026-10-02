import { useState } from "react";
import { useTranslation } from "react-i18next";
import { t as i18t } from "i18next";

import SortArrow from "./SortArrow";
import DownloadButton from "./DownloadButton";

import styles from "./AttendanceTableByEmployee.module.scss";
import { formatLateMinutesToHours } from "../helpers/time";
import { Icons } from "../icons/icons";

export const columns = [
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
    render: (row) => row.departmentName || "-",
  },
  {
    key: "positionName",
    titleKey: "position",
    sortable: true,
    render: (row) => row.positionName || "-",
  },
  {
    key: "status",
    titleKey: "status",
    sortable: true,
    render: (row) => getStatus(row),
  },
  {
    key: "firstEntry",
    titleKey: "checkedInSingular",
    sortable: true,
    render: (row) => row.firstEntry || "",
  },
  {
    key: "lateMinutes",
    titleKey: "lateTimeHhMm",
    sortable: true,
    render: (row) => formatLateMinutesToHours(row?.lateMinutes) || "",
  },
  {
    key: "lastExit",
    titleKey: "checkedOutSingular",
    sortable: true,
    render: (row) => row.lastExit || "",
  },
];

const getStatus = (row) => {
  if (row.left) return i18t("checkedOut");
  if (row.inside) return i18t("onSite");
  if (row.late) return i18t("lateGroup");
  if (row.present) return i18t("arrived");
  if (row.absent) return i18t("notCheckedIn");
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

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      const isNumberA = !isNaN(aNum);
      const isNumberB = !isNaN(bNum);

      if (isNumberA && isNumberB) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

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
          {Icons.search}
          <input
            type="text"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <span className={styles.clearBtn} onClick={() => setSearch("")} style={{ display: "flex", cursor: "pointer" }}>{Icons.clear}</span>
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
                <td colSpan={columns.length}>{t("noData")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceTableByEmployee;
