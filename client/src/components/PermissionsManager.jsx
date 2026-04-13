import React, { useState, useMemo, useEffect, useRef } from "react";
import styles from "./PermissionsManager.module.scss";

const ACTIONS = ["view", "add", "update", "delete"];
const ACTION_LABELS = ["Просмотр", "Создание", "Изменение", "Удаление"];

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
  const safeAllMenus = allMenus || [];
  const safeUserMenus = userMenus || [];

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
    setPermissions(parsePermissions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menusHash, userMenusHash]);

  const tree = useMemo(() => buildTree(safeAllMenus), [safeAllMenus]);
  const filteredTree = useMemo(() => filterTree(tree, search), [tree, search]);
  const { childrenMap, parentMap } = useMemo(
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
    let pid = parentMap[targetId];
    while (pid) {
      const siblings = childrenMap[pid] || [];
      updated[pid] = {
        ...(updated[pid] || {}),
        [action]: siblings.every((s) => updated[s]?.[action]),
      };
      pid = parentMap[pid];
    }
    return updated;
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
                      handleToggle(menu.id, action);
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
          <span className={styles.toolbarTitle}>Права доступа</span>
          <div className={styles.stats}>
            <span className={styles.badge}> Всего: {safeAllMenus.length}</span>
            <span className={styles.badge}>Разрешено: {stats.allowed}</span>
            <span className={styles.badge}>Запрещено: {stats.denied}</span>
            <span className={styles.badge}>Частично: {stats.partial}</span>
          </div>
        </div>
        <div className={styles.toolbarBottom}>
          <input
            className={styles.search}
            type="text"
            placeholder="Поиск меню..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={handleToggleExpandAll}
          >
            {allExpanded ? "Свернуть все" : "Раскрыть все"}
          </button>
          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={handleGrantAll}
          >
            Разрешить всё
          </button>
          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={handleRevokeAll}
          >
            Запретить всё
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th className={styles.colMenu}>Меню</th>
              <th>Все</th>
              {ACTION_LABELS.map((l) => (
                <th key={l}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTree.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.empty}>Ничего не найдено</div>
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
