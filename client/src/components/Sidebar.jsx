import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import SidebarItem from "./SidebarItem";
import Profile from "./Profile";
import { Icons } from "../icons/icons";

import styles from "./Sidebar.module.scss";
import { BranchSwitcher } from "./BranchSwitcher";

const Sidebar = ({ menuData }) => {
  const userSettings = useAuthStore((state) => state.userSettings);
  const access = useAuthStore((state) => state.access);
  const setSidebarState = useAuthStore((state) => state.setSidebarState);
  const setActiveBranch = useAuthStore((s) => s.setActiveBranch);

  const { sidebar: isOpen, viewMode, activeBranchId } = userSettings;
  const branches = access?.branches ?? [];
  const activeBranch = branches.find((b) => b.id === activeBranchId);

  const [openItems, setOpenItems] = useState({});

  const location = useLocation();

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
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => (
        <SidebarItem
          key={item.id}
          item={item}
          type={isOpen ? "full" : "mini"}
          toggleItem={toggleItem}
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
          {isOpen && (
            <div className={styles.logoWrapper}>
              <img src="/logo.png" alt="" className={styles.logo} />
              <span>OnBase</span>
            </div>
          )}

          <span className={styles.toggle} onClick={toggleSidebar}>
            {Icons.sidebarToggle}
          </span>
        </div>

        {viewMode === "branch" && branches?.length > 0 && (
          <BranchSwitcher
            branches={branches}
            activeBranch={activeBranch}
            activeBranchId={activeBranchId}
            onSelect={setActiveBranch}
            isOpen={isOpen}
          />
        )}

        <ul className={styles.menuWrapper}>{renderedMenuItems}</ul>

        {<Profile type={!isOpen && "mini"} />}
      </div>
    </>
  );
};

export default Sidebar;
