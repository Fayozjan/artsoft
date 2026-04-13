import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import Loading from "./Loading";
import styles from "./EmployeeWorkSchedulesHistory.module.scss";
import { EmployeeService, workScheduleHistoryApi } from "../api";
import { t } from "i18next";

const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const formatWorkScheduleTime = (schedule) => {
  if (!schedule) return "—";

  switch (schedule.type) {
    case "fixed": {
      if (!schedule.work_days?.length) return "—";

      // Берём только заполненные дни
      const activeDays = schedule.work_days.filter((d) => d.start && d.end);

      if (!activeDays.length) return "—";

      // Группируем дни по времени
      const groups = {};

      activeDays.forEach((day) => {
        const key = `${day.start}-${day.end}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(day.day);
      });

      const result = Object.entries(groups).map(([time, days], i) => {
        const [start, end] = time.split("-");

        const sortedDays = days.sort((a, b) => a - b);

        // если дни идут подряд — показываем диапазоном
        const isSequential =
          sortedDays[sortedDays.length - 1] - sortedDays[0] + 1 ===
          sortedDays.length;

        const daysLabel = isSequential
          ? `${dayNames[sortedDays[0] - 1]}–${
              dayNames[sortedDays[sortedDays.length - 1] - 1]
            }`
          : sortedDays.map((d) => dayNames[d - 1]).join(", ");

        return (
          <span key={i}>
            {daysLabel}: {start} – {end}
          </span>
        );
      });

      return result;
    }

    case "shift": {
      const shifts = schedule.shifts
        ?.filter((s) => s.start && s.end)
        .map((s) => (
          <div key={s.shift_number}>
            {s.shift_number} смена: {s.start} – {s.end}
          </div>
        ));

      return shifts?.length ? shifts : "—";
    }

    case "flexible":
      return "Гибкий график";

    default:
      return "—";
  }
};

const EmployeeWorkSchedulesHistory = ({ employeeId, handleClose }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const res = await EmployeeService.getById(employeeId);
      if (res?.success) {
        // Сортируем историю по убыванию даты (новые сверху)
        const sorted = (res?.data?.employeeScheduleHistory || []).sort(
          (a, b) => new Date(b.date_from) - new Date(a.date_from),
        );
        setHistory(sorted);
      }
    } catch (e) {
      console.error("Ошибка загрузки истории графиков", e);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const confirmDelete = async (id) => {
    setLoading(true);
    try {
      const res = await workScheduleHistoryApi.deleteById(id);
      if (res?.success) {
        setHistory((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (e) {
      console.error("Ошибка удаления записи графика", e);
    } finally {
      setDeletingId(null);
      setLoading(false);
    }
  };

  console.log("history", history);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <svg
          onClick={handleClose}
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 304 384"
        >
          <path
            fill="currentColor"
            d="M299 73L179 192l120 119l-30 30l-120-119L30 341L0 311l119-119L0 73l30-30l119 119L269 43z"
          />
        </svg>
      </div>

      <div className={styles.timelineWrapper}>
        {!loading && history.length === 0 && (
          <div className={styles.empty}>История графиков пуста</div>
        )}

        {history.map((item, index) => (
          <div key={item.id} className={styles.timeline_item}>
            {/* Левая колонка: Дата */}
            <div className={styles.timeline_date}>
              <div className={styles.date_start}>
                {format(new Date(item.date_from), "dd MMM yyyy", {
                  locale: ru,
                })}
              </div>
              <div className={styles.date_sep}>↓</div>
              <div className={styles.date_end}>
                {item.date_to
                  ? format(new Date(item.date_to), "dd MMM yyyy", {
                      locale: ru,
                    })
                  : "по настоящее время"}
              </div>
            </div>

            {/* Центральная колонка: Линия и точка */}
            <div className={styles.timeline_path}>
              <div className={styles.dot} />
              {index !== history.length - 1 && <div className={styles.line} />}
            </div>

            {/* Правая колонка: Контент */}
            <div className={styles.timelineContent}>
              <div
                className={`${styles.card} ${deletingId === item.id ? styles.isDeleting : ""}`}
              >
                {deletingId === item.id ? (
                  <div className={styles.deleteConfirmOverlay}>
                    <p>Удалить запись?</p>
                    <div className={styles.deleteActions}>
                      <button
                        className={styles.confirmBtn}
                        onClick={() => confirmDelete(item.id)}
                      >
                        Да
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={() => setDeletingId(null)}
                      >
                        Нет
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.card_header}>
                      <h4 className={styles.title}>Рабочий график</h4>
                      <button
                        className={styles.deleteIconBtn}
                        onClick={() => setDeletingId(item.id)}
                        title="Удалить"
                      >
                        <svg width="14" height="16" viewBox="0 0 14 18">
                          <path
                            d="M1,16 C1,17.1 1.9,18 3,18 L11,18 C12.1,18 13,17.1 13,16 L13,4 L1,4 L1,16 L1,16 Z M14,1 L10.5,1 L9.5,0 L4.5,0 L3.5,1 L0,1 L0,3 L14,3 L14,1 L14,1 Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.card_body}>
                      <p>
                        <span>Название:</span> {item?.workSchedule?.name}
                      </p>
                      <p>
                        <span>Тип:</span>
                        {t(`scheduleType.${item?.workSchedule?.type}`)}
                      </p>
                      <p>
                        <span>Режим работы:</span>{" "}
                        {formatWorkScheduleTime(item?.workSchedule)}
                      </p>
                      <p>
                        <span>Назначен:</span>{" "}
                        {format(new Date(item.added_at), "dd.MM.yyyy HH:mm")}
                      </p>

                      <p className={styles.note}>
                        <span>Добавил:</span> {item.addedBy}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && <Loading />}
    </div>
  );
};

export default EmployeeWorkSchedulesHistory;
