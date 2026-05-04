import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import styles from "./MultiSelectEmployees.module.scss";

const MultiSelectEmployees = ({ options = [], selected = [], onChange }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [initialSortedOptions, setInitialSortedOptions] = useState([]);
  const containerRef = useRef(null);

  const safeSelected = Array.isArray(selected) ? selected : [];

  const filteredOptions = useMemo(
    () =>
      options.filter((option) => {
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
      }),
    [options, search],
  );

  // ✅ Выбор одного
  const handleSelect = useCallback(
    (option) => {
      const id = Number(option.id);
      const isSelected = safeSelected.includes(id);
      const newSelected = isSelected
        ? safeSelected.filter((item) => item !== id)
        : [...safeSelected, id];
      onChange(newSelected);
    },
    [safeSelected, onChange],
  );

  // ✅ Выбор всех
  const handleSelectAll = useCallback(() => {
    if (safeSelected.length === options.length) {
      onChange([]);
    } else {
      const allIds = options.map((option) => Number(option.id));
      onChange(allIds);
    }
  }, [safeSelected, options, onChange]);

  // ⚡ Сортировка при первом открытии
  useEffect(() => {
    if (isOpen && initialSortedOptions.length === 0) {
      const sorted = [...filteredOptions].sort((a, b) => {
        const isASelected = safeSelected.includes(Number(a.id));
        const isBSelected = safeSelected.includes(Number(b.id));
        return isASelected === isBSelected ? 0 : isASelected ? -1 : 1;
      });
      setInitialSortedOptions([
        { id: "select_all", employeeFullName: t("selectAll") },
        ...sorted,
      ]);
    }
  }, [isOpen, filteredOptions, safeSelected, initialSortedOptions]);

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

  const optionsToRender = useMemo(() => {
    if (!isOpen) return [];

    const sorted = [...filteredOptions].sort((a, b) => {
      const isASelected = safeSelected.includes(Number(a.id));
      const isBSelected = safeSelected.includes(Number(b.id));
      return isASelected === isBSelected ? 0 : isASelected ? -1 : 1;
    });

    return [{ id: "select_all", employeeFullName: t("selectAll") }, ...sorted];
  }, [isOpen, filteredOptions, safeSelected]);

  return (
    <div ref={containerRef} className={styles.multiSelectEmployees}>
      <input
        type="text"
        placeholder={t("searchByEmployee")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        className={styles.searchInput}
      />

      {isOpen && (
        <div className={styles.options}>
          {optionsToRender.length === 0 ? (
            <div className={styles.noData}>{t("noData")}</div>
          ) : (
            optionsToRender.map((option) => {
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
                        : safeSelected.includes(Number(option.id))
                    }
                    readOnly
                    className={styles.checkbox}
                  />
                  <span>
                    {isSelectAll
                      ? option.employeeFullName
                      : option.departmentName
                        ? `${option.departmentName} - ${option.employeeFullName}`
                        : option.employeeFullName}
                  </span>
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
