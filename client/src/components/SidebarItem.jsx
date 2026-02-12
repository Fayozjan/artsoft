import React, { memo, useState, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icons } from "../icons/icons";
import styles from "./Sidebar.module.scss";

const iconMap = {
  dashboard: Icons.dashboard,
  hr: Icons.hr,
  employees: Icons.employees,
  manufacturing: Icons.manufacturing,
  settings: Icons.settings,
};

const isChildActive = (item) => {
  if (!item.children) return false;

  return item.children.some((child) => {
    if (location.pathname.startsWith(child.path)) return true;
    return isChildActive(child);
  });
};

const SidebarItem = memo(
  ({ item, type, toggleItem, isActive, isSubItemOpen, openItems }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const [showPopup, setShowPopup] = useState(false);
    const hoverTimeout = useRef(null);

    const Icon = iconMap[item.name];
    const hasChildren = item.children?.length > 0;

    const childActive = isChildActive(item);
    const parentActive = isActive || childActive;

    const handleMouseEnter = () => {
      if (type !== "mini" || !hasChildren) return;

      hoverTimeout.current = setTimeout(() => {
        setShowPopup(true);
      }, 150);
    };

    const handleMouseLeave = () => {
      if (hoverTimeout.current) {
        clearTimeout(hoverTimeout.current);
      }
      setShowPopup(false);
    };

    return (
      <li
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={[
          styles.menu,
          parentActive ? styles.activeMenu : "",
          isSubItemOpen ? styles.openSubmenu : "",
          hasChildren ? styles.menuItemHasChildren : "",
        ].join(" ")}
      >
        <NavLink
          to={hasChildren ? "#" : item.path}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              if (type === "full") {
                toggleItem(item.id);
              }
            }
          }}
        >
          {Icon && Icon}
          {type !== "mini" && <span>{t(item.name)}</span>}
        </NavLink>

        {/* Mini Popup (для свернутого сайдбара) */}
        {type === "mini" && hasChildren && showPopup && (
          <div className={styles.miniPopupWrapper}>
            <p>{t(item.name)}</p>
            <ul className={styles.miniPopup}>
              {item.children.map((child) => (
                <li key={child.id}>
                  <NavLink
                    to={child.path}
                    className={({ isActive }) =>
                      isActive ? styles.active : ""
                    }
                  >
                    {t(child.name)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Full Submenu (рекурсивный рендер) */}
        {hasChildren && type !== "mini" && (
          <ul
            className={[
              styles.submenuWrapper,
              isSubItemOpen ? styles.show : "",
            ].join(" ")}
          >
            {item.children.map((child) => (
              <SidebarItem
                key={child.id}
                item={child}
                type={type}
                toggleItem={toggleItem}
                isActive={location.pathname.startsWith(child.path)}
                isSubItemOpen={!!openItems?.[child.id]}
                openItems={openItems}
              />
            ))}
          </ul>
        )}
      </li>
    );
  },
);

export default SidebarItem;
