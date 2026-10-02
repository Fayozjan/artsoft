import { useTranslation } from "react-i18next";

import styles from "./AddCronTask.module.scss";

const DAYS = [
  { value: 1, labelKey: "dayMon" },
  { value: 2, labelKey: "dayTue" },
  { value: 3, labelKey: "dayWed" },
  { value: 4, labelKey: "dayThu" },
  { value: 5, labelKey: "dayFri" },
  { value: 6, labelKey: "daySat" },
  { value: 7, labelKey: "daySun" },
];

const INTERVAL_PRESETS = [
  { minutes: 30, labelKey: "intervalPreset30m" },
  { minutes: 180, labelKey: "intervalPreset3h" },
  { minutes: 1440, labelKey: "intervalPreset24h" },
  { minutes: 10080, labelKey: "intervalPreset7d" },
];

const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 60 * 24 * 30; // 30 дней — как на сервере

// Общий редактор расписания для AddCronTask / EditCronTask.
// daily    — время + дни недели
// interval — «каждые N минут», отсчёт от последнего запуска
const CronScheduleFields = ({ value, onChange }) => {
  const { t } = useTranslation();

  const kind = value.schedule_kind || "daily";
  const days = value.days_of_week || [];
  const intervalMinutes = value.interval_minutes ?? 30;

  const timeValue = `${String(value.hour ?? 9).padStart(2, "0")}:${String(value.minute ?? 0).padStart(2, "0")}`;

  const setKind = (schedule_kind) => {
    if (schedule_kind === kind) return;
    // Подставляем дефолты для полей, которых у задачи ещё нет — сервер требует
    // полный набор для выбранного вида расписания.
    onChange(
      schedule_kind === "interval"
        ? { ...value, schedule_kind, interval_minutes: intervalMinutes }
        : {
            ...value,
            schedule_kind,
            hour: value.hour ?? 9,
            minute: value.minute ?? 0,
            days_of_week: days.length ? days : [1, 2, 3, 4, 5],
          },
    );
  };

  const handleTimeChange = (e) => {
    const [hour, minute] = e.target.value.split(":").map(Number);
    onChange({ ...value, hour, minute });
  };

  const toggleDay = (day) => {
    onChange({
      ...value,
      days_of_week: days.includes(day)
        ? days.filter((d) => d !== day)
        : [...days, day].sort((a, b) => a - b),
    });
  };

  return (
    <>
      <div className={styles.row}>
        <div>
          <label>{t("scheduleKind")}</label>
          <div className={styles.daysRow}>
            <button
              type="button"
              className={`${styles.dayBtn} ${kind === "daily" ? styles.dayBtnActive : ""}`}
              onClick={() => setKind("daily")}
            >
              {t("scheduleDaily")}
            </button>
            <button
              type="button"
              className={`${styles.dayBtn} ${kind === "interval" ? styles.dayBtnActive : ""}`}
              onClick={() => setKind("interval")}
            >
              {t("scheduleInterval")}
            </button>
          </div>
        </div>
      </div>

      {kind === "daily" ? (
        <>
          <div className={styles.row}>
            <div>
              <label>{t("timeOfDay")}</label>
              <input type="time" value={timeValue} onChange={handleTimeChange} required />
            </div>
          </div>

          <div className={styles.row}>
            <div>
              <label>{t("daysOfWeek")}</label>
              <div className={styles.daysRow}>
                {DAYS.map((d) => (
                  <button
                    type="button"
                    key={d.value}
                    className={`${styles.dayBtn} ${days.includes(d.value) ? styles.dayBtnActive : ""}`}
                    onClick={() => toggleDay(d.value)}
                  >
                    {t(d.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.row}>
          <div>
            <label>{t("intervalMinutes")}</label>
            <input
              type="number"
              min={MIN_INTERVAL_MINUTES}
              max={MAX_INTERVAL_MINUTES}
              value={intervalMinutes}
              onChange={(e) => onChange({ ...value, interval_minutes: Number(e.target.value) })}
              required
            />
            <div className={styles.daysRow} style={{ marginTop: 6 }}>
              {INTERVAL_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.minutes}
                  className={`${styles.dayBtn} ${intervalMinutes === p.minutes ? styles.dayBtnActive : ""}`}
                  onClick={() => onChange({ ...value, interval_minutes: p.minutes })}
                >
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CronScheduleFields;
