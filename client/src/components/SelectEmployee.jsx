import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import styles from "./SelectEmployee.module.scss";

// Дебаунс хук
function useDebounce(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const VISIBLE_LIMIT = 80; // Виртуализация: показываем не больше N строк

const dataKeyMap = {
  branch: "branch_id",
  department: "department_id",
  employee: "employee_id",
  position: "position_id",
  director: "director_id",
};

function SelectEmployee({
  options = [],
  setFormData,
  placeholder,
  data,
  disabled,
  defaultValue,
  required,
  noMatches,
  noData,
}) {
  const { t } = useTranslation();
  const resolvedNoMatches = noMatches ?? t("noMatches");
  const resolvedNoData = noData ?? t("noData");

  const [search, setSearch] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const containerRef = useRef(null);

  const debouncedSearch = useDebounce(search, 200);
  const fieldKey = dataKeyMap[data] || null;

  const getDisplayName = useCallback(
    (option) => option.employeeFullName || "",
    [],
  );

  const getRank = useCallback(
    (option, searchValue) => {
      const s = searchValue.toLowerCase().trim();
      const name = getDisplayName(option).toLowerCase();
      const id = option.id?.toString() || "";
      const number = option.employee_number?.toString() || "";

      if (id === s) return 0;
      if (id.startsWith(s)) return 1;
      if (number.startsWith(s)) return 2;
      if (name.startsWith(s)) return 3;
      if (name.includes(s)) return 4;
      return 5;
    },
    [getDisplayName],
  );

  const filteredOptions = useMemo(() => {
    if (!options.length) return [];

    const searchValue = debouncedSearch.trim().toLowerCase();

    if (!searchValue) {
      // Без поиска — просто сортировка, без фильтрации
      return [...options]
        .sort((a, b) =>
          getDisplayName(a).localeCompare(getDisplayName(b), "ru"),
        )
        .slice(0, VISIBLE_LIMIT);
    }

    const filtered = [];
    for (const option of options) {
      const name = getDisplayName(option).toLowerCase();
      const id = option.id?.toString() || "";
      const number = option.employee_number?.toString() || "";

      if (
        name.includes(searchValue) ||
        id.includes(searchValue) ||
        number.includes(searchValue)
      ) {
        filtered.push(option);
      }
    }

    filtered.sort((a, b) => {
      const rankDiff = getRank(a, searchValue) - getRank(b, searchValue);
      return rankDiff !== 0
        ? rankDiff
        : getDisplayName(a).localeCompare(getDisplayName(b), "ru");
    });

    return filtered.slice(0, VISIBLE_LIMIT);
  }, [options, debouncedSearch, getDisplayName, getRank]);

  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      setSearch(value);
      setShowOptions(true);
      if (value === "") {
        setSelectedOption(null);
        if (fieldKey) setFormData((prev) => ({ ...prev, [fieldKey]: "" }));
      }
    },
    [fieldKey, setFormData],
  );

  const handleOptionClick = useCallback(
    (option) => {
      const displayName = getDisplayName(option);
      setSearch(displayName);
      setSelectedOption(option);
      setShowOptions(false);
      if (fieldKey) setFormData((prev) => ({ ...prev, [fieldKey]: option.id }));
    },
    [fieldKey, setFormData, getDisplayName],
  );

  const resetSelection = useCallback(() => {
    setSearch("");
    setSelectedOption(null);
    if (fieldKey) setFormData((prev) => ({ ...prev, [fieldKey]: "" }));
  }, [fieldKey, setFormData]);

  useEffect(() => {
    if (!defaultValue || !options?.length) return;
    const defaultOption = options.find(
      (o) => Number(o.id) === Number(defaultValue),
    );
    if (defaultOption) {
      setSearch(getDisplayName(defaultOption));
      setSelectedOption(defaultOption);
      if (fieldKey)
        setFormData((prev) => ({ ...prev, [fieldKey]: defaultOption.id }));
    }
  }, [defaultValue, options, fieldKey, setFormData, getDisplayName]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={styles.selectWithSearch} ref={containerRef}>
      <input
        type="text"
        value={search}
        onChange={handleInputChange}
        onFocus={() => setShowOptions(true)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
      />
      {selectedOption && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={resetSelection}
        >
          ✖
        </button>
      )}

      {showOptions && (
        <ul className={styles.optionsList}>
          {options.length === 0 ? (
            <li className={styles.no_matches}>{resolvedNoData}</li>
          ) : filteredOptions.length > 0 ? (
            <>
              {filteredOptions.map((option) => (
                <li key={option.id} onClick={() => handleOptionClick(option)}>
                  {getDisplayName(option)}
                </li>
              ))}
              {/* Подсказка если результатов обрезано */}
              {debouncedSearch && filteredOptions.length === VISIBLE_LIMIT && (
                <li className={styles.no_matches}>
                  Уточните запрос для более точного поиска
                </li>
              )}
            </>
          ) : (
            <li className={styles.no_matches}>{resolvedNoMatches}</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default SelectEmployee;
