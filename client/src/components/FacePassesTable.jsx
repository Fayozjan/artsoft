import { useState } from "react";

import Badge from "./Badge";
import SortArrow from "./SortArrow";

import styles from "./FacePassesTable.module.scss";
import { t } from "i18next";
import { formatIsoToLocalDateTime } from "../utils/date";

const TableHrEvents = ({ data, currentPage, pageSize }) => {
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Пустые значения идут в конец
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Если сортируем по времени события
      if (sortField === "event_time_formatted") {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);

        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
        }
      }

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
        ? String(aVal).localeCompare(String(bVal), "ru", {
            sensitivity: "base",
          })
        : String(bVal).localeCompare(String(aVal), "ru", {
            sensitivity: "base",
          });
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
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>№</th>
            <th
              className={styles.table_name_header}
              onClick={() => handleSort("name")}
            >
              <span className={styles.headerContent}>
                {t("fullName")}
                <SortArrow active={sortField === "name"} order={sortOrder} />
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
            <th onClick={() => handleSort("door_name")}>
              <span className={styles.headerContent}>
                {t("door")}
                <SortArrow
                  active={sortField === "door_name"}
                  order={sortOrder}
                />
              </span>
            </th>
            <th onClick={() => handleSort("source")}>
              <span className={styles.headerContent}>
                {t("source")}
                <SortArrow active={sortField === "source"} order={sortOrder} />
              </span>
            </th>
            <th>{t("location")}</th>
            <th onClick={() => handleSort("event_type")}>
              <span className={styles.headerContent}>
                {t("direction")}
                <SortArrow
                  active={sortField === "event_type"}
                  order={sortOrder}
                />
              </span>
            </th>
            <th onClick={() => handleSort("date")}>
              <span className={styles.headerContent}>
                {t("time")}
                <SortArrow active={sortField === "date"} order={sortOrder} />
              </span>
            </th>
            <th>{t("image")}</th>
          </tr>
        </thead>
        <tbody>
          {data?.length > 0 ? (
            getSortedData().map((event, i) => (
              <tr key={event.identifier}>
                <td>{(currentPage - 1) * pageSize + i + 1}</td>
                <td>
                  <div className={styles.employee}>
                    {[
                      event?.employee?.last_name,
                      event?.employee?.first_name,
                      event?.employee?.middle_name,
                      event?.employee_id,
                    ]
                      .filter(Boolean)
                      .join(" ")}

                    {event?.employee?.photo && (
                      <img
                        src={`/api/employees/image/${event.employee.photo}`}
                        alt="employee"
                      />
                    )}
                  </div>
                </td>

                <td>{event?.employee?.branch?.name}</td>
                <td>{event?.employee?.department?.name}</td>
                <td>{event?.employee?.position?.name}</td>
                <td>{event?.door?.name ?? "—"}</td>
                <td>{t(event?.source)}</td>
                <td>
                  {event?.latitude != null && event?.longitude != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <Badge text={event?.direction} />
                </td>
                <td>{formatIsoToLocalDateTime(event.date)}</td>
                <td>
                  {event.photo && (
                    <img src={`/api/face-passes/image/${event.photo}`} />
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="11">{t("noData")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TableHrEvents;
