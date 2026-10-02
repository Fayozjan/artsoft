import { useState, useRef, useEffect } from "react";
import { Icons } from "../icons/icons";

import SegmentedGroup, {
  statusSegments,
  complexitySegments,
  unitSegments,
} from "./SegmentedGroup";

import styles from "./OperationTypesFilter.module.scss";

const FILTER_KEYS = ["status", "complexity", "unit"];

const OperationTypesFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const activeCount = FILTER_KEYS.filter((key) => formData[key]).length;

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleReset = () => {
    setFormData((prev) => ({ ...prev, status: "", complexity: "", unit: "" }));
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
        onClick={toggleOpen}
      >
        {Icons.filter}
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <SegmentedGroup
              label={t("status")}
              options={statusSegments(t)}
              value={formData.status}
              onChange={(val) => setFormData((prev) => ({ ...prev, status: val }))}
            />

            <SegmentedGroup
              label={t("complexity")}
              options={complexitySegments(t)}
              value={formData.complexity}
              onChange={(val) => setFormData((prev) => ({ ...prev, complexity: val }))}
            />

            <SegmentedGroup
              label={t("unit")}
              options={unitSegments(t)}
              value={formData.unit}
              onChange={(val) => setFormData((prev) => ({ ...prev, unit: val }))}
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

export default OperationTypesFilter;
