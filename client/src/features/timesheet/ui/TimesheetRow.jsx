import React from "react";
import TimesheetCell from "./TimesheetCell";
import styles from "./Timesheet.module.scss";

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
  }) => {
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
            {employee?.employeePhoto && (
              <img
                src={`/api/employees/image/${employee.employeePhoto}`}
                alt="employee"
                className={styles.empPhoto}
              />
            )}
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
        <td className={styles.infoCellClickable}>{employee?.positionName}</td>
        <td className={styles.infoCellClickable}>{employee?.pinfl}</td>
        <td className={styles.infoCellClickable}>
          {employee?.workScheduleName}
        </td>
        <td className={styles.infoCellClickable}>
          {employee?.totalWorkedDays || 0}
        </td>
        <td className={styles.infoCellClickable}>
          {employee?.totalWorkedHours || "00:00"}
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
    prevProps.isExpanded === nextProps.isExpanded,
);

TimesheetRow.displayName = "TimesheetRow";

export default TimesheetRow;
