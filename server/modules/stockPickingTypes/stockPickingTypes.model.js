import { prismaContext } from "../../utils/prismaContext.js";

const locationSelect = { select: { id: true, name: true, complete_name: true, type: true } };

export const StockPickingTypeModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.stock_picking_types.create({
      data,
      include: { defaultLocationSrc: locationSelect, defaultLocationDest: locationSelect },
    });
  },

  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.stock_picking_types.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        defaultLocationSrc: locationSelect,
        defaultLocationDest: locationSelect,
        _count: { select: { pickings: true } },
      },
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.stock_picking_types.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      include: { defaultLocationSrc: locationSelect, defaultLocationDest: locationSelect },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.stock_picking_types.findUnique({
      where: { id: Number(id) },
      include: { defaultLocationSrc: locationSelect, defaultLocationDest: locationSelect },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.stock_picking_types.count({ where });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.stock_picking_types.update({
      where: { id: Number(id) },
      data,
      include: { defaultLocationSrc: locationSelect, defaultLocationDest: locationSelect },
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.stock_picking_types.delete({ where: { id: Number(id) } });
  },
};
