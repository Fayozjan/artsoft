import React from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import styles from "./Timesheet.module.scss";

// Пометки производственного календаря: класс колонки + подпись для тултипа
const DAY_MARKS = {
  holiday: { style: "holidayCol", labelKey: "holidayDay" },
  weekend: { style: "weekendCol", labelKey: "weekendDay" },
  short: { style: "shortCol", labelKey: "shortDay" },
};

const TimesheetHeader = React.memo(
  ({ daysArray, calendarByDay, year, month, visibleColumns }) => {
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
            const mark = calendarByDay?.get(day);
            const markInfo = mark ? DAY_MARKS[mark.day_type] : null;
            // Красное воскресенье не рисуем поверх пометки — иначе два цвета в ячейке
            const isSunday = !markInfo && dateObj.day() === 0;

            const title = markInfo
              ? [
                  t(markInfo.labelKey),
                  mark.name,
                  mark.day_type === "short" && mark.short_minutes
                    ? `−${mark.short_minutes} ${t("minutesShort")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined;

            return (
              <th
                key={day}
                title={title}
                className={[
                  styles.th_with_icon,
                  isSunday ? styles.sunday : "",
                  markInfo ? styles[markInfo.style] : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {day}
                {markInfo && <span className={styles.dayMarkDot} />}
              </th>
            );
          })}
        </tr>
      </thead>
    );
  },
);

export default TimesheetHeader;
