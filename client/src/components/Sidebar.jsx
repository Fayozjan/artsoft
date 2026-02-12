import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import SidebarItem from "./SidebarItem";
import Profile from "./Profile";
import { Icons } from "../icons/icons";

import styles from "./Sidebar.module.scss";

const Sidebar = ({ menuData }) => {
  const userSettings = useAuthStore((state) => state.userSettings);
  const setSidebarState = useAuthStore((state) => state.setSidebarState);

  const [openItems, setOpenItems] = useState({});

  const location = useLocation();
  const isOpen = userSettings.sidebar;

  const toggleSidebar = () => setSidebarState(!isOpen);

  const toggleItem = useCallback(
    (id) => {
      setOpenItems((prev) => {
        const newState = { ...prev };
        if (newState[id]) {
          delete newState[id];
        } else {
          // Ограничение: не более 2-х открытых разделов верхнего уровня
          const topLevelOpenIds = Object.keys(newState).filter((key) =>
            menuData.some((item) => item.id === key),
          );

          if (topLevelOpenIds.length >= 2) {
            delete newState[topLevelOpenIds[0]];
          }
          newState[id] = true;
        }
        return newState;
      });
    },
    [menuData],
  );

  // Эффект для автоматического открытия родителей при смене URL
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

  const renderedMenuItems = useMemo(() => {
    return menuData
      .filter((item) => item.permissions?.view)
      .map((item) => (
        <SidebarItem
          key={item.id}
          item={item}
          type={isOpen ? "full" : "mini"}
          toggleItem={toggleItem}
          isActive={location.pathname.startsWith(item.path)}
          isSubItemOpen={!!openItems[item.id]}
          openItems={openItems}
        />
      ));
  }, [menuData, isOpen, openItems, location.pathname, toggleItem]);

  return (
    <>
      <div
        className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}
      >
        <div className={styles.sidebarTop}>
          <img
            src={isOpen ? "/ilm.webp" : "/ilm-icon.webp"}
            alt="Logo"
            className={isOpen ? styles.logo : styles.logoIcon}
          />
          <span className={styles.toggle} onClick={toggleSidebar}>
            {Icons.sidebarToggle}
          </span>
        </div>

        <ul className={styles.menuWrapper}>{renderedMenuItems}</ul>

        {isOpen ? <Profile /> : <Profile type="mini" />}
      </div>
    </>
  );
};

export default Sidebar;
