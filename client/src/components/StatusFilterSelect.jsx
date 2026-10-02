import { useState } from "react";

import TgSheet from "./tg/TgSheet";
import { IconChevronDown, IconCheck } from "./tg/tgIcons";
import styles from "./StatusFilterSelect.module.scss";

// Фильтр по статусу в Telegram: кнопка с текущим значением открывает нижнюю шторку
// со списком. options: [{ value, label, count?, color? }] — color (hex) красит точку
// и выбранное значение; у пункта «Все» цвета нет. Первый пункт — значение по умолчанию.
const StatusFilterSelect = ({ value, onChange, options = [], title }) => {
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value) || options[0];
  const toneStyle = (option) =>
    option?.color ? { "--tone": option.color, "--tone-bg": `${option.color}22` } : undefined;

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${selected?.color ? styles.triggerTone : ""}`}
        style={toneStyle(selected)}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {selected?.color && <span className={styles.dot} />}
        <span className={styles.triggerText}>{selected?.label}</span>
        {selected?.count !== undefined && <b className={styles.count}>{selected.count}</b>}
        <span className={styles.chevron}>
          <IconChevronDown />
        </span>
      </button>

      <TgSheet isOpen={open} onClose={() => setOpen(false)} title={title}>
        <div className={styles.list} role="listbox">
          {options.map((option) => {
            const active = option.value === selected?.value;
            return (
              <button
                key={option.value || "all"}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.option} ${option.color ? styles.optionTone : ""} ${active ? styles.optionActive : ""}`}
                style={toneStyle(option)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className={styles.optionDot}>{option.color && <span className={styles.dot} />}</span>
                <span className={styles.optionLabel}>{option.label}</span>
                {option.count !== undefined && <b className={styles.count}>{option.count}</b>}
                <span className={styles.optionCheck}>{active && <IconCheck />}</span>
              </button>
            );
          })}
        </div>
      </TgSheet>
    </>
  );
};

export default StatusFilterSelect;
