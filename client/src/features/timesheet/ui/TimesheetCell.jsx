import React from "react";
import styles from "./Timesheet.module.scss";

const TimesheetCell = ({ day, dayData, employeeId }) => {
  const className = dayData?.hasPermission
    ? `${styles.cell} ${styles.cellGreen}`
    : styles.cell;

  const cellText = [
    dayData?.firstEntry || "",
    dayData?.lastExit || "",
    dayData?.workDuration || "",
  ].join("\n");

  return (
    <td
      className={className}
      data-employee-id={employeeId}
      data-day={day}
      style={{ whiteSpace: "pre-line" }}
    >
      {cellText}
    </td>
  );
};

export default React.memo(
  TimesheetCell,
  (prevProps, nextProps) =>
    prevProps.day === nextProps.day &&
    prevProps.employeeId === nextProps.employeeId &&
    prevProps.dayData === nextProps.dayData,
);
