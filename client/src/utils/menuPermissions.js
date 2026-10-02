// Права на меню в двух видах: карта формы {menuId: {view, add, update, delete}}
// и список для PermissionsManager [{id, permissions}].

// Дерево меню пользователя (GET /users/menu) → карта прав
export const menuTreeToMap = (tree) => {
  const map = {};

  const walk = (nodes) =>
    (nodes || []).forEach((node) => {
      const p = node.permissions || {};
      map[node.id] = {
        view: !!p.view,
        add: !!p.add,
        update: !!p.update,
        delete: !!p.delete,
      };
      walk(node.children);
    });

  walk(tree);
  return map;
};

export const menuMapToList = (map) =>
  Object.entries(map || {}).map(([id, permissions]) => ({
    id: Number(id),
    permissions,
  }));
