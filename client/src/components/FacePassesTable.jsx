import { useState } from "react";

import Badge from "./Badge";
import SortArrow from "./SortArrow";
import EmployeeCell from "./EmployeeCell";
import { useImagePreviewStore } from "../stores/imagePreviewStore";
import { ActionCell } from "./ActionButtons";

import styles from "./FacePassesTable.module.scss";
import { t } from "i18next";
import { formatIsoToLocalDateTime } from "../utils/date";

const DEFAULT_VISIBLE = { location: false, source: false };

const TableHrEvents = ({
  data,
  currentPage,
  pageSize,
  visibleColumns = DEFAULT_VISIBLE,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  onScroll,
}) => {
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const openImagePreview = useImagePreviewStore((s) => s.open);

  const getSortValue = (event, field) => {
    const emp = event?.employee;
    switch (field) {
      case "name":
        return [emp?.last_name, emp?.first_name, emp?.middle_name]
          .filter(Boolean)
          .join(" ");
      case "position_name":
        return emp?.position?.name || "";
      case "door_name":
        return event?.door?.name || "";
      case "direction":
        return event?.direction || "";
      default:
        return event[field];
    }
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = getSortValue(a, sortField);
      let bVal = getSortValue(b, sortField);

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (sortField === "date") {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
        }
      }

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal), "ru", { sensitivity: "base" })
        : String(bVal).localeCompare(String(aVal), "ru", { sensitivity: "base" });
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

  const extraCols =
    (visibleColumns.source ? 1 : 0) + (visibleColumns.location ? 1 : 0);

  return (
    <div className={styles.tableContainer} onScroll={onScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>№</th>
            <th
              className={styles.table_name_header}
              onClick={() => handleSort("name")}
            >
              <span className={styles.headerContent}>
                {t("employee")}
                <SortArrow active={sortField === "name"} order={sortOrder} />
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
            {visibleColumns.source && (
              <th onClick={() => handleSort("source")}>
                <span className={styles.headerContent}>
                  {t("source")}
                  <SortArrow
                    active={sortField === "source"}
                    order={sortOrder}
                  />
                </span>
              </th>
            )}
            {visibleColumns.location && <th>{t("location")}</th>}
            <th onClick={() => handleSort("direction")}>
              <span className={styles.headerContent}>
                {t("direction")}
                <SortArrow
                  active={sortField === "direction"}
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
            {(canEdit || canDelete) && <th>{t("action")}</th>}
          </tr>
        </thead>
        <tbody>
          {data?.length > 0 ? (
            getSortedData().map((event, i) => {
              const emp = event?.employee;
              return (
                <tr key={event.identifier}>
                  <td>{(currentPage - 1) * pageSize + i + 1}</td>
                  <td>
                    <EmployeeCell
                      photo={emp?.photo}
                      lastName={emp?.last_name}
                      firstName={emp?.first_name}
                      middleName={emp?.middle_name}
                      id={event?.employee_id}
                      branch={emp?.branch?.name}
                      department={emp?.department?.name}
                      active={emp?.status !== false}
                    />
                  </td>
                  <td>{emp?.position?.name}</td>
                  <td>{event?.door?.name ?? "—"}</td>
                  {visibleColumns.source && <td>{t(event?.source)}</td>}
                  {visibleColumns.location && (
                    <td>
                      {event?.latitude != null && event?.longitude != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {event.latitude.toFixed(5)},{" "}
                          {event.longitude.toFixed(5)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td>
                    <Badge text={event?.direction} />
                  </td>
                  <td>{formatIsoToLocalDateTime(event.date)}</td>
                  <td>
                    {event.photo && (
                      <img
                        src={`/api/face-passes/image/${event.photo}`}
                        className={styles.cameraPhoto}
                        onClick={() =>
                          openImagePreview(
                            `/api/face-passes/image/${event.photo}`,
                          )
                        }
                        style={{ cursor: "pointer" }}
                      />
                    )}
                  </td>
                  {(canEdit || canDelete) && (
                    <ActionCell
                      item={event}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onEdit={() => onEdit(event)}
                      onDelete={() => onDelete(event)}
                    />
                  )}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7 + extraCols + (canEdit || canDelete ? 1 : 0)}>
                {t("noData")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TableHrEvents;
