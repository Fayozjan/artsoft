import { useState } from "react";
import styles from "./Table.module.scss";

const Table = ({ columns, data }) => {
  const [sortConfig, setSortConfig] = useState({
    key: "employee_full_name",
    direction: "asc",
  });

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
                        width={20}
                        height={20}
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
                        width={20}
                        height={20}
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
                Нет данных
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

export default Table;
