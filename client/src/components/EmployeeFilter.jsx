import { useState, useRef, useEffect } from "react";
import EmployeeFilterForm from "./EmployeeFilterForm";

import styles from "./EmployeeFilterForm.module.scss";

const StatusIcon = ({ value }) => {
  if (value === "true")
    return (
      <svg viewBox="0 0 24 24" width="14" height="14">
        <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
        <path
          d="M7 12l3 3 7-7"
          stroke="currentColor"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (value === "false")
    return (
      <svg viewBox="0 0 24 24" width="14" height="14">
        <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
        <path
          d="M8 8l8 8M16 8l-8 8"
          stroke="currentColor"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="14" height="14">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
};

const GenderIcon = ({ value }) => {
  if (value === "male")
    return (
      <svg viewBox="0 0 24 24" width="14" height="14">
        <circle
          cx="10"
          cy="14"
          r="5"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <line
          x1="14"
          y1="6"
          x2="20"
          y2="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="20"
          y1="6"
          x2="20"
          y2="12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="14.5"
          y1="6.5"
          x2="20"
          y2="12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  if (value === "female")
    return (
      <svg viewBox="0 0 24 24" width="14" height="14">
        <circle
          cx="12"
          cy="9"
          r="5"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <line
          x1="12"
          y1="14"
          x2="12"
          y2="20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="9"
          y1="17"
          x2="15"
          y2="17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="14" height="14">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
};

const statusOptions = [
  { value: "", label: "Все", color: "#6b7280" },
  { value: "true", label: "Работает", color: "#16a34a" },
  { value: "false", label: "Уволен", color: "#dc2626" },
];

const genderOptions = [
  { value: "", label: "Все", color: "#6b7280" },
  { value: "male", label: "Мужчина", color: "#2563eb" },
  { value: "female", label: "Женщина", color: "#db2777" },
];

const SegmentedGroup = ({ label, options, value, onChange, isStatus }) => {
  const activeIdx = options.findIndex((o) => o.value === value);

  return (
    <div className={styles.segmentedGroup}>
      <span className={styles.segmentedLabel}>{label}</span>
      <div className={styles.segmentedTrack}>
        <div
          className={styles.segmentedSlider}
          style={{
            width: `calc(${100 / options.length}% - 4px)`,
            left: `calc(${activeIdx * (100 / options.length)}% + 2px)`,
          }}
        />
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.segmentedBtn} ${value === opt.value ? styles.segmentedBtnActive : ""}`}
            style={{ color: value === opt.value ? opt.color : undefined }}
            onClick={() => onChange(opt.value)}
          >
            <span
              style={{
                color: opt.color,
                display: "flex",
                alignItems: "center",
              }}
            >
              {isStatus ? (
                <StatusIcon value={opt.value} />
              ) : (
                <GenderIcon value={opt.value} />
              )}
            </span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const EmployeeFilter = ({ formData, viewMode, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);

  const initialFormData = {
    branch_id: "",
    department_id: "",
    employee_id: "",
    position_id: "",
    gender: "",
    status: "",
  };

  const activeCount = Object.entries(formData).filter(
    ([key, value]) => key !== "search" && value !== "",
  ).length;

  const wrapperRef = useRef(null);

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
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <EmployeeFilterForm
              filters={["branch", "department", "employee", "position"]}
              formData={formData}
              setFormData={setFormData}
            />

            <SegmentedGroup
              label="Пол"
              options={genderOptions}
              value={formData.gender}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, gender: val }))
              }
            />

            <SegmentedGroup
              label="Статус"
              options={statusOptions}
              value={formData.status}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, status: val }))
              }
              isStatus
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

export default EmployeeFilter;
