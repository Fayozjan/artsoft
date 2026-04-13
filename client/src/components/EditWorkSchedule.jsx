import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getWorkScheduleById, editWorkScheduleById } from "../api";

import Button from "./Button";

import styles from "./AddWorkSchedule.module.scss";
import { formatHoursMinutes } from "../utils/date";

const EditWorkSchedule = ({ id, handleClose, onSuccess }) => {
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  const workDaysTemplate = Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    start: "",
    end: "",
    break_minutes: 0,
  }));

  const shiftsTemplate = Array.from({ length: 3 }, (_, i) => ({
    shift_number: i + 1,
    start: "",
    end: "",
    break_minutes: 0,
  }));

  const [formData, setFormData] = useState({
    name: "",
    type: "fixed", // fixed | shift | flexible
    weekly_days: 5,
    weekly_hours: 40,
    work_days: workDaysTemplate,
    shifts: shiftsTemplate,
    status: true,
    valid_from: "",
  });

  // Функция для подсчета минут между start и end с учётом перерыва
  const getMinutesWorked = (start, end, breakMinutes = 0) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let minutes = (eh - sh) * 60 + (em - sm) - Number(breakMinutes || 0);
    return minutes > 0 ? minutes : 0;
  };

  // Подсчет всех часов в неделю
  const totalMinutes = useMemo(() => {
    if (formData.type === "fixed") {
      return formData.work_days
        .slice(0, formData.weekly_days)
        .reduce(
          (sum, day) =>
            sum + getMinutesWorked(day.start, day.end, day.break_minutes),
          0,
        );
    } else if (formData.type === "shift") {
      return formData.shifts.reduce(
        (sum, shift) =>
          sum + getMinutesWorked(shift.start, shift.end, shift.break_minutes),
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

  // Загрузка данных графика
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [scheduleRes] = await Promise.all([getWorkScheduleById(id)]);

        if (scheduleRes.success) {
          const data = {
            ...scheduleRes.data,
            weekly_days: Number(scheduleRes.data.weekly_days) || 5,
            weekly_hours: Number(scheduleRes.data.weekly_hours) || 40,
            work_days: scheduleRes.data.work_days || workDaysTemplate,
            shifts: scheduleRes.data.shifts || shiftsTemplate,
          };
          setFormData(data);
        } else {
          showAlert("Ошибка при загрузке графика", "error");
          setTimeout(() => handleClose(), 1500);
        }
      } catch (error) {
        console.error(error);
        showAlert("Ошибка при загрузке данных", "error");
        setTimeout(() => handleClose(), 1500);
      }
    };

    fetchData();
  }, [id]);

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

  // Изменение дней для fixed
  const handleDayChange = (index, field, value) => {
    setFormData((prev) => {
      const newWorkDays = [...prev.work_days];
      newWorkDays[index][field] = value;
      return { ...prev, work_days: newWorkDays };
    });
  };

  // Изменение смен для shift
  const handleShiftChange = (index, field, value) => {
    setFormData((prev) => {
      const newShifts = [...prev.shifts];
      newShifts[index][field] = value;
      return { ...prev, shifts: newShifts };
    });
  };

  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = { ...formData };

      // Убираем лишние поля в зависимости от типа
      if (formData.type === "fixed") {
        delete dataToSend.shifts;
      } else if (formData.type === "shift") {
        delete dataToSend.work_days;
        delete dataToSend.weekly_days;
      } else if (formData.type === "flexible") {
        delete dataToSend.work_days;
        delete dataToSend.shifts;
        delete dataToSend.weekly_days;
      }

      await editWorkScheduleById(id, dataToSend);

      showAlert(t("success"), "success");
      onSuccess();
      setTimeout(handleClose, 1500);
    } catch (error) {
      console.error(error);
      showAlert("Ошибка при сохранении", "error");
    }
  };

  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <form className={styles.addWorkSchedules} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editWorkSchedule")}</h2>
        <Button text={t("save")} type="submit" />
      </div>

      {/* Название и тип */}
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
          </select>
        </div>
      </div>

      {/* Норма часов и рабочая неделя */}
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

        {formData.type === "fixed" && (
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

      {/* Fixed: дни недели */}
      {formData.type === "fixed" && (
        <div className={styles.workDays}>
          {formData.work_days.map((day, index) => (
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
                <label>Перерыв (мин)</label>
                <input
                  type="number"
                  min={0}
                  value={day.break_minutes}
                  onChange={(e) =>
                    handleDayChange(index, "break_minutes", e.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shift: смены */}
      {formData.type === "shift" &&
        formData.shifts.map((shift, index) => (
          <div key={shift.shift_number} className={styles.row}>
            <div>
              <label>{`Начало ${shift.shift_number} смены`}</label>
              <input
                type="time"
                value={shift.start}
                onChange={(e) =>
                  handleShiftChange(index, "start", e.target.value)
                }
              />
            </div>
            <div>
              <label>{`Конец ${shift.shift_number} смены`}</label>
              <input
                type="time"
                value={shift.end}
                onChange={(e) =>
                  handleShiftChange(index, "end", e.target.value)
                }
              />
            </div>
            <div>
              <label>{`Перерыв ${shift.shift_number} (мин)`}</label>
              <input
                type="number"
                min={0}
                value={shift.break_minutes}
                onChange={(e) =>
                  handleShiftChange(index, "break_minutes", e.target.value)
                }
              />
            </div>
          </div>
        ))}

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

      <div className={styles.row}>
        <div>
          <label>Статус</label>
          <select
            name="status"
            value={formData.status.toString()}
            onChange={handleChange}
          >
            <option value="true">Включить</option>
            <option value="false">Выключить</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditWorkSchedule;
