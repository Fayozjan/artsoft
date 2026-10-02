import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useDebounce } from "../hooks/useDebounce";

import styles from "./MultiSelectEmployees.module.scss";

// Рисуем не больше N строк за раз, остальное — через поиск
const VISIBLE_LIMIT = 80;

const MultiSelectEmployees = ({
  options = [],
  selected = [],
  onChange,
  showDepartment = true,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // Кто был выбран на момент открытия списка — только они поднимаются наверх.
  // Ставить наверх сразу после клика нельзя: строка уезжала бы из-под курсора и
  // список прыгал, а выбирать дальше приходилось бы заново искать место.
  const [pinnedIds, setPinnedIds] = useState([]);
  const containerRef = useRef(null);

  const debouncedSearch = useDebounce(search, 200);
  const safeSelected = Array.isArray(selected) ? selected : [];

  const filteredOptions = useMemo(
    () =>
      options.filter((option) => {
        const query = debouncedSearch.toLowerCase();
        const fullName = option.employeeFullName?.toLowerCase() || "";
        const id = option.id?.toString().toLowerCase() || "";
        const employeeNumber = option.employeeNumber?.toString().toLowerCase() || "";
        const branch = option.branchName?.toLowerCase() || "";
        const department = option.departmentName?.toLowerCase() || "";
        return (
          fullName.includes(query) ||
          id.includes(query) ||
          employeeNumber.includes(query) ||
          branch.includes(query) ||
          department.includes(query)
        );
      }),
    [options, debouncedSearch],
  );

  // Ранг совпадения: точный/начальный id — выше по списку
  const getMatchRank = useCallback((option, query) => {
    if (!query) return 0;
    const id = option.id?.toString().toLowerCase() || "";
    const employeeNumber = option.employeeNumber?.toString().toLowerCase() || "";
    const fullName = option.employeeFullName?.toLowerCase() || "";
    if (id === query) return 0;
    if (id.startsWith(query)) return 1;
    if (employeeNumber.startsWith(query)) return 2;
    if (fullName.startsWith(query)) return 3;
    return 4;
  }, []);

  // Выбор одного
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

  // Выбор всех
  const handleSelectAll = useCallback(() => {
    if (safeSelected.length === options.length) {
      onChange([]);
    } else {
      const allIds = options.map((option) => Number(option.id));
      onChange(allIds);
    }
  }, [safeSelected, options, onChange]);

  // Закрытие при клике вне
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

  const sortedOptions = useMemo(() => {
    if (!isOpen) return [];

    const query = debouncedSearch.toLowerCase();
    return [...filteredOptions].sort((a, b) => {
      const rankDiff = getMatchRank(a, query) - getMatchRank(b, query);
      if (rankDiff !== 0) return rankDiff;
      const isAPinned = pinnedIds.includes(Number(a.id));
      const isBPinned = pinnedIds.includes(Number(b.id));
      return isAPinned === isBPinned ? 0 : isAPinned ? -1 : 1;
    });
  }, [isOpen, filteredOptions, pinnedIds, debouncedSearch, getMatchRank]);

  // выбранные при открытии подняты наверх сортировкой, поэтому срез их не прячет
  const isTruncated = sortedOptions.length > VISIBLE_LIMIT;

  const optionsToRender = useMemo(
    () =>
      isOpen
        ? [
            { id: "select_all", employeeFullName: t("selectAll") },
            ...sortedOptions.slice(0, VISIBLE_LIMIT),
          ]
        : [],
    [isOpen, sortedOptions],
  );

  return (
    <div ref={containerRef} className={styles.multiSelectEmployees}>
      <div className={styles.inputWrapper}>
        <input
          type="text"
          placeholder={t("searchByEmployee")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            if (isOpen) return;
            setPinnedIds(safeSelected);
            setIsOpen(true);
          }}
          className={`${styles.searchInput} ${safeSelected.length ? styles.searchInputActive : ""}`}
        />
        {safeSelected.length > 0 && (
          <span className={styles.countBadge}>{safeSelected.length}</span>
        )}
      </div>

      {isOpen && (
        <div className={styles.options}>
          {optionsToRender.length === 0 ? (
            <div className={styles.noData}>{t("noData")}</div>
          ) : (
            optionsToRender.map((option) => {
              const isSelectAll = option.id === "select_all";
              const isChecked = isSelectAll
                ? safeSelected.length === options.length
                : safeSelected.includes(Number(option.id));
              return (
                <div
                  key={option.id}
                  onClick={() =>
                    isSelectAll ? handleSelectAll() : handleSelect(option)
                  }
                  className={`${styles.option} ${isChecked ? styles.optionSelected : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className={styles.checkbox}
                  />
                  <span>
                    {isSelectAll
                      ? option.employeeFullName
                      : showDepartment && option.departmentName
                        ? `${option.departmentName} - ${option.employeeFullName}`
                        : option.employeeFullName}
                  </span>
                </div>
              );
            })
          )}
          {isTruncated && (
            <div className={styles.noData}>{t("clarifySearchQuery")}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectEmployees;
