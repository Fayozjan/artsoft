import { prismaContext } from "../../utils/prismaContext.js";

export const AnprCamerasModel = {
  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.anpr_cameras.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      include: {
        gate: { select: { id: true, name: true } },
      },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.anpr_cameras.count({ where });
  },

  findById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.anpr_cameras.findUnique({
      where: { id: Number(id) },
      include: { gate: { select: { id: true, name: true } } },
    });
  },

  findByIp: async (ip) => {
    const prisma = prismaContext.get();
    return prisma.anpr_cameras.findUnique({
      where: { camera_ip: ip },
      include: { gate: { select: { id: true, name: true } } },
    });
  },

  findByMacAddress: async (mac) => {
    const prisma = prismaContext.get();
    return prisma.anpr_cameras.findUnique({
      where: { mac_address: mac.toLowerCase() },
      include: {
        gate: {
          select: {
            id: true,
            telegram_chat_ids: true,
            name: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.anpr_cameras.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.anpr_cameras.update({
      where: { id: Number(id) },
      data,
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.anpr_cameras.findMany({
      where: { status: true },
      select: {
        gate_id: true,
        camera_ip: true,
        direction: true,
        name: true,
        port: true,
      },
    });
  },
};
