import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Icons } from "../icons/icons";
import styles from "./OnScreenKeyboard.module.scss";

const LAYOUTS = {
  en: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ],
  ru: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Й", "Ц", "У", "К", "Е", "Н", "Г", "Ш", "Щ", "З", "Х"],
    ["Ф", "Ы", "В", "А", "П", "Р", "О", "Л", "Д", "Ж", "Э"],
    ["Я", "Ч", "С", "М", "И", "Т", "Ь", "Б", "Ю"],
  ],
};

// preventDefault на mousedown не даёт кнопке забрать фокус у активного
// поля — иначе некуда было бы вставлять символы.
const keepFocus = (e) => e.preventDefault();

const OnScreenKeyboard = ({ onChar, onBackspace, onSpace, onEnter, onClose }) => {
  const { t } = useTranslation();
  const [shift, setShift] = useState(true);
  const [lang, setLang] = useState("en");

  const rows = LAYOUTS[lang];

  return (
    <div className={styles.keyboard}>
      <div className={styles.keyboardHeader}>
        <span>{t("onScreenKeyboard")}</span>
        <button type="button" className={styles.closeBtn} onMouseDown={keepFocus} onClick={onClose}>
          ×
        </button>
      </div>

      {rows.map((row, i) => (
        <div key={i} className={styles.row}>
          {row.map((key) => {
            const ch = shift ? key : key.toLowerCase();
            return (
              <button
                key={key}
                type="button"
                className={styles.key}
                onMouseDown={keepFocus}
                onClick={() => onChar(ch)}
              >
                {ch}
              </button>
            );
          })}
        </div>
      ))}

      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.key} ${styles.wide}`}
          onMouseDown={keepFocus}
          onClick={() => setLang((v) => (v === "en" ? "ru" : "en"))}
        >
          {lang === "en" ? "RU" : "EN"}
        </button>
        <button
          type="button"
          className={`${styles.key} ${styles.wide} ${shift ? styles.keyActive : ""}`}
          onMouseDown={keepFocus}
          onClick={() => setShift((v) => !v)}
          title="Caps Lock"
        >
          {Icons.capsLock}
        </button>
        <button type="button" className={styles.key} onMouseDown={keepFocus} onClick={() => onChar("-")}>
          -
        </button>
        <button type="button" className={styles.key} onMouseDown={keepFocus} onClick={() => onChar("/")}>
          /
        </button>
        <button type="button" className={styles.key} onMouseDown={keepFocus} onClick={() => onChar(".")}>
          .
        </button>
        <button
          type="button"
          className={`${styles.key} ${styles.wide}`}
          onMouseDown={keepFocus}
          onClick={onBackspace}
          title="Backspace"
        >
          {Icons.backspace}
        </button>
      </div>

      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.key} ${styles.space}`}
          onMouseDown={keepFocus}
          onClick={onSpace}
        >
          {t("space")}
        </button>
        <button
          type="button"
          className={`${styles.key} ${styles.wide}`}
          onMouseDown={keepFocus}
          onClick={onEnter}
        >
          Enter
        </button>
      </div>
    </div>
  );
};

export default OnScreenKeyboard;
