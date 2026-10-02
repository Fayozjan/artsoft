import { useState, useEffect, useRef } from "react";
import styles from "./ScanModeSelect.module.scss";

// Один селект вместо переключателя режимов и кнопки "Объединение" (верхняя
// строка приёма работы). options: [{ value, label, hint?, disabled?, accent? }];
// accent — режим, который стоит выделять, когда он выбран (объединение).
// Список — fixed, чтобы залипающая верхняя строка не обрезала его.
const ScanModeSelect = ({ value, onChange, options = [] }) => {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, minWidth: 0 });
  const ref = useRef();
  const triggerRef = useRef();

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 6, left: rect.left, minWidth: rect.width });
  }, [open]);

  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div ref={ref} className={styles.modeSelect}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${selected?.accent ? styles.triggerAccent : ""} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Все подписи лежат в одной ячейке грида, видна только выбранная: ширина
            кнопки = самая длинная подпись, не прыгает при смене режима. */}
        <span className={styles.triggerText}>
          {options.map((option) => (
            <span key={option.value} className={option.value === selected?.value ? undefined : styles.triggerGhost}>
              {option.label}
            </span>
          ))}
        </span>
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className={styles.dropdown}
          style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            minWidth: dropPos.minWidth,
            width: "max-content",
            maxWidth: "calc(100vw - 16px)",
            zIndex: 1400,
          }}
        >
          <div className={styles.list}>
            {options.map((option) => {
              const active = option.value === selected?.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  disabled={option.disabled}
                  title={option.hint}
                  className={`${styles.item} ${active ? styles.itemActive : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className={styles.itemName}>{option.label}</span>
                  {active && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="5 12 10 17 19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanModeSelect;
