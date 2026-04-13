import { prismaContext } from "../../utils/prismaContext.js";

export const VehiclePassesModel = {
  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();

    const {
      date,
      plate_number,
      direction,
      photo,
      branch_id,
      gate_id,
      camera_id,
    } = data;

    return prisma.vehicle_passes.create({
      data: {
        date,
        plate_number,
        direction,
        photo,
        branch: branch_id ? { connect: { id: branch_id } } : undefined,
        gate: gate_id ? { connect: { id: gate_id } } : undefined,
        camera: camera_id ? { connect: { id: camera_id } } : undefined,
      },
      include: {
        branch: true,
        gate: true,
        camera: true,
      },
    });
  },

  find: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();

    const [records, total] = await Promise.all([
      prisma.vehicle_passes.findMany({
        where,
        skip,
        take,
        orderBy: { date: "desc" },
        include: {
          branch: {
            select: {
              name: true,
            },
          },
          gate: {
            select: {
              name: true,
            },
          },
        },
      }),

      prisma.vehicle_passes.count({ where }),
    ]);

    return { records, total };
  },

  findById: async (id) => {
    const prisma = prismaContext.get();

    return prisma.vehicle_passes.findUnique({
      where: { id: Number(id) },
      include: {
        branch: {
          select: {
            name: true,
          },
        },
        gate: {
          select: {
            name: true,
          },
        },
      },
    });
  },

  findVehicleNumbers: async (startTime, endTime) => {
    const prisma = prismaContext.get();

    try {
      const passes = await prisma.vehicle_passes.findMany({
        where: {
          date: {
            gte: new Date(startTime),
            lte: new Date(endTime),
          },
        },
        select: {
          plate_number: true,
        },
      });

      return passes.map((p) => p.plate_number);
    } catch (err) {
      console.error("Ошибка при получении номеров транспорта:", err);
      return [];
    }
  },

  updateById: async (id, data, tx = null) => {
    const prisma = tx || prismaContext.get();

    return prisma.vehicle_passes.update({
      where: { id: Number(id) },
      data,
    });
  },

  deleteById: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();

    return prisma.vehicle_passes.delete({
      where: { id: Number(id) },
    });
  },
};
