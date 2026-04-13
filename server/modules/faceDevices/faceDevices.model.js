import { prismaContext } from "../../utils/prismaContext.js";

export const FaceDeviceModel = {
  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      include: { door: { select: { id: true, name: true } } },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.count({ where });
  },

  findById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findUnique({
      where: { id: Number(id) },
      include: { door: { select: { id: true, name: true } } },
    });
  },

  findByIp: async (ip) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findUnique({
      where: { device_ip: ip },
      include: { door: { select: { id: true, name: true } } },
    });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.update({
      where: { id: Number(id) },
      data,
    });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findMany({
      where: { status: true },
      select: { door_id: true, device_ip: true, is_local: true },
    });
  },
};
