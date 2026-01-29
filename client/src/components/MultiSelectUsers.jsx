import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./MultiSelect.module.scss";

const MultiSelectUsers = ({ options = [], selected = [], onChange }) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const safeSelected = Array.isArray(selected) ? selected : [];

  // 🔍 Фильтруем пользователей по имени, отделу или ID
  const filteredOptions = options.filter((option) => {
    const fullName = [option?.surname, option?.name, option?.patronymic]
      .filter(Boolean)
      .join(" ");
    const department = option.department_name || "";

    if (/^\d+$/.test(search)) {
      const searchStr = search.toString();
      return (
        option.user_id.toString() === searchStr ||
        option.employee_number?.toString() === searchStr
      );
    }

    return (
      fullName.toLowerCase().includes(search.toLowerCase()) ||
      department.toLowerCase().includes(search.toLowerCase())
    );
  });

  // ✅ Закрытие при клике вне
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

  // 🟩 Обработчик выбора одного
  const handleSelect = useCallback(
    (option) => {
      const isSelected = safeSelected.includes(option.user_id);
      const newSelected = isSelected
        ? safeSelected.filter((id) => id !== option.user_id)
        : [...safeSelected, option.user_id];

      onChange(newSelected);
      // ❌ не закрываем при выборе
    },
    [safeSelected, onChange]
  );

  // 🟦 Обработчик выбора всех
  const handleSelectAll = useCallback(() => {
    if (safeSelected.length === options.length) {
      onChange([]); // снять все
    } else {
      const allIds = options.map((o) => o.user_id);
      onChange(allIds); // выбрать всех
    }
    // ❌ не закрываем после выбора всех
  }, [safeSelected, options, onChange]);

  // 📋 Сортируем так, чтобы выбранные были сверху
  const sortedFilteredOptions = [
    { user_id: "select_all", name: "Выбрать всех" },
    ...filteredOptions.sort((a, b) => {
      const isASelected = safeSelected.includes(a.user_id);
      const isBSelected = safeSelected.includes(b.user_id);
      return isASelected === isBSelected ? 0 : isASelected ? -1 : 1;
    }),
  ];

  return (
    <div ref={containerRef} className={styles.container}>
      <input
        type="text"
        placeholder="Поиск..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)} // открываем при фокусе
        className={styles.searchInput}
      />

      {isOpen && (
        <div className={styles.options}>
          {sortedFilteredOptions.map((option) => (
            <div
              key={option.user_id}
              onClick={() =>
                option.user_id === "select_all"
                  ? handleSelectAll()
                  : handleSelect(option)
              }
              className={styles.option}
            >
              <input
                type="checkbox"
                checked={
                  option.user_id === "select_all"
                    ? safeSelected.length === options.length
                    : safeSelected.includes(option.user_id)
                }
                readOnly
                className={styles.checkbox}
              />
              {option.user_id === "select_all"
                ? option.name
                : `${option.department_name || ""} — ${[
                    option.surname,
                    option.name,
                    option.patronymic,
                    option.user_id,
                  ]
                    .filter(Boolean)
                    .join(" ")}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectUsers;
