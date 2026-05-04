import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./TimesheetColumnToggle.module.scss";

const COLUMNS = [
  { key: "position", labelKey: "position" },
  { key: "pinfl", labelKey: "pinfl" },
  { key: "workSchedule", labelKey: "workSchedule" },
  { key: "lateHours", labelKey: "lateHours" },
  { key: "overtimeHours", labelKey: "overtimeHours" },
  { key: "paidTimeOff", labelKey: "paidTimeOff" },
];

const ColumnsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="20px"
    viewBox="0 -960 960 960"
    width="20px"
    fill="#000000"
  >
    <path d="M160-760v560h262.31v-560H160Zm-40 600v-640h640v124.62h-40V-760H462.31v560H720v-84.62h40V-160H120Zm342.31-320Zm-40 0h40-40Zm0 0ZM720-380v-80h-80v-40h80v-80h40v80h80v40h-80v80h-40Z" />
  </svg>
);

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
        <ColumnsIcon />
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
