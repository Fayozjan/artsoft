import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAnchoredPanel } from "../hooks/useAnchoredPanel";
import { Icons } from "../icons/icons";

import styles from "./SearchableSelect.module.scss";

const sameId = (a, b) =>
  a !== undefined && a !== null && b !== undefined && b !== null
    ? String(a) === String(b)
    : false;

const isEmpty = (v) => v === undefined || v === null || v === "";

// капа на рендер DOM-строк — при тысячах товаров без неё список тормозит и без пользы
// (видно только первый экран); поиск сужает набор, капа не мешает найти нужное
const MAX_VISIBLE_OPTIONS = 50;

// подсветка совпадения внутри названия опции
const highlight = (name = "", query = "") => {
  const q = query.trim();
  if (!q) return name;
  const index = name.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return name;
  return (
    <>
      {name.slice(0, index)}
      <mark>{name.slice(index, index + q.length)}</mark>
      {name.slice(index + q.length)}
    </>
  );
};

/**
 * Поле-триггер + выпадающая панель с отдельной строкой поиска.
 * Пишет выбранный id в formData по ключу `${data}_id`.
 */
function SearchableSelect({
  value,
  options = [],
  setFormData,
  onChange,
  placeholder,
  data,
  disabled,
  required,
  noMatches,
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const { panelRef, panelReady, panelStyle } = useAnchoredPanel(
    showOptions,
    triggerRef,
    options.length,
  );

  const selectedOption = useMemo(
    () => options.find((o) => sameId(o.id, value)) || null,
    [options, value],
  );

  const selectedName = selectedOption?.name || "";

  const matchedOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;

    const rank = (option) => {
      const name = option?.name?.toLowerCase() || "";
      if (name === q) return 0;
      if (name.startsWith(q)) return 1;
      return 2;
    };

    return options
      .filter(
        (option) =>
          (option?.name?.toLowerCase() || "").includes(q) ||
          (option?.categoryName?.toLowerCase() || "").includes(q),
      )
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a?.name || "").localeCompare(b?.name || "", "ru"),
      );
  }, [options, search]);

  // рендерим не весь matchedOptions, а обрезанный хвост — DOM не пухнет
  // на тысячах товаров, поиск сужает и открывает доступ к остальным
  const filteredOptions = useMemo(
    () => matchedOptions.slice(0, MAX_VISIBLE_OPTIONS),
    [matchedOptions],
  );
  const hiddenCount = matchedOptions.length - filteredOptions.length;

  const openList = () => {
    if (disabled) return;
    setSearch("");
    setShowOptions(true);
    setActiveIndex(
      selectedOption
        ? options.findIndex((o) => sameId(o.id, selectedOption.id))
        : -1,
    );
  };

  const closeList = ({ focusTrigger = false } = {}) => {
    setShowOptions(false);
    setSearch("");
    setActiveIndex(-1);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const toggleList = () => (showOptions ? closeList() : openList());

  const handleOptionClick = (option) => {
    closeList({ focusTrigger: true });
    if (onChange) {
      onChange(option.id);
    } else {
      setFormData((prev) => ({
        ...prev,
        [data + "_id"]: option.id,
      }));
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    closeList();
    if (onChange) {
      onChange("");
    } else {
      setFormData((prev) => ({
        ...prev,
        [data + "_id"]: "",
      }));
    }
  };

  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openList();
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!filteredOptions.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((prev) => {
        const next = prev + step;
        if (next < 0) return filteredOptions.length - 1;
        if (next > filteredOptions.length - 1) return 0;
        return next;
      });
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const target =
        activeIndex >= 0
          ? filteredOptions[activeIndex]
          : filteredOptions.length === 1
            ? filteredOptions[0]
            : null;
      if (target) handleOptionClick(target);
      return;
    }

    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
      closeList({ focusTrigger: e.key === "Escape" });
    }
  };

  // держим активный пункт в зоне видимости
  useEffect(() => {
    if (!showOptions || !panelReady || activeIndex < 0) return;
    listRef.current?.children?.[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, showOptions, panelReady]);

  // панель монтируется только после расчёта координат
  useEffect(() => {
    if (!showOptions || !panelReady) return;
    searchRef.current?.focus();
  }, [showOptions, panelReady]);

  useEffect(() => {
    if (!showOptions) return;
    const handleClickOutside = (e) => {
      const inTrigger = containerRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inTrigger && !inPanel) closeList();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showOptions, panelRef]);

  const rootClass = [
    styles.searchableSelect,
    showOptions ? styles.open : "",
    disabled ? styles.disabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} ref={containerRef}>
      <div className={styles.control}>
        <button
          type="button"
          ref={triggerRef}
          className={styles.trigger}
          onClick={toggleList}
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={showOptions}
        >
          <span
            className={
              selectedName ? styles.triggerValue : styles.triggerPlaceholder
            }
          >
            {selectedName || placeholder}
          </span>
        </button>

        <div className={styles.actions}>
          {!isEmpty(value) && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              className={styles.clearBtn}
              onClick={handleClear}
              aria-label="clear"
            >
              {Icons.clear}
            </button>
          )}
          <span className={styles.chevron}>{Icons.chevronDown}</span>
        </div>

        {/* нативная валидация required: кнопка её не даёт */}
        {required && (
          <input
            className={styles.validationInput}
            tabIndex={-1}
            aria-hidden="true"
            value={isEmpty(value) ? "" : String(value)}
            onChange={() => {}}
            onFocus={() => triggerRef.current?.focus()}
            required
          />
        )}
      </div>

      {showOptions && panelStyle && (
        <div ref={panelRef} className={styles.panel} style={panelStyle}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>{Icons.search}</span>
            <input
              ref={searchRef}
              type="text"
              autoComplete="off"
              className={styles.searchInput}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("search") + "..."}
            />
            {search && (
              <button
                type="button"
                tabIndex={-1}
                className={styles.searchClear}
                onClick={() => {
                  setSearch("");
                  setActiveIndex(-1);
                  searchRef.current?.focus();
                }}
                aria-label="clear search"
              >
                {Icons.clear}
              </button>
            )}
          </div>

          <ul className={styles.optionsList} ref={listRef} role="listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, i) => (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={sameId(option.id, value)}
                  className={[
                    sameId(option.id, value) ? styles.selected : "",
                    i === activeIndex ? styles.active : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => handleOptionClick(option)}
                >
                  <span className={styles.optionMain}>
                    <span className={styles.optionName}>
                      {highlight(option.name || "", search)}
                    </span>
                    {option.categoryName && (
                      <span className={styles.optionCategory}>
                        {highlight(option.categoryName, search)}
                      </span>
                    )}
                    {option.description && (
                      <span className={styles.optionDescription}>{option.description}</span>
                    )}
                  </span>
                  {sameId(option.id, value) && (
                    <span className={styles.check}>&#10003;</span>
                  )}
                </li>
              ))
            ) : (
              <li className={styles.no_matches}>
                {noMatches ?? t("noMatches")}
              </li>
            )}
          </ul>

          {hiddenCount > 0 && (
            <div className={styles.moreHint}>
              {t("searchNarrowResults", { count: hiddenCount })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
