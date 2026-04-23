import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import EmployeeFilterForm from "./EmployeeFilterForm";
import styles from "./PayrollFilter.module.scss";

const SALARY_TYPES = [
  { value: "", label: "Все" },
  { value: "monthly", labelKey: "salaryTypeMonthly" },
  { value: "hourly", labelKey: "salaryTypeHourly" },
  { value: "piecework", labelKey: "salaryTypePiecework" },
];

const ITEM_STATUS_OPTIONS = [
  { value: "", labelKey: "filterAll", color: "#6b7280" },
  { value: "approved", labelKey: "approved", color: "#16a34a" },
  { value: "draft", labelKey: "notApproved", color: "#dc2626" },
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

const RESET = {
  branch_id: "",
  department_id: "",
  position_id: "",
  salary_type: "",
  item_status: "",
};

const PayrollFilter = ({
  formData,
  setFormData,
  onSubmit,
  statusOptions,
  hideSalaryType = false,
  hideStatus = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const activeCount = [
    "branch_id",
    "department_id",
    "position_id",
    "salary_type",
    "item_status",
  ].filter((k) => formData[k] !== "" && formData[k] != null).length;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setIsOpen(false);
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

  const handleReset = () => setFormData((prev) => ({ ...prev, ...RESET }));

  const salaryTypeOptions = SALARY_TYPES.map((s) => ({
    ...s,
    label: s.labelKey ? t(s.labelKey) : s.label,
    color: s.value === "" ? "#6b7280" : "#059669",
  }));

  const itemStatusOptions = (statusOptions || ITEM_STATUS_OPTIONS).map((o) => ({
    ...o,
    label: t(o.labelKey),
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

            {!hideSalaryType && (
              <SegmentedGroup
                label={t("salaryType")}
                options={salaryTypeOptions}
                value={formData.salary_type}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, salary_type: val }))
                }
              />
            )}

            {!hideStatus && (
              <SegmentedGroup
                label={t("status")}
                options={itemStatusOptions}
                value={formData.item_status}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, item_status: val }))
                }
              />
            )}

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

export default PayrollFilter;
