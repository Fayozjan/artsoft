import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
} from "lucide-react";

import { getMenuIcon } from "../icons/menuIcons";

import styles from "./PageHeader.module.scss";

// Плитка меню: значок как в сайдбаре + подпись под ним
const MenuTile = ({ item, isActive, onNavigate }) => {
  const { t } = useTranslation();

  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      className={`${styles.tile} ${isActive ? styles.tileActive : ""}`}
    >
      <span className={styles.tileIcon}>{getMenuIcon(item.name)}</span>
      <span className={styles.tileLabel}>{t(item.name)}</span>
    </Link>
  );
};

const PageHeader = ({ menuData, currentMenu, widgetsVisible, toggleWidgets }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  // Кнопка «Назад» переключает панель с подстраниц на основные разделы
  const [showRoot, setShowRoot] = useState(false);
  const headerRef = useRef(null);

  const { foundMenu, foundSubmenu } = currentMenu || {};

  const rootItems = useMemo(
    () =>
      (menuData || [])
        .filter((item) => item.permissions?.view)
        .sort((a, b) => a.sort_order - b.sort_order),
    [menuData],
  );

  const childItems = useMemo(
    () =>
      (foundMenu?.children || [])
        .filter((child) => child.permissions?.view)
        .sort((a, b) => a.sort_order - b.sort_order),
    [foundMenu],
  );

  // У раздела без подстраниц показываем разделы верхнего уровня — тупика нет
  const canGoBack = childItems.length > 0 && !showRoot;
  const panelItems = canGoBack ? childItems : rootItems;
  const panelTitle = canGoBack ? t(foundMenu.name) : t("sections");

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = () => {
    // Сбрасываем при открытии, а не при закрытии — иначе содержимое
    // мигает во время анимации закрытия
    if (!isOpen) setShowRoot(false);
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    close();
  }, [location.pathname, close]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointer = (e) => {
      if (!headerRef.current?.contains(e.target)) close();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, close]);

  return (
    <header className={styles.header} ref={headerRef}>
      <div className={styles.bar}>
        {/* Вся хлебная крошка — одна кнопка */}
        <button
          type="button"
          className={`${styles.crumb} ${isOpen ? styles.crumbOpen : ""}`}
          onClick={toggle}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <span className={styles.crumbIcon}>
            {getMenuIcon(foundMenu?.name, 16)}
          </span>

          <span className={styles.crumbPath}>
            <span
              className={`${styles.crumbParent} ${
                !foundSubmenu ? styles.crumbParentLeaf : ""
              }`}
            >
              {foundMenu ? t(foundMenu.name) : t("home")}
            </span>
            {foundSubmenu && (
              <>
                <ChevronRight size={13} className={styles.sep} />
                <span className={styles.crumbCurrent}>
                  {t(foundSubmenu.name)}
                </span>
              </>
            )}
          </span>

          <ChevronDown size={14} className={styles.chevron} />
        </button>

        <button
          type="button"
          className={styles.widgetsToggle}
          onClick={toggleWidgets}
          title={widgetsVisible ? t("hideWidgets") : t("showWidgets")}
          aria-label={widgetsVisible ? t("hideWidgets") : t("showWidgets")}
          aria-pressed={widgetsVisible}
        >
          {widgetsVisible ? <LayoutList size={15} /> : <LayoutGrid size={15} />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && panelItems.length > 0 && (
          <>
            <motion.div
              className={styles.scrim}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={close}
            />
            <motion.div
              className={styles.panel}
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className={styles.panelHead}>
                {canGoBack && (
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => setShowRoot(true)}
                  >
                    <ChevronLeft size={14} />
                    {t("back")}
                  </button>
                )}
                <div className={styles.panelTitle}>{panelTitle}</div>
              </div>
              <div className={styles.grid}>
                {panelItems.map((item) => (
                  <MenuTile
                    key={item.id}
                    item={item}
                    isActive={location.pathname.startsWith(item.path)}
                    onNavigate={close}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default PageHeader;
