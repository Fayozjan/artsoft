import { useState, useRef, useEffect } from "react";
import EmployeeFilterForm from "./EmployeeFilterForm";
import CenterModal from "./CenterModal";
import { Icons } from "../icons/icons";
import styles from "./AttendanceTableFilter.module.scss";

// Порядок кнопок переключателя режима — по нему двигается подложка слайдера
const MODES = ["day", "period"];

const AttendanceTableFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const wrapperRef = useRef(null);

  const initialFormData = {
    mode: "day",
    date: new Date().toISOString().slice(0, 10),
    date_from: "",
    date_to: "",
    branch_id: null,
    department_id: null,
    employee_id: null,
    position_id: null,
  };

  const mode = formData.mode || "day";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const activeCount = Object.entries(formData).filter(
    ([key, value]) =>
      key !== "search" &&
      key !== "mode" &&
      value != null &&
      value !== "" &&
      // в режиме «за день» даты периода не учитываем и наоборот
      !(mode === "day" && (key === "date_from" || key === "date_to")) &&
      !(mode === "period" && key === "date"),
  ).length;

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = () => {
    setFormData(initialFormData);
    setShowResetConfirm(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (e.target.closest("[data-center-modal-overlay]")) return;
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
        {Icons.filter}

        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <div>
              <h2>{t("period")}</h2>
              <div className={styles.modeSwitcher}>
                <div
                  className={styles.slider}
                  style={{
                    transform: `translateX(${
                      MODES.findIndex((m) => m === mode) * 100
                    }%)`,
                  }}
                />
                <button
                  type="button"
                  className={mode === "day" ? styles.active : ""}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, mode: "day" }))
                  }
                >
                  {t("perDay")}
                </button>
                <button
                  type="button"
                  className={mode === "period" ? styles.active : ""}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      mode: "period",
                      date_from: prev.date_from || prev.date,
                      date_to: prev.date_to || prev.date,
                    }))
                  }
                >
                  {t("perPeriod")}
                </button>
              </div>
            </div>

            <div className={styles.period}>
              {mode === "day" ? (
                <div className={styles.date}>
                  <h2>{t("date")}</h2>
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
                <>
                  <div className={styles.date}>
                    <h2>{t("dateFrom")}</h2>
                    <input
                      type="date"
                      name="date_from"
                      value={formData.date_from || ""}
                      max={formData.date_to || undefined}
                      onChange={handleChange}
                      required
                      onFocus={(e) => e.target.showPicker?.()}
                    />
                  </div>
                  <div className={styles.date}>
                    <h2>{t("dateTo")}</h2>
                    <input
                      type="date"
                      name="date_to"
                      value={formData.date_to || ""}
                      min={formData.date_from || undefined}
                      onChange={handleChange}
                      required
                      onFocus={(e) => e.target.showPicker?.()}
                    />
                  </div>
                </>
              )}
            </div>

            <EmployeeFilterForm
              filters={["branch", "department"]}
              formData={formData}
              setFormData={setFormData}
            />

            <div className={styles.actions}>
              <button type="button" onClick={handleResetClick}>
                {t("clearAll")}
              </button>
              <button type="submit">{t("apply")}</button>
            </div>
          </form>
        </div>
      )}

      <CenterModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onAccept={handleResetConfirm}
        title={t("areYouSureDelete")}
      />
    </div>
  );
};

export default AttendanceTableFilter;
