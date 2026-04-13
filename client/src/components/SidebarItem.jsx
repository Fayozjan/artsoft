import { NavLink, useLocation, matchPath } from "react-router-dom";
import { useMemo } from "react";
import { Icons } from "../icons/icons";
import styles from "./Sidebar.module.scss";
import { useTranslation } from "react-i18next";

const SidebarItem = ({ item, type, toggleItem, isSubItemOpen }) => {
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;
  const Icon = Icons[item.name] || Icons.default;
  const { t, i18n } = useTranslation();

  const handleClick = (e) => {
    if (hasChildren) {
      e.preventDefault();
      toggleItem(item.id);
    }
  };

  const isActivePath = (path) => {
    return matchPath({ path, end: false }, location.pathname);
  };

  const renderMiniPopup = () => {
    if (type !== "mini") return null;

    if (!hasChildren) {
      return (
        <div className={styles.miniPopupWrapper}>
          <p style={{ borderBottom: "none", marginBottom: 0 }}>
            {t(item.name)}
          </p>
        </div>
      );
    }

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
  };

  const renderSubmenu = useMemo(() => {
    if (!hasChildren || type === "mini") return null;

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
    <li className={menuClasses}>
      <NavLink
        to={hasChildren ? "#" : item.path}
        onClick={handleClick}
        className={({ isActive }) =>
          isActive && !hasChildren ? styles.active : ""
        }
      >
        {Icon}
        {type === "full" && <span>{t(item.name)}</span>}
      </NavLink>

      {type === "mini" && renderMiniPopup()}
      {type === "full" && renderSubmenu}
    </li>
  );
};

export default SidebarItem;
