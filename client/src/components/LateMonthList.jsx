import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./LateMonthList.module.scss";

const LateMonthList = ({ data }) => {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState({
    key: "fullname",
    direction: "asc",
  });

  const [modalData, setModalData] = useState(null);

  const columns = [
    { label: "№", render: (_, __, i) => i + 1 },
    {
      label: t("fullName"),
      accessor: "fullname",
    },
    { label: t("branch"), accessor: "branch_name" },
    { label: t("department"), accessor: "department_name" },
    { label: t("position"), accessor: "position_name" },
    {
      label: t("lateForMonth"),
      accessor: "monthly_late_count",
    },
    {
      label: t("action"),
      render: (_, item) => (
        <button className={styles.btnMore} onClick={() => setModalData(item)}>
          {t("more")}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="200"
            height="200"
            viewBox="0 0 24 24"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="m10 17l5-5m0 0l-5-5"
            />
          </svg>
        </button>
      ),
    },
  ];

  const handleSort = (accessor) => {
    setSortConfig((prev) => {
      if (prev.key === accessor) {
        return {
          key: accessor,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: accessor, direction: "asc" };
    });
  };

  const sortedData = [...data].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (!key) return 0;

    const aVal = a[key];
    const bVal = b[key];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "number" && typeof bVal === "number") {
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }

    return direction === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  return (
    <div className={styles.tableContainer}>
      {modalData && (
        <div className={styles.modalOverlay} onClick={() => setModalData(null)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{t("lateDetailsTitle")}: {modalData.fullname}</h3>
            <ul className={styles.lateList}>
              {modalData.lateDays?.map((entry, i) => {
                const minutes = entry.minutesLate;
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = minutes % 60;

                const formattedLate =
                  minutes >= 60
                    ? `${hours} ${t("hoursShort")}${
                        remainingMinutes > 0 ? ` ${remainingMinutes} ${t("minutesShort")}` : ""
                      }`
                    : `${minutes} ${t("minutesShort")}`;

                return (
                  <li key={i}>
                    {i + 1}. {t("date")}: {entry.date} — {t("lateCol")}: {formattedLate} ({t("scheduledTime")}: {entry.scheduled.slice(0, 5)}, {t("arrived")}: {entry.actual})
                  </li>
                );
              })}
            </ul>
            <svg
              className={styles.closeButton}
              onClick={() => setModalData(null)}
              xmlns="http://www.w3.org/2000/svg"
              width="200"
              height="200"
              viewBox="0 0 42 42"
            >
              <path
                fill="currentColor"
                fill-rule="evenodd"
                d="m21.002 26.588l10.357 10.604c1.039 1.072 1.715 1.083 2.773 0l2.078-2.128c1.018-1.042 1.087-1.726 0-2.839L25.245 21L36.211 9.775c1.027-1.055 1.047-1.767 0-2.84l-2.078-2.127c-1.078-1.104-1.744-1.053-2.773 0L21.002 15.412L10.645 4.809c-1.029-1.053-1.695-1.104-2.773 0L5.794 6.936c-1.048 1.073-1.029 1.785 0 2.84L16.759 21L5.794 32.225c-1.087 1.113-1.029 1.797 0 2.839l2.077 2.128c1.049 1.083 1.725 1.072 2.773 0l10.358-10.604z"
              />
            </svg>
          </div>
        </div>
      )}
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
                {t("noData")}
              </td>
            </tr>
          ) : (
            sortedData.map((item, i) => (
              <tr key={item.identifier || i} className="fade-in">
                {columns.map((col, j) => (
                  <td key={j}>
                    {col.render
                      ? col.render(item[col.accessor], item, i)
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

export default LateMonthList;
