import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "./PermissionsManager.module.scss";

const ACTIONS = ["view", "add", "update", "delete"];

const buildTree = (items, parentId = null) =>
  items
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({ ...item, children: buildTree(items, item.id) }));

const buildRelations = (menus) => {
  const childrenMap = {};
  const parentMap = {};
  menus.forEach((m) => {
    if (!childrenMap[m.parent_id]) childrenMap[m.parent_id] = [];
    childrenMap[m.parent_id].push(m.id);
    parentMap[m.id] = m.parent_id;
  });
  return { childrenMap, parentMap };
};

const IndeterminateCheckbox = ({
  checked,
  indeterminate,
  onChange,
  ...props
}) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={onChange}
      {...props}
    />
  );
};

const filterTree = (tree, query) => {
  if (!query) return tree;
  return tree.reduce((acc, node) => {
    const childMatches = filterTree(node.children || [], query);
    if (
      node.name.toLowerCase().includes(query.toLowerCase()) ||
      childMatches.length
    ) {
      acc.push({
        ...node,
        children: childMatches,
        _forceExpand: childMatches.length > 0,
      });
    }
    return acc;
  }, []);
};

const PermissionsManager = ({ allMenus, userMenus, onChange }) => {
  const { t } = useTranslation();
  const safeAllMenus = allMenus || [];
  const safeUserMenus = userMenus || [];

  const ACTION_LABELS = [
    t("permView"),
    t("permAdd"),
    t("permUpdate"),
    t("permDelete"),
  ];

  const parsePermissions = () => {
    const map = {};
    const flatUserPerms = {};

    const extract = (menus) => {
      menus.forEach((menu) => {
        flatUserPerms[menu.id] = menu.permissions || {};
        if (menu.children?.length) extract(menu.children);
      });
    };
    extract(safeUserMenus);

    safeAllMenus.forEach((m) => {
      const p = flatUserPerms[m.id] || {};
      map[m.id] = {
        view: !!p.view,
        add: !!p.add,
        update: !!p.update,
        delete: !!p.delete,
      };
    });
    return map;
  };

  const [permissions, setPermissions] = useState(parsePermissions);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [allExpanded, setAllExpanded] = useState(false);

  const menusHash = JSON.stringify(safeAllMenus);
  const userMenusHash = JSON.stringify(safeUserMenus);

  useEffect(() => {
    const parsed = parsePermissions();
    setPermissions(parsed);
  }, [menusHash, userMenusHash]);

  const tree = useMemo(() => buildTree(safeAllMenus), [safeAllMenus]);
  const filteredTree = useMemo(() => filterTree(tree, search), [tree, search]);
  const { childrenMap } = useMemo(
    () => buildRelations(safeAllMenus),
    [safeAllMenus],
  );

  const getAllChildrenIds = (id) => {
    const result = [];
    const stack = [...(childrenMap[id] || [])];
    while (stack.length) {
      const childId = stack.pop();
      result.push(childId);
      if (childrenMap[childId]) stack.push(...childrenMap[childId]);
    }
    return result;
  };

  const updateHierarchy = (current, targetId, action, newValue) => {
    const updated = { ...current };
    const affected = [targetId, ...getAllChildrenIds(targetId)];
    affected.forEach((id) => {
      updated[id] = { ...(updated[id] || {}), [action]: newValue };
    });
    return updated;
  };

  const handleToggleAction = (menuId, action) => {
    const newValue = !getStatus(menuId, action).checked;
    const updated = updateHierarchy(permissions, menuId, action, newValue);
    setPermissions(updated);
    onChange?.(updated);
  };

  const handleToggleFull = (menuId) => {
    const isAll = ACTIONS.every((a) => getStatus(menuId, a).checked);
    let next = permissions;
    ACTIONS.forEach((a) => {
      next = updateHierarchy(next, menuId, a, !isAll);
    });
    setPermissions(next);
    onChange?.(next);
  };

  const handleGrantAll = () => {
    let next = { ...permissions };
    safeAllMenus.forEach((m) => {
      next[m.id] = { view: true, add: true, update: true, delete: true };
    });
    setPermissions(next);
    onChange?.(next);
  };

  const handleRevokeAll = () => {
    let next = { ...permissions };
    safeAllMenus.forEach((m) => {
      next[m.id] = { view: false, add: false, update: false, delete: false };
    });
    setPermissions(next);
    onChange?.(next);
  };

  const handleToggleExpandAll = () => {
    const next = {};
    if (!allExpanded) {
      safeAllMenus.forEach((m) => {
        if (childrenMap[m.id]) next[m.id] = true;
      });
    }
    setExpanded(next);
    setAllExpanded(!allExpanded);
  };

  const handleToggle = (id, hasChildren) => {
    if (!hasChildren) return;
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  };

  const getStatus = (menuId, action) => {
    const children = getAllChildrenIds(menuId);
    if (!children.length)
      return { checked: !!permissions[menuId]?.[action], indeterminate: false };
    const own = !!permissions[menuId]?.[action];
    const checkedCount = children.filter(
      (id) => permissions[id]?.[action],
    ).length;
    const isAll = checkedCount === children.length && own;
    const isSome = checkedCount > 0 || own;
    return { checked: isAll, indeterminate: !isAll && isSome };
  };

  const stats = useMemo(() => {
    let allowed = 0,
      denied = 0,
      partial = 0;
    safeAllMenus.forEach((m) => {
      const trueCount = ACTIONS.filter((a) => permissions[m.id]?.[a]).length;
      if (trueCount === 4) allowed++;
      else if (trueCount === 0) denied++;
      else partial++;
    });
    return { allowed, denied, partial };
  }, [permissions, safeAllMenus]);

  const renderRows = (menus, level = 0) =>
    menus.map((menu) => {
      const hasChildren = menu.children?.length > 0;
      const isOpen = expanded[menu.id] || menu._forceExpand;
      const fullStatus = ACTIONS.map((a) => getStatus(menu.id, a));
      const isFullChecked = fullStatus.every((s) => s.checked);
      const isFullIndet =
        !isFullChecked && fullStatus.some((s) => s.checked || s.indeterminate);

      return (
        <React.Fragment key={menu.id}>
          <tr className={level === 0 ? styles.rootRow : styles.childRow}>
            <td>
              <div
                className={`${styles.menuCell} ${hasChildren ? styles.clickable : ""}`}
                style={{ paddingLeft: level * 10 }}
                onClick={() => handleToggle(menu.id, hasChildren)}
              >
                <span
                  className={`${styles.arrow} ${hasChildren ? "" : styles.leaf} ${isOpen ? styles.open : ""}`}
                >
                  ▶
                </span>

                <span className={styles.menuName}>{menu.name}</span>
              </div>
            </td>
            <td>
              <IndeterminateCheckbox
                checked={isFullChecked}
                indeterminate={isFullIndet}
                onChange={(e) => {
                  e.stopPropagation();
                  handleToggleFull(menu.id);
                }}
              />
            </td>
            {ACTIONS.map((action) => {
              const { checked, indeterminate } = getStatus(menu.id, action);
              return (
                <td key={action}>
                  <IndeterminateCheckbox
                    checked={checked}
                    indeterminate={indeterminate}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleAction(menu.id, action);
                    }}
                  />
                </td>
              );
            })}
          </tr>
          {hasChildren && isOpen && renderRows(menu.children, level + 1)}
        </React.Fragment>
      );
    });

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <span className={styles.toolbarTitle}>{t("permissionsTitle")}</span>
          <div className={styles.stats}>
            <span className={styles.badge}>
              {t("statsTotal")}: {safeAllMenus.length}
            </span>
            <span className={styles.badge}>
              {t("allowed")}: {stats.allowed}
            </span>
            <span className={styles.badge}>
              {t("denied")}: {stats.denied}
            </span>
            <span className={styles.badge}>
              {t("partial")}: {stats.partial}
            </span>
          </div>
        </div>
        <div className={styles.toolbarBottom}>
          <input
            className={styles.search}
            type="text"
            placeholder={t("searchMenu")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={handleToggleExpandAll}
          >
            {allExpanded ? t("collapseAll") : t("expandAll")}
          </button>
          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={handleGrantAll}
          >
            {t("grantAll")}
          </button>
          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={handleRevokeAll}
          >
            {t("revokeAll")}
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th className={styles.colMenu}>{t("menuCol")}</th>
              <th>{t("all")}</th>
              {ACTION_LABELS.map((l) => (
                <th key={l}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTree.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.empty}>
                    {t("dashboard.noSearchResults")}
                  </div>
                </td>
              </tr>
            ) : (
              renderRows(filteredTree)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PermissionsManager;
