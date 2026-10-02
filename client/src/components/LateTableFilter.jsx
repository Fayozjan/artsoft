import { useState, useRef, useEffect } from "react";
import EmployeeFilterForm from "./EmployeeFilterForm";
import CenterModal from "./CenterModal";
import { Icons } from "../icons/icons";
import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";
import {
  getLateEmployeesFilterPresets,
  createLateEmployeesFilterPreset,
  updateLateEmployeesFilterPreset,
  deleteLateEmployeesFilterPreset,
} from "../api";

import styles from "./LateTableFilter.module.scss";

// Поля, которые сохраняются в пресете фильтра (режим и дата не сохраняются)
const PRESET_FIELDS = ["branch_ids", "department_ids", "position_ids", "employee_ids", "include_lunch_late"];

// Порядок кнопок переключателя режима — по нему двигается подложка слайдера
const MODES = ["day", "month", "period"];

const LateTableFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);

  const wrapperRef = useRef(null);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const showAlert = useAlertStore((s) => s.showAlert);

  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState(null);
  const [presetToDelete, setPresetToDelete] = useState(null);

  useEffect(() => {
    getLateEmployeesFilterPresets()
      .then(setPresets)
      .catch((err) => console.error("Ошибка загрузки фильтров:", err));
  }, []);

  const initialFormData = {
    mode: "day",
    date: new Date().toISOString().slice(0, 10),
    date_from: "",
    date_to: "",
    branch_ids: [],
    department_ids: [],
    employee_ids: [],
    position_ids: [],
    include_lunch_late: false,
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const activeCount = Object.entries(formData).filter(
    ([key, value]) =>
      key !== "search" &&
      key !== "include_lunch_late" &&
      value != null &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0),
  ).length;

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleReset = () => {
    setFormData(initialFormData);
    setActivePresetId(null);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const filter = Object.fromEntries(
      PRESET_FIELDS.map((key) => [key, formData[key] ?? ""]),
    );
    createLateEmployeesFilterPreset({ name: presetName.trim(), filter })
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
    updateLateEmployeesFilterPreset(preset.id, { name: preset.name, filter })
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
    setFormData((prev) => ({ ...prev, ...preset.filter }));
    setActivePresetId(preset.id);
  };

  const handleDeletePresetConfirm = () => {
    const id = presetToDelete;
    setPresetToDelete(null);
    if (activePresetId === id) setActivePresetId(null);
    deleteLateEmployeesFilterPreset(id)
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

            <div>
              <h2>{t("period")}</h2>
              <div className={styles.modeSwitcher}>
                <div
                  className={styles.slider}
                  style={{
                    transform: `translateX(${
                      MODES.findIndex((m) => m === formData.mode) * 100
                    }%)`,
                  }}
                />
                <button
                  type="button"
                  className={formData.mode === "day" ? styles.active : ""}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, mode: "day" }))
                  }
                >
                  {t("perDay")}
                </button>

                <button
                  type="button"
                  className={formData.mode === "month" ? styles.active : ""}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, mode: "month" }))
                  }
                >
                  {t("perMonth")}
                </button>

                <button
                  type="button"
                  className={formData.mode === "period" ? styles.active : ""}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, mode: "period" }))
                  }
                >
                  {t("perPeriod")}
                </button>
              </div>
            </div>

            <div className={styles.period}>
              {formData.mode === "day" && (
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
              )}

              {formData.mode === "month" && (
                <div className={styles.date}>
                  <h2>{t("month")}</h2>
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

              {formData.mode === "period" && (
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
              filters={["branch", "department", "position", "employee"]}
              formData={formData}
              setFormData={setFormData}
              multiple
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
                {t("includeLunchLate")}
              </label>
            </div>

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
              <button type="button" onClick={handleReset}>
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

export default LateTableFilter;
