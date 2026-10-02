import { useState } from "react";
import styles from "./AtWorkChart.module.scss";
import { useTranslation } from "react-i18next";
import SortArrow from "./SortArrow";

const AtWorkChart = ({ data, handleClickDepartment }) => {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const chartData = data.map((dept) => ({
    name: dept.departmentName,
    id: dept.departmentId,
    total: dept.allEmployeeCount,
    arrived: dept.arrivedEmployeeCount,
    absent: dept.allEmployeeCount - dept.arrivedEmployeeCount,
    present: dept.onSiteEmployeeCount,
    left: dept.arrivedEmployeeCount - dept.onSiteEmployeeCount,
    presencePercentage:
      dept.allEmployeeCount > 0
        ? Math.round((dept.arrivedEmployeeCount / dept.allEmployeeCount) * 100)
        : 0,
  }));

  const handleClick = (e) => {
    const departmentId = e.currentTarget.dataset.id;
    handleClickDepartment(departmentId);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedData = sortField
    ? [...chartData].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        }
        return sortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : chartData;

  return (
    <div className={styles.tableWrapper}>
      <h2 className={styles.tableTitle}>{t("detailStatsByDept")}</h2>
      <div className={styles.tableContainer}>
        <table className={styles.statsTable}>
          <thead>
            <tr>
              <th>№</th>
              <th onClick={() => handleSort("name")}>
                <span className={styles.headerContent}>
                  {t("department")}
                  <SortArrow active={sortField === "name"} order={sortOrder} />
                </span>
              </th>
              <th onClick={() => handleSort("total")}>
                <span className={styles.headerContent}>
                  {t("totalLabel")}
                  <SortArrow active={sortField === "total"} order={sortOrder} />
                </span>
              </th>
              <th onClick={() => handleSort("arrived")}>
                <span className={styles.headerContent}>
                  {t("checkedIn")}
                  <SortArrow active={sortField === "arrived"} order={sortOrder} />
                </span>
              </th>
              <th onClick={() => handleSort("absent")}>
                <span className={styles.headerContent}>
                  {t("notCheckedIn")}
                  <SortArrow active={sortField === "absent"} order={sortOrder} />
                </span>
              </th>
              <th onClick={() => handleSort("present")}>
                <span className={styles.headerContent}>
                  {t("presentNow")}
                  <SortArrow active={sortField === "present"} order={sortOrder} />
                </span>
              </th>
              <th onClick={() => handleSort("left")}>
                <span className={styles.headerContent}>
                  {t("leftWork")}
                  <SortArrow active={sortField === "left"} order={sortOrder} />
                </span>
              </th>
              <th onClick={() => handleSort("presencePercentage")}>
                <span className={styles.headerContent}>
                  {t("percentLabel")}
                  <SortArrow active={sortField === "presencePercentage"} order={sortOrder} />
                </span>
              </th>
              <th>{t("progressLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((dept, index) => (
              <tr key={index} data-id={dept.id} onClick={handleClick}>
                <td className={styles.deptName}>{index + 1}</td>
                <td className={styles.deptName}>{dept.name}</td>
                <td className={styles.total}>{dept.total}</td>
                <td className={styles.arrived}>{dept.arrived}</td>
                <td className={styles.absent}>{dept.absent}</td>
                <td className={styles.present}>{dept.present}</td>
                <td className={styles.left}>{dept.left}</td>
                <td>{dept.presencePercentage}%</td>
                <td>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${dept.presencePercentage}%` }}
                    ></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AtWorkChart;
