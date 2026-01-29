import { MenuModel } from "./menus.model.js";
import prisma from "../../prisma/client.js";

export const MenuService = {
  getAllMenus: async (userId) => {
    const user = await prisma.users.findUnique({
      where: { id: Number(userId) },
      select: {
        id: true,
        access_level: true,
      },
    });

    if (!user) {
      const err = new Error("Пользователь не найден");
      err.code = "NOT_FOUND";
      throw err;
    }

    const menus = await MenuModel.getAllMenus();

    return menus;
  },
};
