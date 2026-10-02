import { useState, useEffect, useRef } from "react";
import TgSheet from "./tg/TgSheet";
import styles from "./TeamSelect.module.scss";

// Телефон (Telegram): список — нижней шторкой (TgSheet, портал в body), а не fixed-выпадашкой:
// экраны Telegram лежат в обёртке с transform/overflow (ScreenStackRenderer), и fixed внутри
// неё привязан к обёртке — выпадашка съезжает. Подробнее — в EmployeeSelect.
const isPhone = () => Boolean(window.matchMedia?.("(max-width: 640px)").matches);

// Выпадашка выбора команды (форма приёма работы). teams: [{ id, name }]. Список — fixed,
// чтобы не обрезался прокруткой карточки; закрывается кликом снаружи, выбор — по клику на строку.
const TeamSelect = ({ value, onChange, teams = [], placeholder }) => {
  const [open, setOpen] = useState(false);
  // Режим фиксируется при открытии: шторка на телефоне, выпадашка на ПК.
  const [sheetMode, setSheetMode] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef();
  const triggerRef = useRef();

  useEffect(() => {
    if (!open || sheetMode) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, sheetMode]);

  useEffect(() => {
    if (!open || sheetMode) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 240) });
  }, [open, sheetMode]);

  const toggle = () => {
    setSheetMode(isPhone());
    setOpen((v) => !v);
  };

  const selected = teams.find((team) => String(team.id) === String(value));

  const list = (
    <div className={styles.list}>
      {teams.map((team) => {
        const active = String(team.id) === String(value);
        return (
          <button
            type="button"
            key={team.id}
            className={`${styles.item} ${active ? styles.itemActive : ""}`}
            onClick={() => {
              onChange(team.id);
              setOpen(false);
            }}
          >
            <span className={styles.itemName}>{team.name}</span>
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
  );

  return (
    <div ref={ref} className={styles.teamSelect}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${selected ? styles.triggerSelected : ""} ${open ? styles.triggerOpen : ""}`}
        onClick={toggle}
      >
        <span className={styles.triggerText}>{selected ? selected.name : placeholder}</span>
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

      {open && !sheetMode && (
        <div
          className={styles.dropdown}
          style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 1400 }}
        >
          {list}
        </div>
      )}

      {sheetMode && (
        // Клики из портала по дереву React всплывают к предкам (форма) — гасим здесь.
        <div onClick={(e) => e.stopPropagation()}>
          <TgSheet isOpen={open} onClose={() => setOpen(false)} title={placeholder}>
            <div className={styles.sheetList}>{list}</div>
          </TgSheet>
        </div>
      )}
    </div>
  );
};

export default TeamSelect;
