import React from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import styles from "./Timesheet.module.scss";

const TimesheetHeader = React.memo(
  ({ daysArray, holidayDays, year, month, visibleColumns }) => {
    const { t } = useTranslation();

    return (
      <thead>
        <tr>
          <th className={`${styles.sticky} ${styles.stickyHeader}`}>№</th>
          <th className={`${styles.stickyName} ${styles.stickyHeader}`}>
            {t("fullName")}
          </th>
          {visibleColumns.position && (
            <th className={styles.optionalCol}>{t("position")}</th>
          )}
          {visibleColumns.pinfl && (
            <th className={styles.optionalCol}>{t("pinfl")}</th>
          )}
          {visibleColumns.workSchedule && (
            <th className={styles.optionalCol}>{t("workSchedule")}</th>
          )}
          {visibleColumns.lateHours && (
            <th className={styles.optionalCol}>{t("lateHours")}</th>
          )}
          {visibleColumns.overtimeHours && (
            <th className={styles.optionalCol}>{t("overtimeHours")}</th>
          )}
          {visibleColumns.paidTimeOff && (
            <th className={styles.optionalCol}>{t("paidTimeOff")}</th>
          )}
          <th className={styles.optionalCol}>{t("workedDays")}</th>
          <th className={styles.optionalCol}>{t("workedHours")}</th>
          {daysArray.map((day) => {
            const dateObj = dayjs(
              `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            );
            const isSunday = dateObj.day() === 0;
            return (
              <th
                key={day}
                className={`${styles.th_with_icon} ${isSunday ? styles.sunday : ""}`}
              >
                {day}
                {holidayDays.has(day) && (
                  <span className={styles.holiday_icon}>⭐</span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
    );
  },
);

export default TimesheetHeader;
