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
  }) => {
    return (
      <tr
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          minWidth: "max-content",
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        <td className={styles.sticky}>
          {(currentPage - 1) * pageSize + index + 1}
        </td>
        <td className={styles.stickyName}>{employee?.employeeFullName}</td>
        <td>{employee?.branchName}</td>
        <td>{employee?.departmentName}</td>
        <td>{employee?.positionName}</td>
        <td>{employee?.workScheduleName}</td>
        <td>{employee?.totalWorkedDays || 0}</td>
        <td>{employee?.totalWorkedHours || "00:00"}</td>

        {daysArray.map((day) => {
          const dayKey = `${date}-${String(day).padStart(2, "0")}`;
          return (
            <TimesheetCell
              key={day}
              day={day}
              dayData={employee.sessions?.[dayKey]}
              employeeId={id}
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
    prevProps.date === nextProps.date,
);

TimesheetRow.displayName = "TimesheetRow";

export default TimesheetRow;
