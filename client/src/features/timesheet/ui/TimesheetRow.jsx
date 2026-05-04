import React from "react";
import TimesheetCell from "./TimesheetCell";
import styles from "./Timesheet.module.scss";
import { formatMinutesToHours } from "../../../utils/date";
import { useTranslation } from "react-i18next";

const TimesheetRow = React.memo(
  ({
    employee,
    id,
    daysArray,
    index,
    currentPage,
    pageSize,
    virtualRow,
    date,
    isExpanded,
    measureRef,
    visibleColumns,
  }) => {
    const { t } = useTranslation();
    return (
      <tr
        ref={measureRef}
        data-index={virtualRow.index}
        data-employee-id={id}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          minWidth: "max-content",
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        <td className={`${styles.sticky} ${styles.infoCellClickable}`}>
          {(currentPage - 1) * pageSize + index + 1}
        </td>
        <td className={`${styles.stickyName} ${styles.infoCellClickable}`}>
          <div className={styles.empCell}>
            {(() => {
              const isInactive = employee?.status === false;
              const statusClass = isInactive ? styles.inactive : "";
              const initials = (employee?.employeeFullName || "")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase();
              return (
                <div className={`${styles.empAvatar} ${statusClass}`}>
                  {employee?.employeePhoto ? (
                    <img
                      src={`/api/employees/image/${employee.employeePhoto}`}
                      alt="employee"
                      className={styles.empPhoto}
                    />
                  ) : (
                    <div className={`${styles.empInitials} ${statusClass}`}>
                      {initials}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className={styles.empInfo}>
              <span className={styles.empName}>
                {employee?.employeeFullName}
              </span>
              <span className={styles.empSub}>
                {[employee?.branchName, employee?.departmentName]
                  .filter(Boolean)
                  .join(" / ")}
              </span>
            </div>
          </div>
        </td>
        {visibleColumns.position && (
          <td className={`${styles.optionalCol} ${styles.infoCellClickable}`}>
            {employee?.positionName}
          </td>
        )}
        {visibleColumns.pinfl && (
          <td className={`${styles.optionalCol} ${styles.infoCellClickable}`}>
            {employee?.pinfl}
          </td>
        )}
        {visibleColumns.workSchedule && (
          <td className={`${styles.optionalCol} ${styles.infoCellClickable}`}>
            {employee?.workScheduleName}
          </td>
        )}
        {visibleColumns.lateHours && (
          <td className={`${styles.optionalCol} ${styles.infoCellClickable}`}>
            {employee?.totalLateTime
              ? `${employee?.totalLateTime} ${t("hoursShort")}`
              : `00:00 ${t("hoursShort")}`}
          </td>
        )}
        {visibleColumns.overtimeHours && (
          <td className={`${styles.optionalCol} ${styles.infoCellClickable}`}>
            {`${formatMinutesToHours(employee?.totalOvertimeMinutes)} ${t("hoursShort")}` ||
              "00:00"}
          </td>
        )}
        {visibleColumns.paidTimeOff && (
          <td className={`${styles.optionalCol} ${styles.infoCellClickable}`}>
            {`${employee?.totalPaidTimeOffDays ?? 0} / ${formatMinutesToHours(employee?.totalPaidTimeOffMinutes ?? 0)} ${t("hoursShort")}`}
          </td>
        )}
        <td className={`${styles.optionalCol} ${styles.infoCellClickable}`}>
          {`${employee?.totalWorkedDays ?? 0} / ${employee?.totalScheduledDays ?? 0}`}
        </td>
        <td className={`${styles.optionalCol} ${styles.infoCellClickable}`}>
          {employee?.totalWorkedHours
            ? `${employee?.totalWorkedHours} / ${formatMinutesToHours(employee?.totalScheduledMinutes)}`
            : "00:00"}
        </td>

        {daysArray.map((day) => {
          const dayKey = `${date}-${String(day).padStart(2, "0")}`;
          return (
            <TimesheetCell
              key={day}
              day={day}
              dayData={employee.sessions?.[dayKey]}
              employeeId={id}
              isExpanded={isExpanded}
            />
          );
        })}
      </tr>
    );
  },
  (prevProps, nextProps) =>
    prevProps.employee === nextProps.employee &&
    prevProps.virtualRow.start === nextProps.virtualRow.start &&
    prevProps.daysArray === nextProps.daysArray &&
    prevProps.currentPage === nextProps.currentPage &&
    prevProps.pageSize === nextProps.pageSize &&
    prevProps.date === nextProps.date &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.visibleColumns === nextProps.visibleColumns,
);

TimesheetRow.displayName = "TimesheetRow";

export default TimesheetRow;
