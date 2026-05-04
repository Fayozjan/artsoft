import { useState } from "react";
import { useTranslation } from "react-i18next";

import Badge from "./Badge";
import SortArrow from "./SortArrow";

import styles from "./VehiclePassesTable.module.scss";

const VehiclePassesTable = ({
  data,
  currentPage,
  pageSize,
  viewType = "row",
}) => {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

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
      const isNumberA = !isNaN(aNum);
      const isNumberB = !isNaN(bNum);

      if (isNumberA && isNumberB) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

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

  const sortedData = getSortedData();

  const parsePlate = (raw = "") => {
    const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();

    // 50Z436BB
    let match = clean.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/);
    if (match) {
      return {
        region: match[1],
        series: match[2],
        number: match[3],
        suffix: match[4],
      };
    }

    // 50717CAA
    match = clean.match(/^(\d{2})(\d{3})([A-Z]{3})$/);
    if (match) {
      return {
        region: match[1],
        series: null,
        number: match[2],
        suffix: match[3],
      };
    }

    // 8570BA50  → 50 857 BA
    match = clean.match(/^(\d{3,4})([A-Z]{2})(\d{2})$/);
    if (match) {
      return {
        region: match[3],
        series: null,
        number: match[1],
        suffix: match[2],
      };
    }

    return {
      region: null,
      series: null,
      number: raw || "—",
      suffix: null,
    };
  };

  if (viewType === "card") {
    return (
      <div className={styles.cardGrid}>
        {sortedData.length > 0 ? (
          sortedData.map((event, i) => {
            const plate = parsePlate(event.plate_number);
            return (
              <div key={event.identifier} className={styles.card}>
                {/* Photo */}
                <div className={styles.cardPhoto}>
                  {event.photo ? (
                    <img src={`/api/vehicle-passes/image/${event.photo}`} />
                  ) : (
                    <div className={styles.cardPhotoPlaceholder}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="36"
                        height="36"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="currentColor"
                          d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3h2l3 4v3h-2a3 3 0 0 1-6 0H8a3 3 0 0 1-6 0m0 0a3 3 0 0 0 6 0M3 5v10h1.1A3 3 0 0 1 7 13a3 3 0 0 1 2.9 2H14V5zm15 9.5a1.5 1.5 0 0 0-3 0a1.5 1.5 0 0 0 3 0M8.5 16.5A1.5 1.5 0 0 0 7 15a1.5 1.5 0 0 0-1.5 1.5A1.5 1.5 0 0 0 7 18a1.5 1.5 0 0 0 1.5-1.5M15 9v2h3.5L17 9z"
                        />
                      </svg>
                    </div>
                  )}

                  <div
                    className={`${styles.cardDirectionBadge} ${
                      event?.direction === "forward"
                        ? styles.dirIn
                        : event?.direction === "reverse"
                          ? styles.dirOut
                          : styles.dirUnknown
                    }`}
                  >
                    {event?.direction === "forward"
                      ? t("forward")
                      : event?.direction === "reverse"
                        ? t("reverse")
                        : t("unknown")}
                  </div>
                </div>

                {/* Vehicle number (license plate style) */}
                <div className={styles.cardPlate}>
                  {plate.region && (
                    <span className={styles.plateRegion}>{plate.region}</span>
                  )}
                  {plate.region && <div className={styles.plateDivider} />}
                  {plate.series && (
                    <span className={styles.plateSeries}>{plate.series}</span>
                  )}
                  <span className={styles.plateNumber}>{plate.number}</span>
                  {plate.suffix && (
                    <span className={styles.plateSuffix}>{plate.suffix}</span>
                  )}
                  <div className={styles.plateUzBlock}>
                    <div className={styles.plateFlag}>
                      <div className={styles.flagBlue} />
                      <div className={styles.flagWhite} />
                      <div className={styles.flagGreen} />
                    </div>
                    <span className={styles.plateUz}>uz</span>
                  </div>
                </div>

                {/* Card details */}
                <div className={styles.cardDetails}>
                  <div className={styles.cardDetailRow}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fill="currentColor"
                        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5z"
                      />
                    </svg>
                    <span className={styles.cardDetailLabel}>{t("branch")}</span>
                    <span className={styles.cardDetailValue}>
                      {event.branch_name || "—"}
                    </span>
                  </div>

                  <div className={styles.cardDetailRow}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="2.5"
                        height="16"
                        rx="1"
                        fill="currentColor"
                      />
                      <rect
                        x="4.25"
                        y="5.5"
                        width="2"
                        height="2.5"
                        rx="1"
                        fill="currentColor"
                      />
                      <line
                        x1="5.5"
                        y1="6.75"
                        x2="19"
                        y2="3.5"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="4.5"
                        cy="13"
                        r="1.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span className={styles.cardDetailLabel}>{t("gates")}</span>
                    <span className={styles.cardDetailValue}>
                      {event.gate_name || "—"}
                    </span>
                  </div>

                  <div className={styles.cardDetailRow}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fill="currentColor"
                        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8s8 3.58 8 8s-3.58 8-8 8zm.5-13H11v6l5.25 3.15l.75-1.23l-4.5-2.67z"
                      />
                    </svg>
                    <span className={styles.cardDetailLabel}>{t("time")}</span>
                    <span className={styles.cardDetailValue}>
                      {event.date || "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.cardEmpty}>{t("noData")}</div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>№</th>
            <th onClick={() => handleSort("plate_number")}>
              <span className={styles.headerContent}>
                {t("vehicle")}
                <SortArrow
                  active={sortField === "plate_number"}
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
            <th onClick={() => handleSort("gate_name")}>
              <span className={styles.headerContent}>
                {t("gates")}
                <SortArrow
                  active={sortField === "gate_name"}
                  order={sortOrder}
                />
              </span>
            </th>
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
          </tr>
        </thead>
        <tbody>
          {sortedData.length > 0 ? (
            sortedData.map((event, i) => {
              const plate = parsePlate(event.plate_number);
              return (
                <tr key={event.identifier}>
                  <td>{(currentPage - 1) * pageSize + i + 1}</td>
                  <td>
                    {[plate.region, plate.series, plate.number, plate.suffix]
                      .filter(Boolean)
                      .join(" ")}
                  </td>{" "}
                  <td>{event.branch_name}</td>
                  <td>{event.gate_name}</td>
                  <td>
                    <Badge text={event?.direction} />
                  </td>
                  <td>{event.date}</td>
                  <td>
                    {event?.photo && (
                      <img src={`/api/vehicle-passes/image/${event.photo}`} />
                    )}
                  </td>
                </tr>
              );
            })
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

export default VehiclePassesTable;
