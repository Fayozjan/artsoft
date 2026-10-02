import { useState, useEffect } from "react";
import { getUserMenu } from "../api/users";

export const usePermissions = (currentPath) => {
  const [menuData, setMenuData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setMenuData(await getUserMenu());
      } catch (err) {
        console.error("Ошибка получения меню:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  // рекурсивный поиск пункта меню по пути
  const findMenuItem = (items, path) => {
    for (const item of items) {
      if (item.path === path) return item;
      if (item.children?.length) {
        const found = findMenuItem(item.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const menuItem = findMenuItem(menuData, currentPath);

  const permissions = menuItem?.permissions || {};

  return {
    canView: !!permissions.view,
    canAdd: !!permissions.add,
    canEdit: !!permissions.update,
    canDelete: !!permissions.delete,
    loading,
  };
};
