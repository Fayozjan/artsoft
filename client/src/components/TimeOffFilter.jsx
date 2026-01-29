import { useState, useRef, useEffect, useCallback } from "react";

import EmployeeFilterForm from "./EmployeeFilterForm";

import styles from "./TimeOffFilter.module.scss";

const TimeOffFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);

  const initialFormData = {
    date_from: "",
    date_to: "",
    branch_id: null,
    department_id: null,
    position_id: null,
  };

  const activeCount = Object.entries(formData).filter(
    ([key, value]) =>
      key !== "search" &&
      value != null &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0)
  ).length;

  const wrapperRef = useRef(null);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleReset = () => {
    setFormData(initialFormData);
  };

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    document.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
      document.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className={styles.filterToggle}>
      <div
        className={`${styles.toggleBtn} + ${activeCount ? styles.active : ""}`}
        onClick={toggleOpen}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="200"
          height="200"
          viewBox="0 0 32 32"
        >
          <path
            fill="none"
            stroke="#000000"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M2 5s4-2 14-2s14 2 14 2L19 18v9l-6 3V18L2 5Z"
          />
        </svg>
        <span>Фильтры</span>
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <div className={styles.row}>
              <div>
                <h2>Дата от</h2>
                <input
                  className={styles.date}
                  id="date_from"
                  type="datetime-local"
                  name="date_from"
                  value={formData.date_from}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                />
              </div>
              <div>
                <h2>Дата до</h2>
                <input
                  className={styles.date}
                  id="date_to"
                  type="datetime-local"
                  name="date_to"
                  value={formData.date_to}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                />
              </div>
            </div>

            <EmployeeFilterForm
              filters={["branch", "department", "position"]}
              formData={formData}
              setFormData={setFormData}
            />

            <div className={styles.actions}>
              <button type="button" onClick={handleReset}>
                {t("clearAll")}
              </button>
              <button type="submit">{t("apply")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default TimeOffFilter;
