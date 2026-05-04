import { FixedSizeList as List } from "react-window";
import { useTranslation } from "react-i18next";
import styles from "./VirtualAttendanceTable.module.scss";

const ROW_HEIGHT = 40; // пиксели

const VirtualAttendanceTable = ({ data, date, holidays }) => {
  const { t } = useTranslation();
  const [year, month] = date.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const dataArray = Object.entries(data).map(([userId, employee], index) => {
    return { userId, employee, index };
  });

  const Row = ({ index, style }) => {
    const { userId, employee } = dataArray[index];
    const { surname, name, patronymic, department_name, position_name } =
      employee.user_info;

    const fullName = `${surname || ""} ${name || ""} ${patronymic || ""}`;

    const sessionsByDay = {};
    Object.entries(employee.sessions_by_date || {}).forEach(([d, sessions]) => {
      const day = new Date(d).getDate();
      sessionsByDay[day] = sessions[0] || {};
    });

    let totalWorkedMinutes = 0;
    let totalDays = 0;
    Object.values(sessionsByDay).forEach((s) => {
      if (s.workDuration) {
        const match = s.workDuration.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          totalWorkedMinutes += hours * 60 + minutes;
          totalDays++;
        }
      }
    });

    const totalHours = Math.floor(totalWorkedMinutes / 60);
    const totalMinutes = totalWorkedMinutes % 60;
    const monthlyTotal = `${String(totalHours).padStart(2, "0")}:${String(
      totalMinutes
    ).padStart(2, "0")}`;

    return (
      <div className={styles.row} style={style}>
        <div className={styles.cell}>{index + 1}</div>
        <div className={styles.cell}>{fullName}</div>
        <div className={styles.cell}>{department_name}</div>
        <div className={styles.cell}>{position_name}</div>
        <div className={styles.cell}>
          <div>{totalDays} {t("daysShort")}</div>
          <div>{monthlyTotal}</div>
        </div>
        {daysArray.map((day) => {
          const s = sessionsByDay[day] || {};
          return (
            <div key={day} className={`${styles.cell} ${styles.dayCell}`}>
              {s.firstEntry && <div>{s.firstEntry}</div>}
              {s.lastExit && <div>{s.lastExit}</div>}
              {s.workDuration && <div>{s.workDuration}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.cell}>№</div>
        <div className={styles.cell}>{t("fullName")}</div>
        <div className={styles.cell}>{t("department")}</div>
        <div className={styles.cell}>{t("position")}</div>
        <div className={styles.cell}>{t("total")}</div>
        {daysArray.map((day) => {
          const isHoliday = holidays.some((holiday) => {
            const fromDate = new Date(holiday.date_from).getUTCDate();
            const toDate = new Date(holiday.date_to).getUTCDate();
            return day >= fromDate && day <= toDate;
          });
          return (
            <div
              key={day}
              className={`${styles.cell} ${styles.dayHeader} ${
                isHoliday ? styles.holiday : ""
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      <List
        height={600}
        itemCount={dataArray.length}
        itemSize={ROW_HEIGHT}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
};

export default VirtualAttendanceTable;
