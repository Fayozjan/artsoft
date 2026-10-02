import { NavLink, useLocation, matchPath } from "react-router-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "../icons/icons";
import styles from "./Sidebar.module.scss";
import { useTranslation } from "react-i18next";

const SidebarItem = ({ item, type, toggleItem, isSubItemOpen }) => {
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;
  const Icon = Icons[item.name] || Icons.default;
  const { t, i18n } = useTranslation();
  const liRef = useRef(null);
  const popupRef = useRef(null);
  const closeTimer = useRef(null);

  // Мини-режим: попап детей рисуется порталом в body (у .menu стоит
  // will-change: transform — это ломает position: fixed внутри него,
  // "fixed" начинает считаться от .menu, а не от окна). Открытие/закрытие —
  // React-стейтом с небольшой задержкой на закрытие, а не CSS :hover
  // (после портала DOM-родства с <li> у попапа больше нет — :hover не сработает,
  // и мышь на пути от иконки к попапу не будет ловить "мёртвую зону").
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState(null);

  const usesPortalPopup = type === "mini" && hasChildren;

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openPopup = () => {
    if (!usesPortalPopup) return;
    clearCloseTimer();
    setPopupOpen(true);
  };

  const scheduleClosePopup = () => {
    if (!usesPortalPopup) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setPopupOpen(false), 150);
  };

  useEffect(() => clearCloseTimer, []);

  // Приоритет — вниз от иконки; не влезает вниз → вверх; попап это fixed-оверлей,
  // низ иконки ему ничего не должен, поэтому "вверх" считаем не от иконки,
  // а как почти весь экран (viewportHeight - 2*GAP) — иначе место НИЖЕ иконки
  // простаивает без дела, а список скроллится хотя место есть.
  // Не влезает и в весь экран → скролл внутри (overflow-y:auto).
  useLayoutEffect(() => {
    if (!popupOpen || !liRef.current || !popupRef.current) return;

    const rect = liRef.current.getBoundingClientRect();
    const GAP = 8;
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.top - GAP;
    const fullBudget = viewportH - 2 * GAP;
    const neededHeight = popupRef.current.scrollHeight;

    const height = Math.max(120, Math.min(neededHeight, fullBudget));

    let top;
    if (neededHeight <= spaceBelow) {
      top = rect.top; // помещается вниз от иконки как обычно
    } else {
      top = rect.bottom - height; // пробуем открыть вверх, прижав низ к иконке
      top = Math.max(GAP, Math.min(top, viewportH - GAP - height)); // клампим в экран целиком
    }

    setPopupStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${rect.right + GAP}px`,
      maxHeight: `${height}px`,
      opacity: 1,
      pointerEvents: "auto",
    });
  }, [popupOpen]);

  const handleClick = (e) => {
    if (hasChildren) {
      e.preventDefault();
      toggleItem(item.id);
    }
    setPopupOpen(false);
  };

  const isActivePath = (path) => {
    return matchPath({ path, end: false }, location.pathname);
  };

  const renderMiniPopup = () => {
    if (type !== "mini" && type !== "top") return null;

    if (!hasChildren) {
      // В горизонтальном режиме подпись уже видна — тултип не нужен
      if (type === "top") return null;

      return (
        <div className={styles.miniPopupWrapper}>
          <p style={{ borderBottom: "none", marginBottom: 0 }}>
            {t(item.name)}
          </p>
        </div>
      );
    }

    // Горизонтальный режим — попап остаётся на месте, CSS :hover как раньше
    if (type === "top") {
      return (
        <div className={styles.miniPopupWrapper}>
          <p>{t(item.name)}</p>
          <ul className={styles.miniPopup}>
            {item.children
              .filter((child) => child.permissions?.view)
              .map((child) => {
                const isChildActive = isActivePath(child.path);

                return (
                  <li key={child.id}>
                    <NavLink
                      to={child.path}
                      className={isChildActive ? styles.active : ""}
                    >
                      <span>{t(child.name)}</span>
                    </NavLink>
                  </li>
                );
              })}
          </ul>
        </div>
      );
    }

    if (!popupOpen) return null;

    return createPortal(
      <div
        className={styles.miniPopupWrapper}
        ref={popupRef}
        style={popupStyle ?? { opacity: 0, pointerEvents: "none" }}
        onMouseEnter={openPopup}
        onMouseLeave={scheduleClosePopup}
      >
        <p>{t(item.name)}</p>
        <ul className={styles.miniPopup}>
          {item.children
            .filter((child) => child.permissions?.view)
            .map((child) => {
              const isChildActive = isActivePath(child.path);

              return (
                <li key={child.id}>
                  <NavLink
                    to={child.path}
                    className={isChildActive ? styles.active : ""}
                    onClick={() => setPopupOpen(false)}
                  >
                    <span>{t(child.name)}</span>
                  </NavLink>
                </li>
              );
            })}
        </ul>
      </div>,
      document.body,
    );
  };

  const renderSubmenu = useMemo(() => {
    if (!hasChildren || type === "mini" || type === "top") return null;

    return (
      <ul className={styles.submenuWrapper}>
        {item.children
          .filter((child) => child.permissions?.view)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((child) => {
            const isChildActive = isActivePath(child.path);

            return (
              <li
                key={child.id}
                className={isChildActive ? styles.activeMenu : ""}
              >
                <NavLink
                  to={child.path}
                  className={({ isActive }) => (isActive ? styles.active : "")}
                >
                  <span>{t(child.name)}</span>
                </NavLink>
              </li>
            );
          })}
      </ul>
    );
  }, [hasChildren, type, item.children, location.pathname, i18n.language]);

  const isParentActive =
    isActivePath(item.path) ||
    (hasChildren && item.children.some((child) => isActivePath(child.path)));

  const menuClasses = [
    styles.menu,
    isParentActive ? styles.activeMenu : "",
    hasChildren ? styles.menuItemHasChildren : "",
    isSubItemOpen ? styles.openSubmenu : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      className={menuClasses}
      ref={liRef}
      onMouseEnter={openPopup}
      onMouseLeave={scheduleClosePopup}
    >
      <NavLink
        to={hasChildren ? "#" : item.path}
        onClick={handleClick}
        className={({ isActive }) =>
          isActive && !hasChildren ? styles.active : ""
        }
      >
        {Icon}
        {(type === "full" || type === "top") && <span>{t(item.name)}</span>}
      </NavLink>

      {(type === "mini" || type === "top") && renderMiniPopup()}
      {type === "full" && renderSubmenu}
    </li>
  );
};

export default SidebarItem;
