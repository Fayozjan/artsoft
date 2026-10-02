// Варианты «меню при входе»: конечные пункты меню (без подменю) и подпункты — включая
// «Главная», если она есть в дереве/списке меню и на неё выданы права.
// Заголовок раздела добавляем к подпункту: «Производство / Приём работы».

const collector = () => {
  const options = [];
  const seen = new Set();

  const add = (path, label) => {
    if (!path || seen.has(path)) return;
    seen.add(path);
    options.push({ path, label });
  };

  return { options, add };
};

const bySortOrder = (a, b) => a.sort_order - b.sort_order;

// Дерево меню пользователя (GET /users/menu): у пунктов есть children и permissions.view
export const startPageOptionsFromTree = (menuData, t) => {
  const { options, add } = collector();

  // Раздел может попасть в дерево без своих прав (permissions.view=false),
  // если сервер оставил его только как обёртку для разрешённых подпунктов —
  // поэтому фильтр по правам родителя тут не ставим, только у листьев.
  [...(menuData || [])]
    .sort(bySortOrder)
    .forEach((item) => {
      if (item.children?.length) {
        [...item.children]
          .filter((child) => child.permissions?.view)
          .sort(bySortOrder)
          .forEach((child) => add(child.path, `${t(item.name)} / ${t(child.name)}`));
        return;
      }
      if (item.permissions?.view) {
        add(item.path, t(item.name));
      }
    });

  return options;
};

// Плоский список всех меню (GET /menus) + права редактируемого логина {menuId: {view, ...}}
export const startPageOptionsFromFlat = (allMenus, permissions, t) => {
  const { options, add } = collector();
  const menus = allMenus || [];
  const byId = new Map(menus.map((menu) => [menu.id, menu]));
  const parentIds = new Set(menus.map((menu) => menu.parent_id).filter(Boolean));

  const sectionOrder = (menu) => byId.get(menu.parent_id)?.sort_order ?? menu.sort_order;

  menus
    .filter((menu) => !parentIds.has(menu.id) && permissions?.[menu.id]?.view)
    .sort((a, b) => sectionOrder(a) - sectionOrder(b) || bySortOrder(a, b))
    .forEach((menu) => {
      const parent = byId.get(menu.parent_id);
      add(menu.path, parent ? `${t(parent.name)} / ${t(menu.name)}` : t(menu.name));
    });

  return options;
};

// Есть ли у логина доступ хоть к одному пункту раздела (сам раздел или его подпункты)
export const hasSectionAccess = (allMenus, permissions, sectionName) => {
  const section = (allMenus || []).find((menu) => menu.name === sectionName);
  if (!section) return undefined;

  return (allMenus || []).some(
    (menu) =>
      (menu.id === section.id || menu.parent_id === section.id) &&
      permissions?.[menu.id]?.view,
  );
};
