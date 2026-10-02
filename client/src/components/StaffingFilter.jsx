import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import EmployeeFilterForm from "./EmployeeFilterForm";
import { Icons } from "../icons/icons";

import styles from "./EmployeeFilterForm.module.scss";

const StaffingFilter = ({ formData, setFormData, onSubmit }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const wrapperRef = useRef(null);

  const activeCount = [formData.branch_id, formData.department_id].filter(Boolean).length;

  const handleReset = () => setFormData({ branch_id: "", department_id: "" });

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    const handleEsc = (e) => { if (e.key === "Escape") setIsOpen(false); };
    const handleScroll = () => setIsOpen(false);
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
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {Icons.filter}
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
              setIsOpen(false);
            }}
          >
            <EmployeeFilterForm
              filters={["branch", "department"]}
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

export default StaffingFilter;
