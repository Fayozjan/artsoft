import { MenuService } from "./menus.service.js";

export const getMenus = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const result = await MenuService.getAllMenus(userId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Ошибка при получении меню:", err);
    res.status(500).json({ error: "Ошибка при получении меню" });
  }
};
