import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatDate, getBirthdayInfo, getExpiryBadge } from "../utils/utils";

import Badge from "../components/Badge";
import { ActionCell } from "./ActionButtons";
import EmployeeCell from "./EmployeeCell";
import SortArrow from "./SortArrow";

import styles from "./EmployeesTable.module.scss";

const EmployeesTable = ({
  data,
  currentPage,
  pageSize,
  canEdit,
  canDelete,
  handleEditClick,
  handleDeleteClick,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onRowClick,
  onScroll,
}) => {
  const { t } = useTranslation();
  const headerCheckRef = useRef(null);
  const selectable = !!selectedIds;
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  // Клик по строке открывает карточку сотрудника, но не перехватывает
  // чекбокс, кнопки действий и превью фото.
  // В режиме выделения строка вместо карточки переключает выбор.
  const handleRowClick = (e, id) => {
    if (e.target.closest("button, input, a, img")) return;
    if (selectable) {
      onToggleSelect(id);
      return;
    }
    if (!onRowClick) return;
    onRowClick(id);
  };

  const allSelected =
    selectable && data?.length > 0 && data.every((it) => selectedIds.includes(it.id));
  const someSelected =
    selectable && data?.some((it) => selectedIds.includes(it.id));

  useEffect(() => {
    if (headerCheckRef.current)
      headerCheckRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const fullName = (item) =>
    [item.last_name, item.first_name, item.middle_name].filter(Boolean).join(" ");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortValue = (item, field) => {
    switch (field) {
      case "employee":
        return fullName(item);
      case "position":
        return item.position?.name || "";
      case "workSchedule":
        return item.workSchedule?.name || "";
      default:
        return item[field];
    }
  };

  const sortedData = sortField
    ? [...(data || [])].sort((a, b) => {
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (sortField === "date_of_birth" || sortField === "passport_expiry_date") {
          return sortOrder === "asc"
            ? new Date(aVal) - new Date(bVal)
            : new Date(bVal) - new Date(aVal);
        }

        if (typeof aVal === "boolean" && typeof bVal === "boolean") {
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        }

        return sortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : data;

  return (
    <div className={styles.tableContainer} onScroll={onScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            {selectable && (
              <th className={styles.checkCol}>
                <input
                  ref={headerCheckRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                />
              </th>
            )}
            <th>
              <span className={styles.headerContent}>№</span>
            </th>
            <th className={styles.table_name_header} onClick={() => handleSort("employee")}>
              <span className={styles.headerContent}>
                {t("employee")}
                <SortArrow active={sortField === "employee"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("date_of_birth")}>
              <span className={styles.headerContent}>
                {t("dateOfBirth")}
                <SortArrow active={sortField === "date_of_birth"} order={sortOrder} />
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
            <th onClick={() => handleSort("pinfl")}>
              <span className={styles.headerContent}>
                {t("pinfl")}
                <SortArrow active={sortField === "pinfl"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("passport")}>
              <span className={styles.headerContent}>
                {t("passport")}
                <SortArrow active={sortField === "passport"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("passport_expiry_date")}>
              <span className={styles.headerContent}>
                {t("passportExpiry")}
                <SortArrow active={sortField === "passport_expiry_date"} order={sortOrder} />
              </span>
            </th>
            <th onClick={() => handleSort("workSchedule")}>
              <span className={styles.headerContent}>
                {t("workSchedule")}
                <SortArrow active={sortField === "workSchedule"} order={sortOrder} />
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
              <tr
                key={item.id}
                className={[
                  onRowClick || selectable ? styles.clickableRow : "",
                  selectable && selectedIds.includes(item.id)
                    ? styles.selectedRow
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={(e) => handleRowClick(e, item.id)}
              >
                {selectable && (
                  <td className={styles.checkCol}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => onToggleSelect(item.id)}
                    />
                  </td>
                )}
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
                <td>
                  {item.date_of_birth &&
                    (() => {
                      const info = getBirthdayInfo(item.date_of_birth);

                      const labels = {
                        today: `🎉 ${t("todayBirthdayLabel")} ${info.age} ${t("yearsOld")}`,
                        soon: `${formatDate(item.date_of_birth)}, ${info.diffDays} ${t("daysRemaining")}`,
                        normal: `${formatDate(item.date_of_birth)}, ${info.age} ${t("yearsOld")}`,
                      };

                      return (
                        <span
                          className={`${styles.badge} ${styles[info.status]}`}
                        >
                          {labels[info.status]}
                        </span>
                      );
                    })()}
                </td>
                <td>{item.employee_number}</td>
                <td>{item.position?.name}</td>
                <td>{item.pinfl}</td>
                <td>{item.passport}</td>
                <td>
                  {item.passport_expiry_date &&
                    (() => {
                      const status = getExpiryBadge(item.passport_expiry_date);

                      return (
                        <span
                          className={`${styles.badge} ${styles[status.status]}`}
                        >
                          {`${formatDate(item.passport_expiry_date)}${status.text}`}
                        </span>
                      );
                    })()}
                </td>
                <td>{item.workSchedule?.name}</td>
                <td>
                  <Badge text={item.status ? "active" : "terminated"} />
                </td>
                {
                  <ActionCell
                    item={item}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                  />
                }
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={selectable ? 12 : 11}>{t("noData")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EmployeesTable;
