import { useState, useRef, useEffect, useCallback } from "react";
import EmployeeFilterForm from "./EmployeeFilterForm";
import styles from "./TimesheetFilter.module.scss";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const CheckIcon = () => (
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

const CrossIcon = () => (
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

const DotIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
    <circle cx="12" cy="12" r="4" fill="currentColor" />
  </svg>
);

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
            <span
              style={{
                color: opt.color,
                display: "flex",
                alignItems: "center",
              }}
            >
              {opt.icon}
            </span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const INITIAL_FORM = {
  month: getCurrentMonth(),
  branch_id: null,
  department_id: null,
  position_id: null,
  status: "",
  hasEvents: "",
};

const TimesheetFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const statusOptions = [
    { value: "", label: t("all"), color: "#6b7280", icon: <DotIcon /> },
    {
      value: "true",
      label: t("active"),
      color: "#16a34a",
      icon: <CheckIcon />,
    },
    {
      value: "false",
      label: t("terminated"),
      color: "#dc2626",
      icon: <CrossIcon />,
    },
  ];

  const eventsOptions = [
    { value: "", label: t("all"), color: "#6b7280", icon: <DotIcon /> },
    { value: "yes", label: t("hasEventsYes"), color: "#16a34a", icon: <CheckIcon /> },
    { value: "no", label: t("hasEventsNo"), color: "#dc2626", icon: <CrossIcon /> },
  ];

  const activeCount = Object.entries(formData).filter(
    ([key, value]) =>
      key !== "search" &&
      value != null &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0),
  ).length;

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setIsOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const onScroll = () => setIsOpen(false);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEsc);
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("scroll", onScroll);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className={styles.filterToggle}>
      <div
        className={`${styles.toggleBtn} ${activeCount ? styles.active : ""}`}
        onClick={() => setIsOpen((p) => !p)}
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
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <div>
              <h2>{t("month")}</h2>
              <input
                className={styles.month}
                type="month"
                name="month"
                value={formData.month}
                onChange={handleChange}
                onFocus={(e) => e.target.showPicker?.()}
              />
            </div>

            <EmployeeFilterForm
              filters={["branch", "department", "position"]}
              formData={formData}
              setFormData={setFormData}
            />

            <SegmentedGroup
              label={t("status")}
              options={statusOptions}
              value={formData.status ?? ""}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, status: val }))
              }
            />

            <SegmentedGroup
              label={t("eventsLabel")}
              options={eventsOptions}
              value={formData.hasEvents ?? ""}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, hasEvents: val }))
              }
            />

            <div className={styles.actions}>
              <button type="button" onClick={() => setFormData(INITIAL_FORM)}>
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

export default TimesheetFilter;
