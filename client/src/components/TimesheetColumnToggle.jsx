import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../icons/icons";
import styles from "./TimesheetColumnToggle.module.scss";

const COLUMNS = [
  { key: "position", labelKey: "position" },
  { key: "pinfl", labelKey: "pinfl" },
  { key: "workSchedule", labelKey: "workSchedule" },
  { key: "lateHours", labelKey: "lateHours" },
  { key: "overtimeHours", labelKey: "overtimeHours" },
  { key: "paidTimeOff", labelKey: "paidTimeOff" },
];

const TimesheetColumnToggle = ({ visibleColumns, onChange }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const hiddenCount = Object.values(visibleColumns).filter((v) => !v).length;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (key) => {
    onChange({ ...visibleColumns, [key]: !visibleColumns[key] });
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={`${styles.toggleBtn} ${open ? styles.active : ""}`}
        onClick={() => setOpen((p) => !p)}
        type="button"
      >
        {Icons.columns}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownTitle}>{t("columns")}</div>
          {COLUMNS.map(({ key, labelKey }) => (
            <label key={key} className={styles.item}>
              <input
                type="checkbox"
                checked={visibleColumns[key]}
                onChange={() => toggle(key)}
              />
              <span>{t(labelKey)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimesheetColumnToggle;
