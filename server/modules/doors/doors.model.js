import { prismaContext } from "../../utils/prismaContext.js";

export const DoorModel = {
  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.doors.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { employees: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.doors.count({ where });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.doors.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      include: {
        branch: { select: { id: true, name: true } },
        faceDevices: {
          where: { status: true },
          select: {
            device_ip: true,
            id: true,
            name: true,
            door_id: true,
            direction: true,
          },
        },
      },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.doors.findUnique({
      where: { id: Number(id) },
      include: {
        employees: true,
        branch: { select: { id: true, name: true } },
      },
    });
  },

  findByBranchWithLocation: async (branchId) => {
    const prisma = prismaContext.get();
    return prisma.doors.findMany({
      where: {
        branch_id: branchId,
        status: true,
        latitude: { not: null },
        longitude: { not: null },
      },
    });
  },

  findFirstByBranch: async (branchId) => {
    const prisma = prismaContext.get();
    return prisma.doors.findFirst({
      where: { branch_id: branchId, status: true },
      orderBy: { id: "asc" },
    });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.doors.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.doors.update({
      where: { id: Number(id) },
      data,
    });
  },
};
