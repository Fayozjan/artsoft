import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icons } from "../icons/icons";

import styles from "./BottomNavTelegram.module.scss";

const MENU_ITEMS = [
  { name: "home", path: "/tg/home", icon: "homeTelegram" },
  { name: "tasks", path: "/tg/tasks", icon: "tasks" },
  { name: "menu", path: "/tg/menu", icon: "more" },
  // у иконки settings нет внутренних отступов viewBox — без compact выглядит крупнее остальных
  { name: "settings", path: "/tg/settings", icon: "settings", compact: true },
];

export default function BottomNavTelegram() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const navRef = useRef(null);
  const pillRef = useRef(null);
  const itemRefs = useRef([]);

  const activeIndex = MENU_ITEMS.findIndex((item) =>
    location.pathname.startsWith(item.path),
  );

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    const handleViewport = () => {
      setIsKeyboardOpen(tg.viewportStableHeight - tg.viewportHeight > 100);
    };
    tg.onEvent("viewportChanged", handleViewport);
    return () => tg.offEvent("viewportChanged", handleViewport);
  }, []);

  // Ставит подсветку под активную кнопку. Первый раз — без анимации.
  const placePill = (animate) => {
    const pill = pillRef.current;
    const btn = itemRefs.current[activeIndex];
    if (!pill) return;
    if (!btn) {
      pill.style.opacity = "0";
      return;
    }
    if (!animate) pill.style.transition = "none";
    pill.style.opacity = "1";
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.height = `${btn.offsetHeight}px`;
    pill.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    if (!animate) {
      void pill.offsetWidth;
      pill.style.transition = "";
    }
  };

  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    placePill(pill.dataset.placed === "1");
    pill.dataset.placed = "1";
  }, [activeIndex, isKeyboardOpen]);

  // Публикуем высоту меню (с учётом safe-area) для страниц с плавающими элементами
  // и пересчитываем подсветку при смене размера / ориентации.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    let first = true;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--tg-nav-height", `${nav.offsetHeight}px`);
      if (first) {
        first = false;
        return;
      }
      placePill(false);
    });
    observer.observe(nav);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--tg-nav-height");
    };
  }, [isKeyboardOpen, activeIndex]);

  const handleNavClick = (item, active) => {
    if (active) {
      const container = document.getElementById("scroll-container");
      container
        ? container.scrollTo({ top: 0, behavior: "smooth" })
        : window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(item.path);
    }
  };

  // «Меню» открывается как экран с системной «Назад» — нижний таб-бар не нужен.
  if (isKeyboardOpen || location.pathname.startsWith("/tg/menu")) return null;

  return (
    <nav ref={navRef} className={styles.bottomNav}>
      <span ref={pillRef} className={styles.pill} aria-hidden="true" />
      {MENU_ITEMS.map((item, index) => {
        const Icon = Icons[item.icon] || Icons.default;
        const active = index === activeIndex;
        return (
          <button
            key={item.path}
            type="button"
            ref={(el) => (itemRefs.current[index] = el)}
            className={`${styles.navItem} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => handleNavClick(item, active)}
          >
            <span
              className={`${styles.icon} ${item.compact ? styles.iconCompact : ""}`}
            >
              {Icon}
            </span>
            <span className={styles.label}>{t(item.name)}</span>
          </button>
        );
      })}
    </nav>
  );
}
