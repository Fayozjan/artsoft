import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, X } from "lucide-react";

import styles from "./UserAccessCards.module.scss";

// Кнопка в форме логина + сайдбар слева от формы (портал в leftPanel у OverlaySidebar).
// Состояние остаётся в форме, сайдбар только показывает его.
// panel = { host, isOpen, isCurrent, toggle, close }:
//   isOpen — кнопка нажата, isCurrent — сайдбар занят этим содержимым (живёт до конца
//   анимации закрытия, пока в host ещё есть что показывать).
// Без panel (форма вне OverlaySidebar) содержимое показывается прямо в форме.
const UserSidePanel = ({ panel, icon: Icon, title, hint, children }) => {
  const { t } = useTranslation();

  // Форма закрылась / блок пропал (уровень доступа «сотрудник») — сайдбар не нужен
  useEffect(() => () => panel?.close(), []);

  if (!panel) return children;

  return (
    <>
      <div className={styles.triggerWrap}>
        <button
          type="button"
          className={`${styles.trigger} ${panel.isOpen ? styles.triggerActive : ""}`}
          aria-expanded={panel.isOpen}
          onClick={panel.toggle}
        >
          <span className={styles.cardIcon}>
            <Icon size={16} />
          </span>
          <span className={styles.triggerText}>
            <b>{title}</b>
            <small>{hint}</small>
          </span>
          <ChevronLeft size={16} className={styles.triggerArrow} />
        </button>
      </div>

      {panel.host &&
        panel.isCurrent &&
        createPortal(
          <div className={styles.panel}>
            <header className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>{title}</h3>
              <button
                type="button"
                className={styles.panelClose}
                onClick={panel.close}
                aria-label={t("close")}
                title={t("close")}
              >
                <X size={16} />
              </button>
            </header>
            <div className={styles.panelBody}>{children}</div>
          </div>,
          panel.host,
        )}
    </>
  );
};

export default UserSidePanel;
