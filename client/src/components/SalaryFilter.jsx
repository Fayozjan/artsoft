import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import EmployeeFilterForm from "./EmployeeFilterForm";
import styles from "./SalaryFilter.module.scss";

const SALARY_TYPES = [
  { value: "", labelKey: "all" },
  { value: "monthly", labelKey: "salaryTypeMonthly" },
  { value: "hourly", labelKey: "salaryTypeHourly" },
  { value: "piecework", labelKey: "salaryTypePiecework" },
];

const STATUS_OPTIONS = [
  { value: "", labelKey: "all", color: "#6b7280" },
  { value: "true", labelKey: "active", color: "#16a34a" },
  { value: "false", labelKey: "terminated", color: "#dc2626" },
];

const NO_SALARY_OPTIONS = [
  { value: "", labelKey: "all", color: "#6b7280" },
  { value: "false", labelKey: "salarySet", color: "#16a34a" },
  { value: "true", labelKey: "notSet", color: "#dc2626" },
];

const SegmentedGroup = ({ label, options, value, onChange }) => {
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
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const SalaryFilter = ({ formData, setFormData, onSubmit }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const initialFormData = {
    branch_id: "",
    department_id: "",
    position_id: "",
    status: "",
    salary_type: "",
    amount_from: "",
    amount_to: "",
    no_salary: "",
  };

  const activeCount = Object.entries(formData).filter(([key, value]) => {
    if (key === "search" || key === "sort_by" || key === "sort_order")
      return false;
    return value !== "" && value !== false;
  }).length;

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
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen]);

  const handleReset = () => {
    setFormData((prev) => ({ ...prev, ...initialFormData }));
  };

  const salaryTypeOptions = SALARY_TYPES.map((s) => ({
    ...s,
    label: s.labelKey ? t(s.labelKey) : s.label,
    color: s.value === "" ? "#6b7280" : "#059669",
  }));

  const statusOptions = STATUS_OPTIONS.map((o) => ({
    ...o,
    label: t(o.labelKey),
  }));

  const noSalaryOptions = NO_SALARY_OPTIONS.map((o) => ({
    ...o,
    label: o.labelKey ? t(o.labelKey) : o.label,
  }));

  return (
    <div ref={wrapperRef} className={styles.filterToggle}>
      <div
        className={`${styles.toggleBtn} ${activeCount ? styles.active : ""}`}
        onClick={() => setIsOpen((v) => !v)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 32 32"
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M2 5s4-2 14-2s14 2 14 2L19 18v9l-6 3V18L2 5Z"
          />
        </svg>
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(e);
              setIsOpen(false);
            }}
          >
            <EmployeeFilterForm
              filters={["branch", "department", "position"]}
              formData={formData}
              setFormData={setFormData}
              labelClassName={styles.label}
            />

            <SegmentedGroup
              label={t("status")}
              options={statusOptions}
              value={formData.status}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, status: val }))
              }
            />

            <SegmentedGroup
              label={t("salaryType")}
              options={salaryTypeOptions}
              value={formData.salary_type}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, salary_type: val }))
              }
            />

            <div className={styles.rangeGroup}>
              <span className={styles.segmentedLabel}>{t("salaryRange")}</span>
              <div className={styles.rangeInputs}>
                <input
                  type="number"
                  min="0"
                  placeholder={t("from")}
                  value={formData.amount_from}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      amount_from: e.target.value,
                    }))
                  }
                />
                <span className={styles.rangeSep}>—</span>
                <input
                  type="number"
                  min="0"
                  placeholder={t("to")}
                  value={formData.amount_to}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      amount_to: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <SegmentedGroup
              label={t("noSalarySet")}
              options={noSalaryOptions}
              value={formData.no_salary}
              onChange={(val) =>
                setFormData((prev) => ({
                  ...prev,
                  no_salary: val,
                  salary_type: val === "true" ? "" : prev.salary_type,
                  amount_from: val === "true" ? "" : prev.amount_from,
                  amount_to: val === "true" ? "" : prev.amount_to,
                }))
              }
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

export default SalaryFilter;
