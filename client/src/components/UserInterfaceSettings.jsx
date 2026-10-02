import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Monitor } from "lucide-react";

import { DEFAULT_START_PAGE } from "../stores/authStore";

import styles from "./UserAccessCards.module.scss";

const POSITIONS = [
  { value: "left", labelKey: "sidebarPositionLeft" },
  { value: "top", labelKey: "sidebarPositionTop" },
  { value: "hidden", labelKey: "sidebarPositionHidden" },
];

// Схематичный экран: где стоит меню
const PositionPreview = ({ position }) => (
  <span
    className={`${styles.preview} ${styles[`preview_${position}`]}`}
    aria-hidden="true"
  >
    <span className={styles.previewBar} />
    <span className={styles.previewPage}>
      <i />
      <i />
      <i />
    </span>
  </span>
);

// Интерфейс логина: расположение меню и страница, которая открывается после входа.
// value = { sidebarPosition, startPage }; ready — список меню уже загружен.
const UserInterfaceSettings = ({ value, onChange, startPageOptions, ready }) => {
  const { t } = useTranslation();
  const { sidebarPosition, startPage } = value;

  const hasStartPage = startPageOptions.some((option) => option.path === startPage);

  // Доступ к сохранённой странице отозвали — откатываемся на главную
  useEffect(() => {
    if (ready && !hasStartPage) onChange({ ...value, startPage: DEFAULT_START_PAGE });
  }, [ready, hasStartPage]);

  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.cardIcon}>
          <Monitor size={16} />
        </span>
        <div>
          <h3 className={styles.cardTitle}>{t("userInterfaceTitle")}</h3>
          <p className={styles.cardHint}>{t("userInterfaceHint")}</p>
        </div>
      </header>

      <div className={styles.cardBody}>
        <div className={styles.block}>
          <span className={styles.blockTitle}>{t("sidebarPosition")}</span>
          <div className={styles.tiles} role="radiogroup">
            {POSITIONS.map(({ value: position, labelKey }) => {
              const active = sidebarPosition === position;
              return (
                <label
                  key={position}
                  className={`${styles.tile} ${active ? styles.tileActive : ""}`}
                >
                  <input
                    type="radio"
                    name="user-sidebar-position"
                    className={styles.srOnly}
                    checked={active}
                    onChange={() => onChange({ ...value, sidebarPosition: position })}
                  />
                  <PositionPreview position={position} />
                  <span className={styles.tileLabel}>{t(labelKey)}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className={styles.block}>
          <span className={styles.blockTitle}>{t("startPage")}</span>
          <select
            value={hasStartPage ? startPage : DEFAULT_START_PAGE}
            onChange={(e) => onChange({ ...value, startPage: e.target.value })}
          >
            {startPageOptions.map(({ path, label }) => (
              <option key={path} value={path}>
                {label}
              </option>
            ))}
          </select>
          <p className={styles.blockHint}>{t("startPageHint")}</p>
        </div>
      </div>
    </section>
  );
};

export default UserInterfaceSettings;
