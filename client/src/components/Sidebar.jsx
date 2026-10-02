import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import SidebarItem from "./SidebarItem";
import Profile from "./Profile";
import { Icons } from "../icons/icons";

import { BranchSwitcher } from "./BranchSwitcher";

import styles from "./Sidebar.module.scss";

const Sidebar = ({ menuData }) => {
  const { t } = useTranslation();
  const userSettings = useAuthStore((state) => state.userSettings);
  const access = useAuthStore((state) => state.access);
  const setSidebarState = useAuthStore((state) => state.setSidebarState);
  const setActiveBranch = useAuthStore((s) => s.setActiveBranch);

  const {
    sidebar: isOpen,
    viewMode,
    activeBranchId,
    sidebarPosition,
  } = userSettings;
  const branches = access?.branches ?? [];
  const activeBranch = branches.find((b) => b.id === activeBranchId);

  const isTop = sidebarPosition === "top";
  // Скрытое меню — выезжающая панель поверх страницы, всегда развёрнутая
  const isHidden = sidebarPosition === "hidden";
  const expanded = isHidden || isOpen;

  const [openItems, setOpenItems] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Горизонтальный режим: ФИО с должностью показываем, только если хватает места
  const barRef = useRef(null);
  const menuRef = useRef(null);
  const [showProfileInfo, setShowProfileInfo] = useState(false);

  const location = useLocation();

  const toggleSidebar = () => setSidebarState(!isOpen);

  const toggleItem = useCallback((id) => {
    setOpenItems((prev) => {
      if (prev[id]) {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      }
      return { [id]: true };
    });
  }, []);

  useEffect(() => {
    const newOpenItems = {};

    const checkNode = (items) => {
      let isAnyChildActive = false;

      items.forEach((item) => {
        const hasChildren = item.children?.length > 0;
        // Элемент активен, если путь совпадает или это префикс (для вложенности)
        const isCurrentActive = location.pathname.startsWith(item.path);

        if (hasChildren) {
          const isChildActive = checkNode(item.children);
          if (isChildActive || isCurrentActive) {
            newOpenItems[item.id] = true;
            isAnyChildActive = true;
          }
        } else if (isCurrentActive) {
          isAnyChildActive = true;
        }
      });

      return isAnyChildActive;
    };

    checkNode(menuData);
    setOpenItems(newOpenItems);
  }, [location.pathname, menuData]);

  // Панель закрывается при переходе, смене режима и по Escape
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, isHidden]);

  useEffect(() => {
    if (!drawerOpen) return;

    const handleKey = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [drawerOpen]);

  useLayoutEffect(() => {
    if (!isTop) {
      setShowProfileInfo(false);
      return;
    }

    const menu = menuRef.current;
    if (!menu) return;

    // Порог показа заведомо больше ширины блока с ФИО — исключает дрожание
    const SHOW_AT = 210;
    const HIDE_AT = 8;
    const GAP = 1;

    const measure = () => {
      const items = Array.from(menu.children);
      const itemsWidth =
        items.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) +
        Math.max(0, items.length - 1) * GAP;
      const free = menu.clientWidth - itemsWidth;

      // Обрезанная подпись пункта — места точно нет
      const truncated = Array.from(menu.querySelectorAll("a > span")).some(
        (el) => el.scrollWidth > el.clientWidth + 1,
      );

      setShowProfileInfo((prev) =>
        truncated ? false : free >= (prev ? HIDE_AT : SHOW_AT),
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(menu);
    if (barRef.current) observer.observe(barRef.current);

    return () => observer.disconnect();
  }, [isTop, menuData]);

  // В горизонтальном режиме пункты всегда с подписями, подменю — выпадающее
  const itemType = isTop ? "top" : expanded ? "full" : "mini";

  const renderedMenuItems = useMemo(() => {
    return menuData
      .filter((item) => item.permissions?.view)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => (
        <SidebarItem
          key={item.id}
          item={item}
          type={itemType}
          toggleItem={toggleItem}
          isSubItemOpen={!!openItems[item.id]}
          openItems={openItems}
        />
      ));
  }, [menuData, itemType, openItems, location.pathname, toggleItem]);

  const positionClass = isTop
    ? styles.top
    : isHidden
      ? styles.drawer
      : styles.left;

  const sidebarClasses = [
    styles.sidebar,
    positionClass,
    isHidden && drawerOpen ? styles.drawerOpen : "",
    isTop ? "" : expanded ? styles.open : styles.closed,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {isHidden && (
        <>
          <button
            type="button"
            className={styles.drawerHandle}
            onClick={() => setDrawerOpen(true)}
            aria-label={t("showMenu")}
            title={t("showMenu")}
          >
            {Icons.sidebarToggle}
          </button>
          {drawerOpen && (
            <div
              className={styles.drawerBackdrop}
              onClick={() => setDrawerOpen(false)}
            />
          )}
        </>
      )}

      <div className={sidebarClasses} ref={barRef}>
        <div className={styles.sidebarTop}>
          {(expanded || isTop) && (
            <Link to="/home" className={styles.logoWrapper}>
              <img src="/logo.png" alt="" className={styles.logo} />
              <span>OnBase</span>
            </Link>
          )}

          {!isTop && !isHidden && (
            <span className={styles.toggle} onClick={toggleSidebar}>
              {Icons.sidebarToggle}
            </span>
          )}
        </div>

        {viewMode === "branch" && branches?.length > 0 && (
          <BranchSwitcher
            branches={branches}
            activeBranch={activeBranch}
            activeBranchId={activeBranchId}
            onSelect={setActiveBranch}
            isOpen={isTop ? true : expanded}
            compact={isTop}
          />
        )}

        <ul className={styles.menuWrapper} ref={menuRef}>
          {renderedMenuItems}
        </ul>

        <Profile
          type={(isTop ? showProfileInfo : expanded) ? "full" : "mini"}
          position={isHidden ? "left" : sidebarPosition}
        />
      </div>
    </>
  );
};

export default Sidebar;
