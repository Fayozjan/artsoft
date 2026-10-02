import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useDebounce } from "../hooks/useDebounce";

import EmployeeCell from "./EmployeeCell";
import { Icons } from "../icons/icons";
import styles from "./EmployeePicker.module.scss";

// Строки дорисовываются порциями по мере прокрутки — весь штат разом тормозит.
const PAGE_SIZE = 60;

const byName = (a, b) =>
  (a.employeeFullName || "").localeCompare(b.employeeFullName || "", "ru");

// Выбор сотрудников на весь блок: поиск, "выбрать все", фильтр "все / выбранные" и
// список с фото. В отличие от MultiSelectEmployees — не выпадашка, а сам блок,
// поэтому выбирать можно подряд без переоткрытия. Порядок строк не зависит от
// выбора: строка не уезжает из-под курсора.
// options: [{ id, employeeFullName, employeePhoto, branchName, departmentName,
// positionName }] — EmployeeService.getActive(); selected/onChange — массив числовых id.
const EmployeePicker = ({ options = [], selected = [], onChange }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const selectAllRef = useRef(null);

  const debouncedSearch = useDebounce(search, 200);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const sorted = useMemo(() => [...options].sort(byName), [options]);

  // Выбранные, которых нет среди активных (уволен / нет доступа): в общем списке
  // их не показываем, но в "Выбранные" они видны и снимаются — иначе выбор
  // был бы невидимым и его нельзя было бы убрать.
  const orphans = useMemo(() => {
    const known = new Set(options.map((o) => Number(o.id)));
    return selected
      .filter((id) => !known.has(id))
      .map((id) => ({ id: String(id), employeeFullName: `#${id}` }));
  }, [options, selected]);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const pool = onlySelected
      ? [...sorted, ...orphans].filter((o) => selectedSet.has(Number(o.id)))
      : sorted;
    if (!query) return pool;
    return pool.filter((o) =>
      [o.employeeFullName, o.id, o.employeeNumber, o.branchName, o.departmentName, o.positionName].some(
        (value) => value?.toString().toLowerCase().includes(query),
      ),
    );
  }, [sorted, orphans, onlySelected, selectedSet, debouncedSearch]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [debouncedSearch, onlySelected]);

  const visible = filtered.slice(0, limit);

  const filteredIds = useMemo(() => filtered.map((o) => Number(o.id)), [filtered]);
  const checkedCount = filteredIds.filter((id) => selectedSet.has(id)).length;
  const allChecked = filteredIds.length > 0 && checkedCount === filteredIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = checkedCount > 0 && !allChecked;
    }
  }, [checkedCount, allChecked]);

  const toggle = (id) => {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  // Действует на то, что сейчас отфильтровано: нашли отдел поиском — выбрали весь.
  const toggleAll = () => {
    if (allChecked) {
      const drop = new Set(filteredIds);
      onChange(selected.filter((id) => !drop.has(id)));
    } else {
      onChange([...new Set([...selected, ...filteredIds])]);
    }
  };

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (limit < filtered.length && el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
      setLimit((prev) => prev + PAGE_SIZE);
    }
  };

  const handleRowClick = (e, id) => {
    // Клик по фото открывает превью, а не переключает выбор.
    if (e.target.closest("img")) return;
    toggle(id);
  };

  return (
    <div className={styles.picker}>
      <div className={styles.searchBox}>
        {Icons.search}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchByEmployee")}
        />
        {search && (
          <button type="button" className={styles.searchClear} onClick={() => setSearch("")}>
            {Icons.clear}
          </button>
        )}
      </div>

      <div className={styles.bar}>
        <label className={styles.selectAll}>
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            disabled={filteredIds.length === 0}
            onChange={toggleAll}
          />
          <span>{t("selectAll")}</span>
        </label>

        <div className={styles.segmented}>
          <button
            type="button"
            className={!onlySelected ? styles.active : ""}
            onClick={() => setOnlySelected(false)}
          >
            {t("all")}
          </button>
          <button
            type="button"
            className={onlySelected ? styles.active : ""}
            onClick={() => setOnlySelected(true)}
          >
            {t("selected")}
            <b>{selected.length}</b>
          </button>
        </div>
      </div>

      <div className={styles.list} onScroll={handleScroll}>
        {visible.length > 0 ? (
          visible.map((emp) => {
            const id = Number(emp.id);
            const checked = selectedSet.has(id);
            return (
              <div
                key={emp.id}
                className={`${styles.row} ${checked ? styles.rowChecked : ""}`}
                onClick={(e) => handleRowClick(e, id)}
              >
                <input type="checkbox" checked={checked} readOnly tabIndex={-1} />
                <EmployeeCell
                  compact
                  fullName={emp.employeeFullName}
                  photo={emp.employeePhoto}
                  id={emp.id}
                  branch={emp.branchName}
                  department={emp.departmentName}
                  position={emp.positionName}
                />
              </div>
            );
          })
        ) : (
          <div className={styles.empty}>{t("noResultsSearch")}</div>
        )}

        {filtered.length > visible.length && (
          <div className={styles.more}>
            {t("shownOfTotal", { shown: visible.length, total: filtered.length })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeePicker;
