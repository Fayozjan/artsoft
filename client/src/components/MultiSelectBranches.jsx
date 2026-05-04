import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import styles from "./MultiSelect.module.scss";

const MultiSelectBranches = ({ options = [], selected = [], onChange }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const safeSelected = Array.isArray(selected) ? selected : [];

  // фильтрация
  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(search.toLowerCase()),
  );

  // выбор одного (✅ без закрытия)
  const handleSelect = useCallback(
    (option) => {
      const isSelected = safeSelected.includes(option.id);
      const newSelected = isSelected
        ? safeSelected.filter((item) => item !== option.id)
        : [...safeSelected, option.id];
      onChange(newSelected);
    },
    [safeSelected, onChange],
  );

  // выбор всех (✅ без закрытия)
  const handleSelectAll = useCallback(() => {
    if (safeSelected.length === options.length) {
      onChange([]);
    } else {
      const allIds = options.map((option) => option.id);
      onChange(allIds);
    }
  }, [safeSelected, options, onChange]);

  const sortedFilteredOptions = [
    { id: "select_all", name: t("selectAll") },
    ...filteredOptions.sort((a, b) => {
      const isASelected = safeSelected.includes(a.id);
      const isBSelected = safeSelected.includes(b.id);
      return isASelected === isBSelected ? 0 : isASelected ? -1 : 1;
    }),
  ];

  // ✅ закрытие при клике вне
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
    <div ref={containerRef} className={styles.container}>
      <input
        type="text"
        placeholder={t("searchByBranch")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        className={styles.searchInput}
      />

      {isOpen && (
        <div className={styles.options}>
          {sortedFilteredOptions.map((option) => (
            <div
              key={option.id}
              onClick={() =>
                option.id === "select_all"
                  ? handleSelectAll()
                  : handleSelect(option)
              }
              className={styles.option}
            >
              <input
                type="checkbox"
                checked={
                  option.id === "select_all"
                    ? safeSelected.length === options.length
                    : safeSelected.includes(option.id)
                }
                readOnly
                className={styles.checkbox}
              />
              {option.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectBranches;
