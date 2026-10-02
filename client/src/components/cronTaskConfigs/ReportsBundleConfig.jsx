import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useFilterDataStore } from "../../stores/filterDataStore";
import { EmployeeService, getAttendanceFilterPresets, getTimesheetFilterPresets } from "../../api";
import ChatIdsInput from "./ChatIdsInput";

import styles from "./AttendanceReportConfig.module.scss";

const emptyFilter = () => ({ employees: [], branches: [] });

function AccordionSection({ id, label, hint, selectedCount, isOpen, onToggle, children }) {
  return (
    <div className={styles.accordionSection}>
      <button
        type="button"
        className={`${styles.accordionHeader} ${isOpen ? styles.accordionHeaderOpen : ""}`}
        onClick={() => onToggle(id)}
      >
        <span className={styles.accordionLabel}>{label}</span>
        {selectedCount > 0 && <span className={styles.accordionBadge}>{selectedCount}</span>}
        <span className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ""}`}>▾</span>
      </button>
      {isOpen && (
        <div className={styles.accordionContent}>
          {hint && <div className={styles.multiSelectLabel}>{hint}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

function MultiSelect({ options, selected, onToggle }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className={styles.multiSelect}>
      {options.length > 6 && (
        <input
          className={styles.multiSelectSearch}
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      <div className={styles.multiSelectList}>
        {filtered.map((o) => (
          <label key={o.value} className={styles.checkItem}>
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={() => onToggle(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Конфиг-под-форма для task_type = "reports_bundle" — один PDF из 4 отчётов
// (Посещаемость, Опоздания, Опоздания по филиалам за месяц, Заявки на отсутствие).
// Формат всегда PDF, поэтому свитчера excel/pdf здесь нет (в отличие от AttendanceReportConfig/LateEmployeesReportConfig).
const ReportsBundleConfig = ({ config, onChange, failedChatIds }) => {
  const { t } = useTranslation();
  const { branches, fetchAllData } = useFilterDataStore();
  const [employees, setEmployees] = useState([]);
  const [attendancePresets, setAttendancePresets] = useState([]);
  const [timesheetPresets, setTimesheetPresets] = useState([]);
  const [openSection, setOpenSection] = useState(null);

  useEffect(() => {
    if (!branches.length) {
      fetchAllData();
    }
    EmployeeService.getActive()
      .then((res) => setEmployees(res.data || []))
      .catch((err) => console.error("Ошибка загрузки сотрудников:", err.message));
    getAttendanceFilterPresets()
      .then(setAttendancePresets)
      .catch((err) => console.error("Ошибка загрузки фильтров посещаемости:", err.message));
    getTimesheetFilterPresets()
      .then(setTimesheetPresets)
      .catch((err) => console.error("Ошибка загрузки фильтров табеля:", err.message));
  }, []);

  const toggleSection = (id) => setOpenSection((prev) => (prev === id ? null : id));

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b.name, label: b.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [branches],
  );
  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.id, label: e.employeeFullName })).sort((a, b) => a.label.localeCompare(b.label)),
    [employees],
  );

  const filter = config.filter || emptyFilter();

  const toggleFilterValue = (field, value) => {
    const cur = filter[field] || [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    onChange({ ...config, filter: { ...filter, [field]: next } });
  };

  // Пресеты приходят из двух разных источников: attendance_filter_presets (filter.employees)
  // и timesheet_filter_presets (filter.employee_ids) — оба хранят те же ID сотрудников,
  // разница только в имени поля.
  const handleSelectEmployeesPreset = (value) => {
    if (!value) return;
    const [source, idStr] = value.split(":");
    const id = Number(idStr);
    const preset = (source === "attendance" ? attendancePresets : timesheetPresets).find((p) => p.id === id);
    if (!preset) return;
    const employeeIds = source === "attendance" ? preset.filter?.employees : preset.filter?.employee_ids;
    onChange({ ...config, filter: { ...filter, employees: employeeIds || [] } });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <div>
          <ChatIdsInput
            value={config.chat_ids}
            onChange={(chat_ids) => onChange({ ...config, chat_ids })}
            failedIds={failedChatIds}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("language")}</label>
          <select
            value={config.language || "ru"}
            onChange={(e) => onChange({ ...config, language: e.target.value })}
          >
            <option value="ru">{t("languageRussian")}</option>
            <option value="uzCyrl">{t("languageUzbekCyrl")}</option>
            <option value="uzLatn">{t("languageUzbekLatn")}</option>
            <option value="en">{t("languageEnglish")}</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label className={styles.checkItem}>
            <input
              type="checkbox"
              checked={!!config.include_lunch_late}
              onChange={(e) => onChange({ ...config, include_lunch_late: e.target.checked })}
            />
            <span>{t("includeLunchLate")}</span>
          </label>
        </div>
      </div>

      {(attendancePresets.length > 0 || timesheetPresets.length > 0) && (
        <div className={styles.row}>
          <div>
            <label>{t("loadFromPreset")}</label>
            <select defaultValue="" onChange={(e) => handleSelectEmployeesPreset(e.target.value)}>
              <option value="">{t("select")}</option>
              {attendancePresets.length > 0 && (
                <optgroup label={t("attendance")}>
                  {attendancePresets.map((p) => (
                    <option key={`attendance:${p.id}`} value={`attendance:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {timesheetPresets.length > 0 && (
                <optgroup label={t("timesheet")}>
                  {timesheetPresets.map((p) => (
                    <option key={`timesheet:${p.id}`} value={`timesheet:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      )}

      <div className={styles.filterSections}>
        <AccordionSection
          id="employees"
          label={t("employee")}
          hint={t("reportsBundleEmployeesHint")}
          selectedCount={filter.employees.length}
          isOpen={openSection === "employees"}
          onToggle={toggleSection}
        >
          <MultiSelect options={employeeOptions} selected={filter.employees} onToggle={(v) => toggleFilterValue("employees", v)} />
        </AccordionSection>

        <AccordionSection
          id="branches"
          label={t("branch")}
          hint={t("reportsBundleBranchesHint")}
          selectedCount={filter.branches.length}
          isOpen={openSection === "branches"}
          onToggle={toggleSection}
        >
          <MultiSelect options={branchOptions} selected={filter.branches} onToggle={(v) => toggleFilterValue("branches", v)} />
        </AccordionSection>
      </div>
    </div>
  );
};

export default ReportsBundleConfig;
