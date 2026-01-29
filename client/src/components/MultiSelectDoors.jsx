import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./MultiSelectDoors.module.scss";

const MultiSelectDoors = ({ options, selected, onChange }) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState("down");
  const containerRef = useRef(null);

  // Фильтрация дверей по поиску
  const filteredOptions = options.filter((door) =>
    door.name.toLowerCase().includes(search.toLowerCase())
  );

  // Закрытие списка при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Обработчик выбора одной двери
  const handleSelect = useCallback(
    (door) => {
      const isSelected = selected.includes(door.id);
      let newSelected;

      if (isSelected) {
        newSelected = selected.filter((item) => item !== door.id);
      } else {
        newSelected = [...selected, door.id];
      }

      onChange(newSelected);
    },
    [selected, onChange]
  );

  // Выбрать / снять выделение всех дверей
  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      const allDoorIds = options.map((door) => door.id);
      onChange(allDoorIds);
    }
  };

  // Формируем список: "Выбрать всех" + отфильтрованные двери
  const sortedFilteredOptions = [
    { id: "select_all", name: "Выбрать всех" },
    ...filteredOptions.sort((a, b) => {
      const isASelected = selected.includes(a.id);
      const isBSelected = selected.includes(b.id);
      if (isASelected && !isBSelected) return -1;
      if (!isASelected && isBSelected) return 1;
      return 0;
    }),
  ];

  const toggleOpen = () => {
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      setOpenDirection("up");
    } else {
      setOpenDirection("down");
    }

    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={styles.multiSelectDoors}>
      <span className={styles.sticker}>{selected?.length || 0}</span>
      <input
        type="text"
        placeholder="Выберите дверь"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClick={toggleOpen}
        className={styles.searchInput}
      />
      {isOpen && (
        <div className={`${styles.options} ${styles[openDirection]}`}>
          {sortedFilteredOptions.map((door) => (
            <div
              key={String(door.id)}
              onClick={() =>
                door.id === "select_all"
                  ? handleSelectAll()
                  : handleSelect(door)
              }
              className={styles.option}
            >
              <input
                type="checkbox"
                checked={
                  door.id === "select_all"
                    ? selected.length === options.length
                    : selected.includes(door.id)
                }
                readOnly
                className={styles.checkbox}
              />
              {door.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDoors;
