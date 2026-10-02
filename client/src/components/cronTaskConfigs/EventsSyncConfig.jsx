import { useTranslation } from "react-i18next";

import styles from "./AttendanceReportConfig.module.scss";
import ownStyles from "./EventsSyncConfig.module.scss";

const MIN_WINDOW_MINUTES = 5;
const MAX_WINDOW_MINUTES = 60 * 24 * 60; // 60 дней — как на сервере

const PRESETS = [
  { minutes: 60, labelKey: "windowPreset1h" },
  { minutes: 720, labelKey: "windowPreset12h" },
  { minutes: 1440, labelKey: "windowPreset24h" },
  { minutes: 43200, labelKey: "windowPreset30d" },
];

// Конфиг-под-форма для task_type = "events_sync": за какой период назад
// забирать события с устройств при каждом запуске задачи.
const EventsSyncConfig = ({ config, onChange }) => {
  const { t } = useTranslation();
  const windowMinutes = config.window_minutes ?? 60;

  const setWindow = (minutes) => onChange({ ...config, window_minutes: minutes });

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <div>
          <label>{t("windowMinutes")}</label>
          <input
            type="number"
            min={MIN_WINDOW_MINUTES}
            max={MAX_WINDOW_MINUTES}
            value={windowMinutes}
            onChange={(e) => setWindow(Number(e.target.value))}
            required
          />

          <div className={ownStyles.presets}>
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p.minutes}
                className={`${ownStyles.presetBtn} ${windowMinutes === p.minutes ? ownStyles.presetBtnActive : ""}`}
                onClick={() => setWindow(p.minutes)}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>

          <div className={ownStyles.hint}>{t("windowMinutesHint")}</div>
        </div>
      </div>
    </div>
  );
};

export default EventsSyncConfig;
