import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icons } from "../icons/icons";

import { useOpenAddEmployee } from "../hooks/useOpenAddEmployee";
import { useOpenAddFacePassTelegram } from "../hooks/useOpenAddFacePassTelegram";

import styles from "./BottomNavTelegram.module.scss";

const MENU_ITEMS = [
  { name: "main", path: "/tg/main", icon: "main" },
  { name: "finance", path: "/tg/finance", icon: "finance" },
  { name: "tasks", path: "/tg/tasks", icon: "tasks" },
  { name: "more", path: "/tg/more", icon: "more" },
];

const FAB_ACTIONS = [
  {
    id: "add-employee",
    menuName: "employees",
    labelKey: "add_employee",
    defaultLabel: "Сотрудник",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    color: "#5b8af5",
  },
  {
    id: "add-face-pass-telegram",
    menuName: "face-passes",
    labelKey: "add-face-pass-telegram",
    defaultLabel: "Проход",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 3H5a2 2 0 0 0-2 2v4" />
        <path d="M15 3h4a2 2 0 0 1 2 2v4" />
        <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
        <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    color: "#56c98a",
  },
];

function getCanAddFromMenu(menuData, menuName) {
  const findItem = (items) => {
    for (const item of items) {
      if (item.name === menuName) return item;
      if (item.children?.length) {
        const found = findItem(item.children);
        if (found) return found;
      }
    }
    return null;
  };
  const item = findItem(menuData);
  return !!item?.permissions?.add;
}

import VConsole from "vconsole";

const vConsole = new VConsole();

export default function BottomNavTelegram({ menuData }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const navRef = useRef(null);
  const pillRef = useRef(null);
  const itemRefs = useRef([]);

  const openAddEmployee = useOpenAddEmployee();
  const openAddFacePass = useOpenAddFacePassTelegram();

  const visibleFabActions = FAB_ACTIONS.filter((action) =>
    getCanAddFromMenu(menuData, action.menuName),
  );
  const showFab = visibleFabActions.length > 0;

  const middleIndex = Math.ceil(MENU_ITEMS.length / 2);
  const leftItems = MENU_ITEMS.slice(0, middleIndex);
  const rightItems = MENU_ITEMS.slice(middleIndex);

  const isActive = (item) => location.pathname.startsWith(item.path);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    const handleViewport = () => {
      setIsKeyboardOpen(tg.viewportStableHeight - tg.viewportHeight > 100);
    };
    tg.onEvent("viewportChanged", handleViewport);
    return () => tg.offEvent("viewportChanged", handleViewport);
  }, []);

  useEffect(() => {
    setFabOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!fabOpen) return;
    const handleClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target))
        setFabOpen(false);
    };
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [fabOpen]);

  useEffect(() => {
    const activeIndex = MENU_ITEMS.findIndex(isActive);
    if (activeIndex === -1) return;
    const btn = itemRefs.current[activeIndex];
    const pill = pillRef.current;
    if (!btn || !pill) return;
    pill.style.left = `${btn.offsetLeft}px`;
    pill.style.width = `${btn.offsetWidth}px`;
  }, [location.pathname]);

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const timer = setTimeout(() => {
      pill.style.transition = "all 0.4s cubic-bezier(0.25, 1, 0.5, 1.15)";
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleNavClick = (item) => {
    if (fabOpen) {
      setFabOpen(false);
      return;
    }
    if (isActive(item)) {
      const container = document.getElementById("scroll-container");
      container
        ? container.scrollTo({ top: 0, behavior: "smooth" })
        : window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(item.path);
    }
  };

  const handleFabAction = (actionId) => {
    setFabOpen(false);
    if (actionId === "add-employee") openAddEmployee();
    else if (actionId === "add-face-pass-telegram") openAddFacePass();
  };

  if (isKeyboardOpen) return null;

  const renderNavItem = (item, index) => {
    const Icon = Icons[item.icon] || Icons.default;
    const active = isActive(item);
    return (
      <button
        key={item.path}
        ref={(el) => (itemRefs.current[index] = el)}
        className={`${styles.navItem} ${active ? styles.active : ""}`}
        onClick={() => handleNavClick(item)}
      >
        <span className={styles.icon}>{Icon}</span>
        <span className={styles.label}>{t(item.name)}</span>
      </button>
    );
  };

  return (
    <>
      <div
        className={`${styles.backdrop} ${fabOpen ? styles.backdropVisible : ""}`}
        onPointerDown={() => setFabOpen(false)}
      />

      <nav className={styles.bottomNav} ref={navRef}>
        <div
          className={`${styles.fabMenu} ${fabOpen ? styles.fabMenuOpen : ""}`}
        >
          {visibleFabActions.map((action, i) => (
            <button
              key={action.id}
              className={styles.fabMenuItem}
              style={{ "--item-index": i, "--item-color": action.color }}
              onClick={() => handleFabAction(action.id)}
            >
              <span className={styles.fabMenuIcon}>{action.icon}</span>
              <span className={styles.fabMenuLabel}>
                {t(action.labelKey, action.defaultLabel)}
              </span>
            </button>
          ))}
        </div>

        {leftItems.map((item, i) => renderNavItem(item, i))}

        {showFab && (
          <button
            className={`${styles.fab} ${fabOpen ? styles.fabActive : ""}`}
            onClick={() => setFabOpen((v) => !v)}
            aria-label="Добавить"
            aria-expanded={fabOpen}
          >
            <span className={styles.fabIcon}>{Icons.plus}</span>
          </button>
        )}

        {rightItems.map((item, i) => renderNavItem(item, i + leftItems.length))}
      </nav>
    </>
  );
}
