import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getAge, formatDate } from "../utils/utils";

import SortArrow from "../components/SortArrow";
import Badge from "../components/Badge";
import TableIcons from "../icons/tableIcons";

import styles from "./EmployeesTable.module.scss";

const EmployeesTable = ({
  data,
  currentPage,
  pageSize,
  canEdit,
  canDelete,
  handleEditClick,
  handleDeleteClick,
}) => {
  const [sortField, setSortField] = useState("last_name");
  const [sortOrder, setSortOrder] = useState("asc");
  const { t } = useTranslation();

  const sortedData = useMemo(() => {
    if (!data) return [];

    return [...data].sort((a, b) => {
      const getValue = (obj, field) => {
        if (field === "branch_name") return obj.branch?.name;
        if (field === "department_name") return obj.department?.name;
        if (field === "position_name") return obj.position?.name;
        return obj[field];
      };

      let aVal = getValue(a, sortField);
      let bVal = getValue(b, sortField);

      // --- ИСПРАВЛЕННЫЙ БЛОК NULL ---
      if (aVal === bVal) return 0; // Если оба null или одинаковые
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      // ------------------------------

      // --- Сравнение дат ---
      if (sortField === "date_of_birth" || sortField === "added_at") {
        const dateA = new Date(aVal);
        const dateB = new Date(bVal);
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }

      const isNum = (v) =>
        typeof v !== "boolean" &&
        v !== "" &&
        !isNaN(v) &&
        !isNaN(parseFloat(v));

      if (isNum(aVal) && isNum(bVal)) {
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Строковая сортировка
      const comparison = String(aVal).localeCompare(String(bVal), undefined, {
        sensitivity: "accent",
        numeric: true,
      });

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [data, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <span className={styles.headerContent}>№</span>
            </th>
            <th
              className={styles.table_name_header}
              onClick={() => handleSort("last_name")}
            >
              <span className={styles.headerContent}>
                {t("employee")}
                <SortArrow
                  active={sortField === "last_name"}
                  order={sortOrder}
                />
              </span>
            </th>
            <th onClick={() => handleSort("date_of_birth")}>
              <span className={styles.headerContent}>
                {t("dateOfBirth")}
                <SortArrow
                  active={sortField === "date_of_birth"}
                  order={sortOrder}
                />
              </span>
            </th>
            <th onClick={() => handleSort("employee_number")}>
              <span className={styles.headerContent}>
                {t("employeeNumber")}
                <SortArrow
                  active={sortField === "employee_number"}
                  order={sortOrder}
                />
              </span>
            </th>
            <th onClick={() => handleSort("branch_name")}>
              <span className={styles.headerContent}>
                {t("branch")}
                <SortArrow
                  active={sortField === "branch_name"}
                  order={sortOrder}
                />
              </span>
            </th>
            <th onClick={() => handleSort("department_name")}>
              <span className={styles.headerContent}>
                {t("department")}
                <SortArrow
                  active={sortField === "department_name"}
                  order={sortOrder}
                />
              </span>
            </th>
            <th onClick={() => handleSort("position_name")}>
              <span className={styles.headerContent}>
                {t("position")}
                <SortArrow
                  active={sortField === "position_name"}
                  order={sortOrder}
                />
              </span>
            </th>
            <th onClick={() => handleSort("pinfl")}>
              <span className={styles.headerContent}>
                {t("pinfl")}
                <SortArrow active={sortField === "pinfl"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("passport")}>
              <span className={styles.headerContent}>
                {t("passport")}
                <SortArrow
                  active={sortField === "passport"}
                  order={sortOrder}
                />
              </span>
            </th>
            <th onClick={() => handleSort("status")}>
              <span className={styles.headerContent}>
                {t("status")}
                <SortArrow active={sortField === "status"} order={sortOrder} />
              </span>
            </th>
            <th>{(canEdit || canDelete) && t("action")}</th>
          </tr>
        </thead>
        <tbody>
          {data?.length > 0 ? (
            sortedData.map((item, i) => (
              <tr key={item.id}>
                <td>{(currentPage - 1) * pageSize + i + 1}</td>
                <td>
                  <div className={styles.employee}>
                    {[
                      item.last_name,
                      item.first_name,
                      item.middle_name,
                      item.id,
                    ]
                      .filter(Boolean)
                      .join(" ")}

                    {item.photo && (
                      <img
                        src={`${item.photo}?t=${new Date()}`}
                        alt="employeePhoto"
                        className={
                          item.status ? styles.active : styles.terminated
                        }
                      />
                    )}
                  </div>
                </td>
                <td>
                  {item.date_of_birth &&
                    `${formatDate(item.date_of_birth)} (${getAge(
                      item.date_of_birth,
                    )})`}
                </td>
                <td>{item.employee_number}</td>
                <td>{item.branch?.name}</td>
                <td>{item.department?.name}</td>
                <td>{item.position?.name}</td>
                <td>{item.pinfl}</td>
                <td>{item.passport}</td>
                <td>
                  <Badge text={item.status ? "active" : "terminated"} />
                </td>
                {(canEdit || canDelete) && (
                  <td className={styles.actions}>
                    {canEdit && (
                      <TableIcons.edit
                        onClick={() => handleEditClick(item.id)}
                      />
                    )}
                    {canDelete && (
                      <TableIcons.delete
                        onClick={() => handleDeleteClick(item.id)}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="11">Нет данных</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EmployeesTable;
