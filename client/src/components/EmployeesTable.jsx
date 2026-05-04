import { useTranslation } from "react-i18next";

import { formatDate, getBirthdayInfo, getExpiryBadge } from "../utils/utils";

import Badge from "../components/Badge";
import { ActionCell } from "./ActionButtons";

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
  const { t } = useTranslation();

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <span className={styles.headerContent}>№</span>
            </th>
            <th className={styles.table_name_header}>
              <span className={styles.headerContent}>{t("employee")}</span>
            </th>
            <th>
              <span className={styles.headerContent}>{t("dateOfBirth")}</span>
            </th>
            <th>
              <span className={styles.headerContent}>
                {t("employeeNumber")}
              </span>
            </th>
            <th>
              <span className={styles.headerContent}>{t("position")}</span>
            </th>
            <th>
              <span className={styles.headerContent}>{t("pinfl")}</span>
            </th>
            <th>
              <span className={styles.headerContent}>{t("passport")}</span>
            </th>
            <th>
              <span className={styles.headerContent}>
                {t("passportExpiry")}
              </span>
            </th>
            <th>
              <span className={styles.headerContent}>{t("workSchedule")}</span>
            </th>
            <th>
              <span className={styles.headerContent}>{t("status")}</span>
            </th>
            <th>{(canEdit || canDelete) && t("action")}</th>
          </tr>
        </thead>
        <tbody>
          {data?.length > 0 ? (
            data.map((item, i) => (
              <tr key={item.id}>
                <td>{(currentPage - 1) * pageSize + i + 1}</td>
                <td>
                  <div className={styles.empCell}>
                    {item.photo ? (
                      <img
                        src={`/api/employees/image/${item.photo}`}
                        alt="employee"
                        className={
                          item.status ? styles.active : styles.terminated
                        }
                      />
                    ) : (
                      <div
                        className={`${styles.avatar} ${item.status ? styles.active : styles.terminated}`}
                      >
                        {[item.last_name, item.first_name]
                          .filter(Boolean)
                          .map((n) => n[0].toUpperCase())
                          .join("")}
                      </div>
                    )}
                    <div className={styles.empInfo}>
                      <span className={styles.empName}>
                        {[item.last_name, item.first_name, item.middle_name]
                          .filter(Boolean)
                          .join(" ")}{" "}
                        ({item.id})
                      </span>
                      <span className={styles.empSub}>
                        {[item.branch?.name, item.department?.name]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </div>
                  </div>
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
              <td colSpan="11">{t("noData")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EmployeesTable;
