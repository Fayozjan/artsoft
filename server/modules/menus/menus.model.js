import { prismaContext } from "../../utils/prismaContext.js";

export const MenuModel = {
  getAllMenus: async () => {
    const prisma = prismaContext.get();
    return prisma.menus.findMany({
      orderBy: { name: "asc" },
    });
  },
};
