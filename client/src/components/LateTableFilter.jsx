import { useState, useRef, useEffect } from "react";
import EmployeeFilterForm from "./EmployeeFilterForm";

import styles from "./LateTableFilter.module.scss";

const LateTableFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);

  const wrapperRef = useRef(null);

  const initialFormData = {
    mode: "day",
    date: new Date().toISOString().slice(0, 10),
    branch_id: null,
    department_id: null,
    employee_id: null,
    position_id: null,
    include_lunch_late: false,
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const activeCount = Object.entries(formData).filter(
    ([key, value]) =>
      key !== "search" && key !== "include_lunch_late" && value !== "",
  ).length;

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleReset = () => {
    setFormData(initialFormData);
  };

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
        className={`${styles.toggleBtn} ${activeCount ? styles.active : ""}`}
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
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M2 5s4-2 14-2s14 2 14 2L19 18v9l-6 3V18L2 5Z"
          />
        </svg>

        <span>Фильтры</span>

        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <div>
              <h2>Период</h2>
              <div className={styles.modeSwitcher}>
                <div
                  className={styles.slider}
                  style={{
                    transform:
                      formData.mode === "day"
                        ? "translateX(0%)"
                        : "translateX(100%)",
                  }}
                />
                <button
                  type="button"
                  className={formData.mode === "day" ? styles.active : ""}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, mode: "day" }))
                  }
                >
                  За день
                </button>

                <button
                  type="button"
                  className={formData.mode === "month" ? styles.active : ""}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, mode: "month" }))
                  }
                >
                  За месяц
                </button>
              </div>
            </div>

            <div className={styles.period}>
              {formData.mode === "day" ? (
                <div className={styles.date}>
                  <h2>Дата</h2>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    onFocus={(e) => e.target.showPicker?.()}
                  />
                </div>
              ) : (
                <div className={styles.date}>
                  <h2>Месяц</h2>
                  <input
                    type="month"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    onFocus={(e) => e.target.showPicker?.()}
                  />
                </div>
              )}
            </div>

            <EmployeeFilterForm
              filters={["branch", "department", "position"]}
              formData={formData}
              setFormData={setFormData}
            />

            <div className={styles.checkboxRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={!!formData.include_lunch_late}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      include_lunch_late: e.target.checked,
                    }))
                  }
                />
                Учитывать опоздания после обеда
              </label>
            </div>

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

export default LateTableFilter;
