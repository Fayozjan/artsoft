import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import TgSheet from "./tg/TgSheet";
import { buildPresets, daysInRange, todayISO } from "../utils/attendanceTelegram";

import ui from "./tg/TgUi.module.scss";
import styles from "./AttendanceDateSheetTelegram.module.scss";

// Шторка выбора периода: быстрые пресеты применяются сразу,
// свой диапазон — двумя датами и кнопкой «Применить».
const AttendanceDateSheetTelegram = ({ isOpen, onClose, range, onApply }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(range);

  useEffect(() => {
    if (isOpen) setDraft(range);
  }, [isOpen, range]);

  const presets = useMemo(() => buildPresets(todayISO()), [isOpen]);

  const isSameRange = (a, b) => a.from === b.from && a.to === b.to;

  // Дата окончания не может быть раньше даты начала — подтягиваем вторую границу
  const handleChange = (field) => (e) => {
    const value = e.target.value;
    if (!value) return;

    setDraft((prev) =>
      field === "from"
        ? { from: value, to: prev.to < value ? value : prev.to }
        : { from: prev.from > value ? value : prev.from, to: value },
    );
  };

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("attendanceTg.pickPeriod")}
      subtitle={t("attendanceTg.daysCount", { count: daysInRange(draft) })}
      footer={
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={() => onApply(draft)}
        >
          {t("apply")}
        </button>
      }
    >
      <div className={styles.presets}>
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`${styles.preset} ${isSameRange(preset.range, draft) ? styles.presetActive : ""}`}
            onClick={() => onApply(preset.range)}
          >
            {t(`attendanceTg.${preset.key}`)}
          </button>
        ))}
      </div>

      <div className={`${ui.form} ${styles.dates}`}>
        <div className={ui.field}>
          <label className={ui.label}>{t("dateFrom")}</label>
          <input
            className={ui.input}
            type="date"
            value={draft.from}
            max={draft.to}
            onChange={handleChange("from")}
          />
        </div>

        <div className={ui.field}>
          <label className={ui.label}>{t("dateTo")}</label>
          <input
            className={ui.input}
            type="date"
            value={draft.to}
            min={draft.from}
            onChange={handleChange("to")}
          />
        </div>
      </div>
    </TgSheet>
  );
};

export default AttendanceDateSheetTelegram;
