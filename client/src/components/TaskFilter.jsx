import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import EmployeeFilterForm from "./EmployeeFilterForm";
import { Icons } from "../icons/icons";

import styles from "./EmployeeFilterForm.module.scss";

const PRIORITY_COLORS = { "": "#6b7280", low: "#10b981", medium: "#f59e0b", high: "#ef4444" };

const SegmentedGroup = ({ label, options, value, onChange }) => {
  const current = value ?? "";
  const activeIdx = options.findIndex((o) => o.value === current);
  return (
    <div className={styles.segmentedGroup}>
      {label && <span className={styles.segmentedLabel}>{label}</span>}
      <div className={styles.segmentedTrack}>
        {activeIdx >= 0 && (
          <div
            className={styles.segmentedSlider}
            style={{
              width: `calc(${100 / options.length}% - 4px)`,
              left: `calc(${activeIdx * (100 / options.length)}% + 2px)`,
            }}
          />
        )}
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.segmentedBtn} ${current === opt.value ? styles.segmentedBtnActive : ""}`}
            style={{ color: current === opt.value ? opt.color : undefined }}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const TaskFilter = ({ formData, setFormData, onSubmit }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const priorityOptions = [
    { value: "", label: t("all"), color: PRIORITY_COLORS[""] },
    { value: "low", label: t("priority.low"), color: PRIORITY_COLORS.low },
    { value: "medium", label: t("priority.medium"), color: PRIORITY_COLORS.medium },
    { value: "high", label: t("priority.high"), color: PRIORITY_COLORS.high },
  ];

  const initialFormData = {
    status: "",
    priority: "",
    branch_id: "",
    department_id: "",
    position_id: "",
    overdue: false,
    my_tasks: false,
  };

  const activeCount = [
    formData.status,
    formData.priority,
    formData.branch_id,
    formData.department_id,
    formData.position_id,
    formData.overdue,
    formData.my_tasks,
  ].filter(Boolean).length;

  const handleReset = () => {
    setFormData((prev) => ({ ...prev, ...initialFormData }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsOpen(false);
    onSubmit();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
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
          <form onSubmit={handleSubmit}>
            <div>
              <span className={styles.label}>{t("task.status")}</span>
              <select
                value={formData.status || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">{t("allStatuses")}</option>
                <option value="draft">{t("status.draft")}</option>
                <option value="assigned">{t("status.assigned")}</option>
                <option value="in_progress">{t("status.in_progress")}</option>
                <option value="done">{t("status.done")}</option>
              </select>
            </div>

            <SegmentedGroup
              label={t("task.priority")}
              options={priorityOptions}
              value={formData.priority}
              onChange={(v) => setFormData((prev) => ({ ...prev, priority: v }))}
            />

            <EmployeeFilterForm
              filters={["branch", "department", "position"]}
              formData={formData}
              setFormData={setFormData}
            />

            <div className={styles.toggleChipsRow}>
              <button
                type="button"
                className={`${styles.toggleChip} ${formData.my_tasks ? styles.toggleChipActive : ""}`}
                onClick={() => setFormData((prev) => ({ ...prev, my_tasks: !prev.my_tasks }))}
              >
                {t("task.myTasks")}
              </button>
              <button
                type="button"
                className={`${styles.toggleChip} ${styles.toggleChipDanger} ${formData.overdue ? styles.toggleChipActive : ""}`}
                onClick={() => setFormData((prev) => ({ ...prev, overdue: !prev.overdue }))}
              >
                {t("task.overdue")}
              </button>
            </div>

            <div className={styles.actions}>
              <button type="button" onClick={handleReset}>{t("clearAll")}</button>
              <button type="submit">{t("apply")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default TaskFilter;
