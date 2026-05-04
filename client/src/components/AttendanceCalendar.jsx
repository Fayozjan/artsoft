import { useTranslation } from "react-i18next";
import styles from "./AttendanceCalendar.module.scss";

const AttendanceCalendar = ({ data }) => {
  const { t } = useTranslation();
  if (!data.length) return <p>{t("noData")}</p>;

  // Получаем данные сотрудника
  const employee = data[0];
  const {
    user_id,
    surname,
    name,
    patronymic,
    department_name,
    position_name,
    attendance_details,
  } = employee;

  // Создаём строку ФИО
  const fullName = `${surname || ""} ${name || ""} ${patronymic || ""}`.trim();

  // Определяем количество дней в месяце
  const daysInMonth = new Date(
    attendance_details[0]?.year,
    attendance_details[0]?.month,
    0
  ).getDate();

  // Массив для отображения дней месяца (1-31)
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const totalWorkedMinutes = employee.attendance_details.reduce(
    (total, dayData) => {
      if (!dayData.worked_hours || dayData.worked_hours.trim() === "00:00") {
        return total;
      }

      const [hours, minutes] = dayData.worked_hours.split(":").map(Number);
      const dailyMinutes = hours * 60 + minutes;

      return total + dailyMinutes;
    },
    0
  );

  const workedDays = employee.attendance_details.reduce((count, dayData) => {
    if (dayData.worked_hours && dayData.worked_hours.trim() !== "00:00") {
      return count + 1; // Увеличиваем счетчик, если в этот день есть отработанные часы
    }
    return count;
  }, 0);

  const totalHours = Math.floor(totalWorkedMinutes / 60);

  return (
    <div className={styles.calendar_container}>
      <div className={styles.summary}>
        <h3>{t("attendanceForMonth")}</h3>
        <p>
          <strong>{t("department")}:</strong> {department_name}
        </p>
        <p>
          <strong>{t("employee")}:</strong> {fullName} ({user_id})
        </p>
        <p>
          <strong>{t("position")}:</strong> {position_name}
        </p>
        <p>
          <strong>{t("monthTotal")}</strong>
          {` ${workedDays} ${t("daysWord")} ${totalHours} ${t("hoursWord")}`}
        </p>
      </div>

      <div className={styles.calendar}>
        {daysArray.map((day) => {
          const dayData = attendance_details.find((item) => item.day === day);

          const isHoliday = dayData?.is_holiday || false;
          const holidayName = dayData?.holiday_name || "";
          const intervals = dayData?.intervals || [];
          const workedHours = dayData?.worked_hours || "00:00";

          return (
            <div
              key={day}
              className={`${styles.day} ${isHoliday ? styles.holiday : ""}`}
            >
              <div className={styles.day_number}>
                {day}
                {isHoliday && (
                  <span className={styles.holiday_icon} title={holidayName}>
                    ⭐
                  </span>
                )}
              </div>

              <div className={styles.intervals}>
                {intervals.length ? (
                  intervals.map((interval, index) => (
                    <div key={index}>{interval}</div>
                  ))
                ) : (
                  <div className={styles.no_data}>❌ - ❌</div>
                )}
              </div>

              <div className={styles.total_hours}>Итог: {workedHours}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceCalendar;
