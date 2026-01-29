import prisma from "../../prisma/client.js";

export const MenuModel = {
  getAllMenus: async () => {
    return prisma.menus.findMany({
      orderBy: { name: "asc" },
    });
  },
};
