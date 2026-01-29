import { useState, useEffect, useRef, useCallback } from "react";

import styles from "./MultiSelectEmployees.module.scss";

const MultiSelectEmployees = ({ options = [], selected = [], onChange }) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  console.log("options", options);

  const safeSelected = Array.isArray(selected) ? selected : [];

  // 🔍 Фильтрация по fullName, branch, department
  const filteredOptions = options.filter((option) => {
    const query = search.toLowerCase();

    const fullName = option.employeeFullName?.toLowerCase() || "";
    const id = option.id?.toString().toLowerCase() || "";
    const branch = option.branchName?.toLowerCase() || "";
    const department = option.departmentName?.toLowerCase() || "";

    return (
      fullName.includes(query) ||
      id.includes(query) ||
      branch.includes(query) ||
      department.includes(query)
    );
  });

  // ✅ Выбор одного
  const handleSelect = useCallback(
    (option) => {
      const isSelected = safeSelected.includes(option.id);
      const newSelected = isSelected
        ? safeSelected.filter((item) => item !== option.id)
        : [...safeSelected, option.id];
      onChange(newSelected);
    },
    [safeSelected, onChange]
  );

  // ✅ Выбор всех
  const handleSelectAll = useCallback(() => {
    if (safeSelected.length === options.length) {
      onChange([]);
    } else {
      const allIds = options.map((option) => option.id);
      onChange(allIds);
    }
  }, [safeSelected, options, onChange]);

  // Сортировка: выбранные сверху
  const sortedFilteredOptions = [
    { id: "select_all", fullName: "Выбрать всех" },
    ...filteredOptions.sort((a, b) => {
      const isASelected = safeSelected.includes(a.id);
      const isBSelected = safeSelected.includes(b.id);
      return isASelected === isBSelected ? 0 : isASelected ? -1 : 1;
    }),
  ];

  // 🔒 Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside, true);
    return () => {
      document.removeEventListener("click", handleClickOutside, true);
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.multiSelectEmployees}>
      <input
        type="text"
        placeholder="Поиск по сотрудникам..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        className={styles.searchInput}
      />

      {isOpen && (
        <div className={styles.options}>
          {filteredOptions.length === 0 ? (
            <div className={styles.noData}>Нет данных</div>
          ) : (
            sortedFilteredOptions.map((option) => {
              const isSelectAll = option.id === "select_all";
              return (
                <div
                  key={option.id}
                  onClick={() =>
                    isSelectAll ? handleSelectAll() : handleSelect(option)
                  }
                  className={styles.option}
                >
                  <input
                    type="checkbox"
                    checked={
                      isSelectAll
                        ? safeSelected.length === options.length
                        : safeSelected.includes(option.id)
                    }
                    readOnly
                    className={styles.checkbox}
                  />

                  {isSelectAll ? (
                    <span>{option.employeeFullName}</span>
                  ) : (
                    <span>
                      {option.departmentName
                        ? `${option.departmentName || ""} - ${
                            option.employeeFullName
                          }`
                        : option.employeeFullName}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectEmployees;
