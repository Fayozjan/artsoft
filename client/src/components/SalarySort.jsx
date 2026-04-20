import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import styles from "./SalarySort.module.scss";

const SORT_FIELDS = [
  { value: "last_name", labelKey: "fullName" },
  { value: "employee_number", labelKey: "employeeNumber" },
  { value: "amount", labelKey: "amount" },
  { value: "branch", labelKey: "branch" },
  { value: "department", labelKey: "department" },
  { value: "position", labelKey: "position" },
  { value: "status", labelKey: "status" },
];

const DEFAULT = { sort_by: "last_name", sort_order: "asc" };

const SalarySort = ({ sort_by = "last_name", sort_order = "asc", onApply }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [local, setLocal] = useState({ sort_by, sort_order });
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (isOpen) setLocal({ sort_by, sort_order });
  }, [isOpen, sort_by, sort_order]);

  useEffect(() => {
    if (!isOpen) return;
    const onOut = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setIsOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onOut);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("pointerdown", onOut);
      document.removeEventListener("keydown", onEsc);
    };
  }, [isOpen]);

  const handleFieldClick = (field) => {
    setLocal((prev) => {
      if (prev.sort_by === field) {
        return {
          ...prev,
          sort_order: prev.sort_order === "asc" ? "desc" : "asc",
        };
      }
      return { sort_by: field, sort_order: "asc" };
    });
  };

  const handleApply = () => {
    onApply(local.sort_by, local.sort_order);
    setIsOpen(false);
  };

  const handleReset = () => {
    onApply(DEFAULT.sort_by, DEFAULT.sort_order);
    setIsOpen(false);
  };

  const isActive =
    sort_by !== DEFAULT.sort_by || sort_order !== DEFAULT.sort_order;

  return (
    <div ref={wrapperRef} className={styles.sortToggle}>
      <div
        className={`${styles.toggleBtn} ${isActive ? styles.active : ""}`}
        onClick={() => setIsOpen((v) => !v)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18M7 12h10M11 18h2" />
        </svg>
        <span>Сортировка</span>
        {isActive && <span className={styles.badge}>•</span>}
      </div>

      {isOpen && (
        <div className={styles.sortContent}>
          <div className={styles.fieldList}>
            {SORT_FIELDS.map((f) => {
              const isSelected = local.sort_by === f.value;
              return (
                <div
                  key={f.value}
                  className={`${styles.sortOption} ${isSelected ? styles.sortOptionActive : ""}`}
                  onClick={() => handleFieldClick(f.value)}
                >
                  <span>{t(f.labelKey)}</span>
                  {isSelected && (
                    <span className={styles.arrow}>
                      {local.sort_order === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={handleReset}
            >
              {t("clearAll")}
            </button>
            <button
              type="button"
              className={styles.applyBtn}
              onClick={handleApply}
            >
              {t("apply")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySort;
