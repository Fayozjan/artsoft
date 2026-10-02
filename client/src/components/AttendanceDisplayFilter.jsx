import { useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../icons/icons";
import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";
import {
  getAttendanceFilterPresets,
  createAttendanceFilterPreset,
  updateAttendanceFilterPreset,
  deleteAttendanceFilterPreset,
} from "../api";
import CenterModal from "./CenterModal";
import styles from "./AttendanceDisplayFilter.module.scss";

const emptyFilter = () => ({ branches: [], departments: [], employees: [], positions: [] });

function AccordionSection({ id, label, selectedCount, isOpen, onToggle, children }) {
  return (
    <div className={styles.accordionSection}>
      <button
        className={`${styles.accordionHeader} ${isOpen ? styles.accordionHeaderOpen : ""}`}
        onClick={() => onToggle(id)}
      >
        <span className={styles.accordionLabel}>{label}</span>
        {selectedCount > 0 && (
          <span className={styles.accordionBadge}>{selectedCount}</span>
        )}
        <span className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ""}`}>
          ▾
        </span>
      </button>
      {isOpen && <div className={styles.accordionContent}>{children}</div>}
    </div>
  );
}

const MAX_VISIBLE = 80;

function MultiSelect({ label, options, selected, onToggle }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );
  // рисуем не больше N строк за раз, остальное — через поиск
  const visible = filtered.slice(0, MAX_VISIBLE);
  const isTruncated = filtered.length > MAX_VISIBLE;
  return (
    <div className={styles.multiSelect}>
      {label && <div className={styles.multiSelectLabel}>{label}</div>}
      {options.length > 6 && (
        <input
          className={styles.multiSelectSearch}
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      <div className={styles.multiSelectList}>
        {visible.map((o) => (
          <label key={o.value} className={styles.checkItem}>
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={() => onToggle(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
        {isTruncated && (
          <div className={styles.multiSelectHint}>
            {t("clarifySearchQuery")}
          </div>
        )}
      </div>
    </div>
  );
}

const AttendanceDisplayFilter = ({ data, displayMode, filter, onApply }) => {
  const { t } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const showAlert = useAlertStore((s) => s.showAlert);
  const [presets, setPresets] = useState([]);

  const loadPresets = () => {
    getAttendanceFilterPresets()
      .then(setPresets)
      .catch((err) => console.error("Ошибка загрузки фильтров:", err));
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({});
  const [local, setLocal] = useState(filter);
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (id) => setOpenSection((prev) => (prev === id ? null : id));
  const [presetName, setPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState(null);
  const [presetToDelete, setPresetToDelete] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    setLocal(filter);
  }, [filter]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.target.closest("[data-center-modal-overlay]")) return;
      if (!ref.current?.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const branchOptions = useMemo(
    () => data.map((b) => ({ value: b.name, label: b.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [data],
  );

  const deptOptions = useMemo(
    () =>
      [
        ...new Map(
          data
            .flatMap((b) => b.departments.map((d) => ({ value: d.name, label: d.name })))
            .map((o) => [o.value, o]),
        ).values(),
      ].sort((a, b) => a.label.localeCompare(b.label)),
    [data],
  );

  const employeeOptions = useMemo(
    () =>
      data
        .flatMap((b) =>
          b.employees.map((e) => ({ value: e.employeeId, label: e.employeeFullName })),
        )
        .sort((a, b) => a.label.localeCompare(b.label)),
    [data],
  );

  const positionOptions = useMemo(
    () =>
      [
        ...new Map(
          data
            .flatMap((b) =>
              b.employees
                .filter((e) => e.positionName)
                .map((e) => ({ value: e.positionName, label: e.positionName })),
            )
            .map((o) => [o.value, o]),
        ).values(),
      ].sort((a, b) => a.label.localeCompare(b.label)),
    [data],
  );

  const toggle = (field, value) => {
    setLocal((prev) => {
      const cur = prev[field];
      return {
        ...prev,
        [field]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      };
    });
  };

  const activeCount = Object.values(filter).reduce((s, arr) => s + arr.length, 0);

  const handleApply = () => {
    onApply(local);
    setIsOpen(false);
  };

  const handleReset = () => {
    const empty = emptyFilter();
    setLocal(empty);
    setActivePresetId(null);
    onApply(empty);
    setIsOpen(false);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    createAttendanceFilterPreset({ name: presetName.trim(), filter: local })
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
    updateAttendanceFilterPreset(preset.id, { name: preset.name, filter: local })
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
    setLocal(preset.filter);
    setActivePresetId(preset.id);
  };

  const handleDeletePresetClick = (id) => {
    setPresetToDelete(id);
  };

  const handleDeletePresetConfirm = () => {
    const id = presetToDelete;
    setPresetToDelete(null);
    if (activePresetId === id) setActivePresetId(null);
    deleteAttendanceFilterPreset(id)
      .then(() => setPresets((prev) => prev.filter((p) => p.id !== id)))
      .catch((err) => {
        console.error("Ошибка удаления фильтра:", err);
        showAlert(err.response?.data?.error || t("error"), "error");
      });
  };

  const activePreset = presets.find((p) => p.id === activePresetId);
  const isPresetDirty =
    activePreset && JSON.stringify(local) !== JSON.stringify(activePreset.filter);

  return (
    <div className={styles.root} ref={ref}>
      <button
        className={`${styles.trigger} ${activeCount > 0 ? styles.triggerActive : ""}`}
        onClick={() => {
          const next = !isOpen;
          if (next && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const maxH = Math.min(
              spaceBelow > 400 ? spaceBelow - 12 : rect.top - 12,
              window.innerHeight * 0.9,
            );
            if (spaceBelow >= 400 || spaceBelow >= rect.top) {
              setPanelStyle({ top: "calc(100% + 6px)", bottom: "auto", maxHeight: maxH });
            } else {
              setPanelStyle({ bottom: "calc(100% + 6px)", top: "auto", maxHeight: maxH });
            }
          }
          setIsOpen(next);
        }}
        title={t("filter")}
      >
        {Icons.filter}
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.panel} style={panelStyle}>
          <div className={styles.panelBody}>
            {presets.length > 0 && (
              <div className={styles.presetList}>
                <div className={styles.presetListLabel}>{t("savedFilters")}</div>
                <div className={styles.presetRow}>
                  <select
                    className={styles.presetSelect}
                    value={activePresetId ?? ""}
                    onChange={(e) => handleSelectPreset(Number(e.target.value) || null)}
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
                          className={styles.presetUpdate}
                          onClick={handleUpdatePreset}
                          title={t("updateFilter")}
                        >
                          {Icons.floppyDisk}
                        </button>
                      )}
                      <button
                        className={styles.presetDelete}
                        onClick={() => handleDeletePresetClick(activePreset.id)}
                        title={t("delete")}
                      >
                        {Icons.trashOutline}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {displayMode === "byBranch" ? (
              <MultiSelect
                label={t("branch")}
                options={branchOptions}
                selected={local.branches}
                onToggle={(v) => toggle("branches", v)}
              />
            ) : (
              <>
                <AccordionSection
                  id="branches"
                  label={t("branch")}
                  selectedCount={local.branches.length}
                  isOpen={openSection === "branches"}
                  onToggle={toggleSection}
                >
                  <MultiSelect
                    label=""
                    options={branchOptions}
                    selected={local.branches}
                    onToggle={(v) => toggle("branches", v)}
                  />
                </AccordionSection>

                <AccordionSection
                  id="departments"
                  label={t("department")}
                  selectedCount={local.departments.length}
                  isOpen={openSection === "departments"}
                  onToggle={toggleSection}
                >
                  <MultiSelect
                    label=""
                    options={deptOptions}
                    selected={local.departments}
                    onToggle={(v) => toggle("departments", v)}
                  />
                </AccordionSection>

                {displayMode === "byEmployees" && (
                  <>
                    <AccordionSection
                      id="employees"
                      label={t("employee")}
                      selectedCount={local.employees.length}
                      isOpen={openSection === "employees"}
                      onToggle={toggleSection}
                    >
                      <MultiSelect
                        label=""
                        options={employeeOptions}
                        selected={local.employees}
                        onToggle={(v) => toggle("employees", v)}
                      />
                    </AccordionSection>

                    <AccordionSection
                      id="positions"
                      label={t("position")}
                      selectedCount={local.positions.length}
                      isOpen={openSection === "positions"}
                      onToggle={toggleSection}
                    >
                      <MultiSelect
                        label=""
                        options={positionOptions}
                        selected={local.positions}
                        onToggle={(v) => toggle("positions", v)}
                      />
                    </AccordionSection>
                  </>
                )}
              </>
            )}

            <div className={styles.saveRow}>
              <input
                className={styles.presetInput}
                placeholder={t("saveFilterAs")}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              />
              <button
                className={styles.saveBtn}
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                {t("save")}
              </button>
            </div>
          </div>

          <div className={styles.panelFooter}>
            <button className={styles.resetBtn} onClick={handleReset}>
              {t("reset")}
            </button>
            <button className={styles.applyBtn} onClick={handleApply}>
              {t("apply")}
            </button>
          </div>
        </div>
      )}

      <CenterModal
        isOpen={presetToDelete !== null}
        onClose={() => setPresetToDelete(null)}
        onAccept={handleDeletePresetConfirm}
        title={t("areYouSureDelete")}
      />
    </div>
  );
};

export default AttendanceDisplayFilter;
