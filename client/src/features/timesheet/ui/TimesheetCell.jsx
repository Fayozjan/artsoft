import React from "react";
import styles from "./Timesheet.module.scss";

function formatEventTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("ru-RU", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TimesheetCell = ({ day, dayData, employeeId, isExpanded }) => {
  const baseClass = dayData?.timeOff
    ? `${styles.cell} ${styles.cellGreen}`
    : styles.cell;

  if (isExpanded) {
    const events = dayData?.events || [];
    const className = `${baseClass} ${styles.cellExpanded}`;
    return (
      <td className={className} data-employee-id={employeeId} data-day={day}>
        {events.map((ev, i) => (
          <div key={i} className={styles.eventRow}>
            <span
              className={`${styles.eventTime} ${ev.direction === "entry" ? styles.eventEntry : styles.eventExit}`}
            >
              {formatEventTime(ev.date)}
            </span>
            {ev.doorName && (
              <span className={styles.doorName} title={ev.doorName}>
                {ev.doorName}
              </span>
            )}
          </div>
        ))}
        {dayData?.workDuration && events.length > 0 && (
          <div className={styles.workDurationRow}>{dayData.workDuration}</div>
        )}
      </td>
    );
  }

  const entryExitText = [
    dayData?.firstEntry || "\u00A0",
    dayData?.lastExit || "\u00A0",
  ].join("\n");

  return (
    <td
      className={baseClass}
      data-employee-id={employeeId}
      data-day={day}
      style={{ whiteSpace: "pre-line" }}
    >
      {entryExitText}
      {dayData?.workDuration && (
        <span className={styles.workDurationText}>{dayData.workDuration}</span>
      )}
    </td>
  );
};

export default React.memo(
  TimesheetCell,
  (prevProps, nextProps) =>
    prevProps.day === nextProps.day &&
    prevProps.employeeId === nextProps.employeeId &&
    prevProps.dayData === nextProps.dayData &&
    prevProps.isExpanded === nextProps.isExpanded,
);
