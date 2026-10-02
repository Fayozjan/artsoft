import { UserModel } from "../users/users.model.js";
import { MenuModel } from "./menus.model.js";

export const MenuService = {
  getAllMenus: async (userId) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    return MenuModel.getAllMenus();
  },
};
