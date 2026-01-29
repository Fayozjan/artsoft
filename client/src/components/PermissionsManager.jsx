import { useState, useEffect, useRef } from "react";
import React from "react";
import { motion } from "framer-motion";
import styles from "./PermissionsManager.module.scss";

const actions = ["view", "add", "update", "delete"];

const getAllChildIds = (menus, parentId) => {
  const result = [];

  const traverse = (id) => {
    menus
      .filter((m) => m.parent_id === id)
      .forEach((child) => {
        result.push(child.id);
        traverse(child.id);
      });
  };

  traverse(parentId);
  return result;
};

const isMenuFullyChecked = (menuId, permissions, allMenus) => {
  const childIds = getAllChildIds(allMenus, menuId);

  if (childIds.length === 0) {
    return actions.every((a) => permissions[menuId]?.[a]);
  }

  return childIds.every((id) => actions.every((a) => permissions[id]?.[a]));
};

const PermissionsManager = ({ allMenus = [], userMenus = [], onChange }) => {
  const [permissions, setPermissions] = useState({});
  const [expanded, setExpanded] = useState({});
  const isInitialMount = useRef(true);

  const flattenUserMenus = (menus, map = {}) => {
    menus.forEach((m) => {
      map[m.id] = m.permissions || {};
      if (m.children?.length) flattenUserMenus(m.children, map);
    });
    return map;
  };

  useEffect(() => {
    if (!Array.isArray(allMenus)) return;

    const userMap = flattenUserMenus(userMenus);
    const map = {};

    allMenus.forEach((m) => {
      map[m.id] = {};
      actions.forEach((a) => {
        map[m.id][a] = userMap[m.id]?.[a] || false;
      });
    });

    setPermissions(map);
  }, [allMenus, userMenus]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (typeof onChange === "function") onChange(permissions);
  }, [permissions]);

  const toggleFullAccess = (menuId) => {
    setPermissions((prev) => {
      const allChecked = actions.every((a) => prev[menuId]?.[a]);
      const newValue = !allChecked;

      const updated = { ...prev };

      const affectedIds = [menuId, ...getAllChildIds(allMenus, menuId)];

      affectedIds.forEach((id) => {
        if (!updated[id]) updated[id] = {};
        actions.forEach((a) => {
          updated[id][a] = newValue;
        });
      });

      return updated;
    });
  };

  const handleCheckboxChange = (menuId, action) => {
    setPermissions((prev) => {
      const newValue = !prev[menuId]?.[action];
      const updated = { ...prev };

      const affectedIds = [menuId, ...getAllChildIds(allMenus, menuId)];

      affectedIds.forEach((id) => {
        if (!updated[id]) updated[id] = {};
        updated[id][action] = newValue;
      });

      return updated;
    });
  };

  const toggleExpand = (menuId) => {
    setExpanded((prev) => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const buildMenuTree = (items, parentId = null) =>
    items
      .filter((m) => m.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        ...m,
        children: buildMenuTree(items, m.id),
      }));

  const tree = buildMenuTree(allMenus);

  const renderMenuRows = (menus, level = 0) =>
    menus.map((menu) => (
      <React.Fragment key={menu.id}>
        <tr
          className={styles.menuRow}
          style={{ backgroundColor: level % 2 === 0 ? "#f9fafc" : "#fff" }}
        >
          <td style={{ paddingLeft: `${level * 10 + 8}px` }}>
            {menu.children?.length > 0 && (
              <span
                className={`${styles.expandArrow} ${
                  expanded[menu.id] ? styles.expanded : ""
                }`}
                onClick={() => toggleExpand(menu.id)}
              >
                ▶
              </span>
            )}
            {menu.name}
          </td>

          <td className={styles.center}>
            <input
              type="checkbox"
              checked={isMenuFullyChecked(menu.id, permissions, allMenus)}
              onChange={() => toggleFullAccess(menu.id)}
            />
          </td>

          {actions.map((action) => (
            <td key={action} className={styles.center}>
              <input
                type="checkbox"
                checked={permissions[menu.id]?.[action] || false}
                onChange={() => handleCheckboxChange(menu.id, action)}
              />
            </td>
          ))}
        </tr>

        {menu.children?.length > 0 &&
          expanded[menu.id] &&
          renderMenuRows(menu.children, level + 1)}
      </React.Fragment>
    ));

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <table className={styles.permissionsTable}>
        <thead>
          <tr>
            <th>Меню</th>
            <th>Полный</th>
            {actions.map((a) => (
              <th key={a}>
                {a === "view"
                  ? "Просмотр"
                  : a === "add"
                    ? "Создание"
                    : a === "update"
                      ? "Изменение"
                      : "Удаление"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{renderMenuRows(tree)}</tbody>
      </table>
    </motion.div>
  );
};

export default PermissionsManager;
