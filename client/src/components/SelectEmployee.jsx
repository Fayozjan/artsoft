import { useState, useEffect, useRef, useMemo } from "react";
import styles from "./SelectEmployee.module.scss";

function SelectEmployee({
  options = [],
  setFormData,
  placeholder,
  data,
  disabled,
  defaultValue,
  required,
  noMatches = "Нет совпадений",
  noData = "Нет данных",
}) {
  const [search, setSearch] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const containerRef = useRef(null);

  const dataKeyMap = {
    branch: "branch_id",
    department: "department_id",
    employee: "employee_id",
    position: "position_id",
    director: "director_id",
  };

  const fieldKey = dataKeyMap[data] || null;

  const getDisplayName = (option) => {
    return option.employeeFullName || "";
  };

  const getRank = (option, searchValue) => {
    const name = getDisplayName(option);
    const id = option.id?.toString() || "";
    const number = option.employee_number?.toString() || "";

    if (id === searchValue) return 0;
    if (id.startsWith(searchValue)) return 1;
    if (number.startsWith(searchValue)) return 2;
    if (name.startsWith(searchValue)) return 3;
    if (name.includes(searchValue)) return 4;

    return 5;
  };

  // 🔹 фильтрация + сортировка
  const filteredOptions = useMemo(() => {
    if (!options.length) return [];

    const searchValue = search.trim().toLowerCase();

    const filtered = options.filter((option) => {
      if (!searchValue) return true;

      return (
        getDisplayName(option).includes(searchValue) ||
        option.id?.toString().includes(searchValue) ||
        option.employee_number?.toString().includes(searchValue)
      );
    });

    if (!searchValue) {
      return filtered.sort((a, b) =>
        getDisplayName(a).localeCompare(getDisplayName(b), "ru"),
      );
    }

    return filtered.sort((a, b) => {
      const rankDiff = getRank(a, searchValue) - getRank(b, searchValue);

      if (rankDiff !== 0) return rankDiff;

      return getDisplayName(a).localeCompare(getDisplayName(b), "ru");
    });
  }, [options, search]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    setShowOptions(true);

    if (value === "") {
      resetSelection();
    }
  };

  const handleOptionClick = (option) => {
    const displayName = getDisplayName(option);

    setSearch(displayName);
    setSelectedOption(option);
    setShowOptions(false);

    if (fieldKey) {
      setFormData((prev) => ({ ...prev, [fieldKey]: option.id }));
    }
  };

  const resetSelection = () => {
    setSearch("");
    setSelectedOption(null);
    if (fieldKey) {
      setFormData((prev) => ({ ...prev, [fieldKey]: "" }));
    }
  };

  // --- значения по умолчанию ---
  useEffect(() => {
    if (defaultValue && options?.length) {
      const defaultOption = options.find(
        (option) => Number(option.id) === Number(defaultValue),
      );

      if (defaultOption) {
        const displayName = getDisplayName(defaultOption);

        setSearch(displayName);
        setSelectedOption(defaultOption);

        if (fieldKey) {
          setFormData((prev) => ({
            ...prev,
            [fieldKey]: defaultOption.id,
          }));
        }
      }
    }
  }, [defaultValue, options, fieldKey, setFormData]);

  // --- Закрытие при клике вне ---
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
          {options?.length === 0 ? (
            <li className={styles.no_matches}>{noData}</li>
          ) : filteredOptions?.length > 0 ? (
            filteredOptions.map((option) => (
              <li key={option.id} onClick={() => handleOptionClick(option)}>
                {getDisplayName(option)}
              </li>
            ))
          ) : (
            <li className={styles.no_matches}>{noMatches}</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default SelectEmployee;
