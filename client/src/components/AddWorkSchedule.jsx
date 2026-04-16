import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addWorkSchedule } from "../api";
import Button from "./Button";

import styles from "./AddWorkSchedule.module.scss";
import { formatHoursMinutes } from "../utils/date";

const AddWorkSchedule = ({ handleClose, onSuccess }) => {
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  const workDaysTemplate = Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    start: "",
    end: "",
    break_start: "",
    break_end: "",
  }));

  const shifts = Array.from({ length: 3 }, (_, i) => ({
    shift_number: i + 1,
    start: "",
    end: "",
    break_start: "",
    break_end: "",
  }));

  const [formData, setFormData] = useState({
    name: "",
    type: "fixed",
    weekly_days: 5,
    weekly_hours: 40,
    work_days: workDaysTemplate,
    shifts: shifts,
    late_tolerance_minutes: 0,
    early_leave_tolerance_minutes: 0,
    late_leave_tolerance_minutes: 0,
  });

  // Подсчёт минут перерыва из break_start/break_end
  const getBreakMinutes = (breakStart, breakEnd) => {
    if (!breakStart || !breakEnd) return 0;
    const [bsh, bsm] = breakStart.split(":").map(Number);
    const [beh, bem] = breakEnd.split(":").map(Number);
    return Math.max(0, (beh * 60 + bem) - (bsh * 60 + bsm));
  };

  // Функция для подсчета рабочих минут (с вычетом перерыва)
  const getMinutesWorked = (start, end, breakStart, breakEnd) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const breakMins = getBreakMinutes(breakStart, breakEnd);
    let minutes = (eh - sh) * 60 + (em - sm) - breakMins;
    return minutes > 0 ? minutes : 0;
  };

  // Подсчет всех часов в неделю
  const totalMinutes = useMemo(() => {
    if (formData.type === "fixed" || formData.type === "remote") {
      return formData.work_days
        .slice(0, formData.weekly_days)
        .reduce(
          (sum, day) =>
            sum + getMinutesWorked(day.start, day.end, day.break_start, day.break_end),
          0,
        );
    } else if (formData.type === "shift") {
      return formData.shifts.reduce(
        (sum, shift) =>
          sum + getMinutesWorked(shift.start, shift.end, shift.break_start, shift.break_end),
        0,
      );
    }
    return 0;
  }, [
    formData.work_days,
    formData.shifts,
    formData.weekly_days,
    formData.type,
  ]);

  const totalHours = (totalMinutes / 60).toFixed(2);
  const exceeded = totalHours > formData.weekly_hours;

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "weekly_days") {
      const newWeeklyDays = Number(value);

      setFormData((prev) => {
        let updatedWorkDays = [...prev.work_days];

        if (newWeeklyDays > updatedWorkDays.length) {
          // Добавляем недостающие дни
          const daysToAdd = newWeeklyDays - updatedWorkDays.length;

          const additionalDays = Array.from({ length: daysToAdd }, (_, i) => ({
            day: updatedWorkDays.length + i + 1,
            start: "",
            end: "",
            break_minutes: 0,
          }));

          updatedWorkDays = [...updatedWorkDays, ...additionalDays];
        } else {
          // Урезаем лишние
          updatedWorkDays = updatedWorkDays.slice(0, newWeeklyDays);
        }

        return {
          ...prev,
          weekly_days: newWeeklyDays,
          work_days: updatedWorkDays,
        };
      });

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: name === "weekly_hours" ? Number(value) : value,
    }));
  };

  const handleDayChange = (index, field, value) => {
    setFormData((prev) => {
      const newWorkDays = [...prev.work_days];
      newWorkDays[index][field] = value;
      return { ...prev, work_days: newWorkDays };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (exceeded) {
      showAlert("Суммарные часы превышают норму!", "error");
      return;
    }

    try {
      // Создаём объект для отправки
      const dataToSend = { ...formData };

      if (formData.type === "fixed" || formData.type === "remote") {
        delete dataToSend.shifts;
      } else if (formData.type === "shift") {
        delete dataToSend.work_days;
        delete dataToSend.weekly_days;
      } else if (formData.type === "flexible") {
        delete dataToSend.work_days;
        delete dataToSend.shifts;
        delete dataToSend.weekly_days;
      }

      await addWorkSchedule(dataToSend);

      showAlert(t("success"), "success");
      onSuccess();
      setTimeout(handleClose, 1500);
    } catch (error) {
      showAlert("Ошибка", "error");
    }
  };

  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <form className={styles.addWorkSchedules} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addWorkSchedule")}</h2>
        <Button text={t("save")} type="submit" />
      </div>

      {/* Название и тип графика */}
      <div className={styles.row}>
        <div>
          <label>Название</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>Тип</label>
          <select name="type" value={formData.type} onChange={handleChange}>
            <option value="fixed">Фиксированный</option>
            <option value="shift">Сменный</option>
            <option value="flexible">Гибкий</option>
            <option value="remote">Дистанционный</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div style={{ flex: "0 0 49%" }}>
          <label>Норма часов в неделю</label>
          <input
            type="number"
            min={0}
            name="weekly_hours"
            value={formData.weekly_hours}
            onChange={handleChange}
          />
        </div>

        {(formData.type === "fixed" || formData.type === "remote") && (
          <div>
            <label>Рабочая неделя</label>
            <select
              name="weekly_days"
              value={formData.weekly_days}
              onChange={handleChange}
            >
              <option value={5}>5 дней</option>
              <option value={6}>6 дней</option>
              <option value={7}>7 дней</option>
            </select>
          </div>
        )}
      </div>

      {/* Fixed / Remote: график по дням */}
      {(formData.type === "fixed" || formData.type === "remote") && (
        <div className={styles.workDays}>
          {formData.work_days
            .slice(0, formData.weekly_days)
            .map((day, index) => (
              <div className={styles.row} key={day.day}>
                <div>
                  <label>{dayNames[index]}</label>
                  <input
                    type="time"
                    value={day.start}
                    onChange={(e) =>
                      handleDayChange(index, "start", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label>Конец</label>
                  <input
                    type="time"
                    value={day.end}
                    onChange={(e) =>
                      handleDayChange(index, "end", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label>Перерыв с</label>
                  <input
                    type="time"
                    value={day.break_start}
                    onChange={(e) =>
                      handleDayChange(index, "break_start", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label>Перерыв по</label>
                  <input
                    type="time"
                    value={day.break_end}
                    onChange={(e) =>
                      handleDayChange(index, "break_end", e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
        </div>
      )}

      {formData.type === "shift" &&
        formData.shifts.map((shift, index) => (
          <div className={styles.row} key={shift.shift_number}>
            <div>
              <label>{`Начало ${shift.shift_number} смены`}</label>
              <input
                type="time"
                value={shift.start}
                onChange={(e) => {
                  const newShifts = [...formData.shifts];
                  newShifts[index].start = e.target.value;
                  setFormData({ ...formData, shifts: newShifts });
                }}
              />
            </div>

            <div>
              <label>{`Конец ${shift.shift_number} смены`}</label>
              <input
                type="time"
                value={shift.end}
                onChange={(e) => {
                  const newShifts = [...formData.shifts];
                  newShifts[index].end = e.target.value;
                  setFormData({ ...formData, shifts: newShifts });
                }}
              />
            </div>

            <div>
              <label>{`Перерыв ${shift.shift_number} с`}</label>
              <input
                type="time"
                value={shift.break_start}
                onChange={(e) => {
                  const newShifts = [...formData.shifts];
                  newShifts[index].break_start = e.target.value;
                  setFormData({ ...formData, shifts: newShifts });
                }}
              />
            </div>

            <div>
              <label>{`Перерыв ${shift.shift_number} по`}</label>
              <input
                type="time"
                value={shift.break_end}
                onChange={(e) => {
                  const newShifts = [...formData.shifts];
                  newShifts[index].break_end = e.target.value;
                  setFormData({ ...formData, shifts: newShifts });
                }}
              />
            </div>
          </div>
        ))}

      {/* Допустимые окна */}
      <div className={styles.row}>
        <div>
          <label>Допуск опоздания (мин)</label>
          <input
            type="number"
            min={0}
            name="late_tolerance_minutes"
            value={formData.late_tolerance_minutes}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Допуск раннего ухода (мин)</label>
          <input
            type="number"
            min={0}
            name="early_leave_tolerance_minutes"
            value={formData.early_leave_tolerance_minutes}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Допуск позднего ухода (мин)</label>
          <input
            type="number"
            min={0}
            name="late_leave_tolerance_minutes"
            value={formData.late_leave_tolerance_minutes}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div
          className={styles.weeklyHours}
          style={{
            border: exceeded ? "1px solid red" : "1px solid #ccc",
            backgroundColor: exceeded ? "#ffeaea" : "#f9f9f9",
          }}
        >
          <span className={styles.label}>Всего часов в неделю:</span>
          <span className={styles.value}>
            {formatHoursMinutes(totalMinutes)}
          </span>
          <span className={styles.separator}>/</span>
          <span className={styles.max}>{formData.weekly_hours}ч</span>
          {exceeded && (
            <span className={styles.warning}>⚠️ Превышает норму часов!</span>
          )}
        </div>
      </div>
    </form>
  );
};

export default AddWorkSchedule;
