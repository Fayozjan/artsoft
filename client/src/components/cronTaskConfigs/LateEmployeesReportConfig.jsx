import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useFilterDataStore } from "../../stores/filterDataStore";
import { EmployeeService } from "../../api";
import { Switcher } from "../Switcher";
import ChatIdsInput from "./ChatIdsInput";

import styles from "./AttendanceReportConfig.module.scss";

const emptyFilter = () => ({ branches: [], departments: [], employees: [], positions: [] });
const REPORT_FORMATS = ["excel", "pdf"];

function AccordionSection({ id, label, selectedCount, isOpen, onToggle, children }) {
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
      {isOpen && <div className={styles.accordionContent}>{children}</div>}
    </div>
  );
}

function MultiSelect({ label, options, selected, onToggle }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
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

// Конфиг-под-форма для task_type = "late_employees_report".
const LateEmployeesReportConfig = ({ config, onChange, failedChatIds }) => {
  const { t } = useTranslation();
  const { branches, departments, positions, fetchAllData } = useFilterDataStore();
  const [employees, setEmployees] = useState([]);
  const [openSection, setOpenSection] = useState(null);

  useEffect(() => {
    if (!branches.length || !departments.length || !positions.length) {
      fetchAllData();
    }
    EmployeeService.getActive()
      .then((res) => setEmployees(res.data || []))
      .catch((err) => console.error("Ошибка загрузки сотрудников:", err.message));
  }, []);

  const toggleSection = (id) => setOpenSection((prev) => (prev === id ? null : id));

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b.name, label: b.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [branches],
  );
  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.name, label: d.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [departments],
  );
  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.id, label: e.employeeFullName })).sort((a, b) => a.label.localeCompare(b.label)),
    [employees],
  );
  const positionOptions = useMemo(
    () => positions.map((p) => ({ value: p.name, label: p.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [positions],
  );

  const filter = config.filter || emptyFilter();
  const format = config.format || "excel";

  const setFilterField = (field, value) => {
    onChange({ ...config, filter: { ...filter, [field]: value } });
  };

  const toggleFilterValue = (field, value) => {
    const cur = filter[field] || [];
    setFilterField(field, cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]);
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
          <label>{t("reportFormat")}</label>
          <Switcher
            items={REPORT_FORMATS}
            activeItem={format}
            onSelect={(value) => onChange({ ...config, format: value })}
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

      <div className={styles.filterSections}>
        <AccordionSection
          id="branches"
          label={t("branch")}
          selectedCount={filter.branches.length}
          isOpen={openSection === "branches"}
          onToggle={toggleSection}
        >
          <MultiSelect options={branchOptions} selected={filter.branches} onToggle={(v) => toggleFilterValue("branches", v)} />
        </AccordionSection>

        <AccordionSection
          id="departments"
          label={t("department")}
          selectedCount={filter.departments.length}
          isOpen={openSection === "departments"}
          onToggle={toggleSection}
        >
          <MultiSelect options={deptOptions} selected={filter.departments} onToggle={(v) => toggleFilterValue("departments", v)} />
        </AccordionSection>

        <AccordionSection
          id="employees"
          label={t("employee")}
          selectedCount={filter.employees.length}
          isOpen={openSection === "employees"}
          onToggle={toggleSection}
        >
          <MultiSelect options={employeeOptions} selected={filter.employees} onToggle={(v) => toggleFilterValue("employees", v)} />
        </AccordionSection>

        <AccordionSection
          id="positions"
          label={t("position")}
          selectedCount={filter.positions.length}
          isOpen={openSection === "positions"}
          onToggle={toggleSection}
        >
          <MultiSelect options={positionOptions} selected={filter.positions} onToggle={(v) => toggleFilterValue("positions", v)} />
        </AccordionSection>
      </div>
    </div>
  );
};

export default LateEmployeesReportConfig;
