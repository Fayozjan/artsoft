import { useState, useRef, useEffect, useCallback } from "react";
import EmployeeFilterForm from "./EmployeeFilterForm";
import CenterModal from "./CenterModal";
import { Icons } from "../icons/icons";
import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";
import {
  getTimesheetFilterPresets,
  createTimesheetFilterPreset,
  updateTimesheetFilterPreset,
  deleteTimesheetFilterPreset,
} from "../api";
import { getCurrentIsoWeek, getIsoWeekMonth } from "../utils/date";
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
  viewMode: "month",
  month: getCurrentMonth(),
  week: getCurrentIsoWeek(),
  branch_ids: [],
  department_ids: [],
  position_ids: [],
  employee_ids: [],
  status: "",
  hasEvents: "",
};

// Поля, которые сохраняются в пресете фильтра (месяц не сохраняется)
const PRESET_FIELDS = [
  "branch_ids",
  "department_ids",
  "position_ids",
  "employee_ids",
  "status",
  "hasEvents",
];

const TimesheetFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const showAlert = useAlertStore((s) => s.showAlert);

  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState(null);
  const [presetToDelete, setPresetToDelete] = useState(null);

  useEffect(() => {
    getTimesheetFilterPresets()
      .then(setPresets)
      .catch((err) => console.error("Ошибка загрузки фильтров:", err));
  }, []);

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const filter = Object.fromEntries(
      PRESET_FIELDS.map((key) => [key, formData[key] ?? ""]),
    );
    createTimesheetFilterPreset({ name: presetName.trim(), filter })
      .then((preset) => {
        setPresets((prev) => [...prev, preset]);
        setPresetName("");
      })
      .catch((err) => {
        console.error("Ошибка сохранения фильтра:", err);
        showAlert(err.response?.data?.error || t("error"), "error");
      });
  };

  const handleUpdatePreset = () => {
    const preset = presets.find((p) => p.id === activePresetId);
    if (!preset) return;
    const filter = Object.fromEntries(
      PRESET_FIELDS.map((key) => [key, formData[key] ?? ""]),
    );
    updateTimesheetFilterPreset(preset.id, { name: preset.name, filter })
      .then((updated) => {
        setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      })
      .catch((err) => {
        console.error("Ошибка обновления фильтра:", err);
        showAlert(err.response?.data?.error || t("error"), "error");
      });
  };

  const handleSelectPreset = (id) => {
    if (!id) {
      setActivePresetId(null);
      return;
    }
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setFormData((prev) => ({ ...prev, ...preset.filter, month: prev.month }));
    setActivePresetId(preset.id);
  };

  const handleDeletePresetConfirm = () => {
    const id = presetToDelete;
    setPresetToDelete(null);
    if (activePresetId === id) setActivePresetId(null);
    deleteTimesheetFilterPreset(id)
      .then(() => setPresets((prev) => prev.filter((p) => p.id !== id)))
      .catch((err) => {
        console.error("Ошибка удаления фильтра:", err);
        showAlert(err.response?.data?.error || t("error"), "error");
      });
  };

  const normalizeForCompare = (value) => {
    if (Array.isArray(value)) {
      return [...value].map((v) => Number(v)).sort((a, b) => a - b);
    }
    return value ?? "";
  };

  const activePreset = presets.find((p) => p.id === activePresetId);
  const isPresetDirty =
    activePreset &&
    PRESET_FIELDS.some(
      (key) =>
        JSON.stringify(normalizeForCompare(formData[key])) !==
        JSON.stringify(normalizeForCompare(activePreset.filter[key])),
    );

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
      key !== "viewMode" &&
      key !== "week" &&
      value != null &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0),
  ).length;

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleViewModeChange = (mode) => {
    setFormData((prev) => {
      if (mode === "week") {
        const week = prev.week || getCurrentIsoWeek();
        return { ...prev, viewMode: "week", week, month: getIsoWeekMonth(week) };
      }
      return { ...prev, viewMode: "month" };
    });
  };

  const handleWeekChange = (e) => {
    const week = e.target.value;
    if (!week) return;
    setFormData((prev) => ({ ...prev, week, month: getIsoWeekMonth(week) }));
  };

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
        {Icons.filter}
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            {presets.length > 0 && (
              <div className={styles.presetList}>
                <h2>{t("savedFilters")}</h2>
                <div className={styles.presetRow}>
                  <select
                    className={styles.presetSelect}
                    value={activePresetId ?? ""}
                    onChange={(e) =>
                      handleSelectPreset(Number(e.target.value) || null)
                    }
                  >
                    <option value="">{t("select")}</option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {activePreset?.created_by === currentUserId && (
                    <>
                      {isPresetDirty && (
                        <button
                          type="button"
                          className={styles.presetUpdate}
                          onClick={handleUpdatePreset}
                          title={t("updateFilter")}
                        >
                          {Icons.floppyDisk}
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.presetDelete}
                        onClick={() => setPresetToDelete(activePreset.id)}
                        title={t("delete")}
                      >
                        {Icons.trashOutline}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <SegmentedGroup
              label={t("period")}
              options={[
                { value: "month", label: t("month") },
                { value: "week", label: t("week") },
              ]}
              value={formData.viewMode || "month"}
              onChange={handleViewModeChange}
            />

            <div>
              <h2>{formData.viewMode === "week" ? t("week") : t("month")}</h2>
              {formData.viewMode === "week" ? (
                <input
                  className={styles.month}
                  type="week"
                  name="week"
                  value={formData.week || getCurrentIsoWeek()}
                  onChange={handleWeekChange}
                  onFocus={(e) => e.target.showPicker?.()}
                />
              ) : (
                <input
                  className={styles.month}
                  type="month"
                  name="month"
                  value={formData.month}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                />
              )}
            </div>

            <EmployeeFilterForm
              filters={["branch", "department", "position", "employee"]}
              formData={formData}
              setFormData={setFormData}
              multiple
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

            <div className={styles.saveRow}>
              <input
                className={styles.presetInput}
                placeholder={t("saveFilterAs")}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSavePreset();
                  }
                }}
              />
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                {t("save")}
              </button>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => {
                  setFormData(INITIAL_FORM);
                  setActivePresetId(null);
                }}
              >
                {t("clearAll")}
              </button>
              <button type="submit">{t("apply")}</button>
            </div>
          </form>
        </div>
      )}

      <CenterModal
        isOpen={presetToDelete !== null}
        onClose={() => setPresetToDelete(null)}
        onAccept={handleDeletePresetConfirm}
        tag={t("areYouSureDelete")}
      />
    </div>
  );
};

export default TimesheetFilter;
