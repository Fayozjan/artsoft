import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import TgSheet from "./tg/TgSheet";
import { IconChevronLeft, IconChevronRight } from "./tg/tgIcons";
import { getCurrentMonthISO } from "../utils/timesheetTelegram";

import styles from "./TimesheetMonthSheetTelegram.module.scss";

// Шторка выбора месяца: переключатель года и сетка из 12 месяцев.
// Тап по месяцу сразу применяет выбор и закрывает шторку.
const TimesheetMonthSheetTelegram = ({ isOpen, onClose, month, onApply }) => {
  const { t } = useTranslation();
  const currentMonth = getCurrentMonthISO();
  const [year, setYear] = useState(() => Number(month.split("-")[0]));

  useEffect(() => {
    if (isOpen) setYear(Number(month.split("-")[0]));
  }, [isOpen, month]);

  const [selectedYear, selectedMonth] = month.split("-").map(Number);

  return (
    <TgSheet isOpen={isOpen} onClose={onClose} title={t("timesheetTg.pickMonth")}>
      <div className={styles.yearRow}>
        <button
          type="button"
          className={styles.yearBtn}
          onClick={() => setYear((y) => y - 1)}
          aria-label={t("timesheetTg.prevYear")}
        >
          <IconChevronLeft />
        </button>
        <span className={styles.year}>{year}</span>
        <button
          type="button"
          className={styles.yearBtn}
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= Number(currentMonth.split("-")[0])}
          aria-label={t("timesheetTg.nextYear")}
        >
          <IconChevronRight />
        </button>
      </div>

      <div className={styles.grid}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const value = `${year}-${String(m).padStart(2, "0")}`;
          const isFuture = value > currentMonth;
          const isActive = year === selectedYear && m === selectedMonth;

          return (
            <button
              key={m}
              type="button"
              className={`${styles.monthBtn} ${isActive ? styles.monthBtnActive : ""}`}
              disabled={isFuture}
              onClick={() => onApply(value)}
            >
              {t(`months.${m}`)}
            </button>
          );
        })}
      </div>
    </TgSheet>
  );
};

export default TimesheetMonthSheetTelegram;
