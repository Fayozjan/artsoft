import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import styles from "./SuggestInput.module.scss";

const MAX_ITEMS = 8;

const IconHistory = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l3 2" />
  </svg>
);

// Подсвечивает совпавшую часть подсказки
const highlightMatch = (option, query) => {
  if (!query) return option;
  const idx = option.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return option;
  return (
    <>
      {option.slice(0, idx)}
      <b>{option.slice(idx, idx + query.length)}</b>
      {option.slice(idx + query.length)}
    </>
  );
};

// Инпут со списком ранее введённых значений (подсказки, но можно вписать своё)
const SuggestInput = ({
  value = "",
  onChange,
  options = [],
  placeholder,
  className,
  inputProps = {},
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    const list = query
      ? options.filter((o) => o.toLowerCase().includes(query))
      : options;
    // точное совпадение подсказывать нечего
    return list.filter((o) => o.toLowerCase() !== query);
  }, [options, value]);

  const visible = matches.slice(0, MAX_ITEMS);

  useEffect(() => {
    // выпадашка живёт в портале — проверяем и её, иначе она закроется
    // на mousedown раньше, чем по пункту долетит click
    const onMouseDown = (e) => {
      const insideWrapper = wrapperRef.current?.contains(e.target);
      const insideDropdown = dropdownRef.current?.contains(e.target);
      if (!insideWrapper && !insideDropdown) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const updatePos = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const pick = (option) => {
    onChange(option);
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e) => {
    if (!visible.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => (i + 1) % visible.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => (i <= 0 ? visible.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && highlighted >= 0) {
      e.preventDefault();
      pick(visible[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
    }
  };

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        className={className}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlighted(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {open &&
        visible.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className={styles.dropdown}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 1500,
            }}
          >
            <div className={styles.list}>
              {visible.map((option, i) => (
                <div
                  key={option}
                  className={`${styles.item} ${i === highlighted ? styles.active : ""}`}
                  onMouseEnter={() => setHighlighted(i)}
                  onMouseDown={(e) => {
                    // выбираем на mousedown: до mouseup список уже закрыт
                    e.preventDefault();
                    pick(option);
                  }}
                >
                  <span className={styles.itemIcon}>{IconHistory}</span>
                  {/* текст одним flex-элементом, иначе gap рвёт слово на части */}
                  <span className={styles.itemText}>
                    {highlightMatch(option, value.trim())}
                  </span>
                </div>
              ))}
            </div>
            {matches.length > visible.length && (
              <div className={styles.hint}>
                {t("shownOfTotal", { shown: visible.length, total: matches.length })}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default SuggestInput;
