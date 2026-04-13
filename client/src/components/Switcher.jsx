import { useState, useRef, useEffect } from "react";
import styles from "./Switcher.module.scss";
import { Icons } from "../icons/icons";
import { t } from "i18next";

export const Switcher = ({ items = [], activeItem, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setExpanded(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={styles.switcher} ref={ref}>
      <button
        className={styles.switcherCurrent}
        onClick={() => setExpanded((p) => !p)}
      >
        <span className={styles.currentLabel}>{t(activeItem) ?? "—"}</span>
        <span className={styles.arrows}>{Icons.selectArrows}</span>
      </button>

      {expanded && (
        <ul className={styles.switcherList}>
          {items.map((item) => {
            const isActive = item === activeItem;
            return (
              <li key={item}>
                <button
                  className={`${styles.switcherItem} ${isActive ? styles.active : ""}`}
                  onClick={() => {
                    onSelect(item);
                    setExpanded(false);
                  }}
                >
                  {t(item)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
