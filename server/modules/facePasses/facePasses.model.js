import { prismaContext } from "../../utils/prismaContext.js";

export const FacePassesModel = {
  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();

    return prisma.face_passes.create({
      data: {
        date: data.date,
        identifier: data.identifier,
        photo: data.photo,
        direction: data.direction,
        source: data.source ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        employee: { connect: { id: data.employee_id } },
        door: data.door_id ? { connect: { id: data.door_id } } : undefined,
        faceDevice: data.face_devices_id
          ? { connect: { id: data.face_devices_id } }
          : undefined,
      },
      include: {
        door: true,
        faceDevice: true,
        employee: {
          include: {
            branch: true,
            department: true,
            position: true,
          },
        },
      },
    });
  },

  bulkCreate: async (payloads, tx = null) => {
    const prisma = tx || prismaContext.get();

    const created = await prisma.face_passes.createManyAndReturn({
      data: payloads,
      skipDuplicates: true,
    });

    // Подтягиваем relations отдельно
    const ids = created.map((p) => p.id);

    return prisma.face_passes.findMany({
      where: { id: { in: ids } },
      include: {
        door: true,
        faceDevice: true,
        employee: {
          include: {
            branch: true,
            department: true,
            position: true,
          },
        },
      },
    });
  },

  find: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();

    const [records, total] = await Promise.all([
      prisma.face_passes.findMany({
        where,
        skip,
        take,
        orderBy: { date: "desc" },
        include: {
          employee: {
            include: {
              branch: true,
              department: true,
              position: true,
              workSchedule: true,
              employeeScheduleHistory: {
                include: {
                  workSchedule: true,
                },
              },
            },
          },
          door: true,
        },
      }),
      prisma.face_passes.count({ where }),
    ]);

    return { records, total };
  },

  findById: async (id) => {
    const prisma = prismaContext.get();

    return prisma.face_passes.findUnique({
      where: { id: Number(id) },
      include: {
        employee: {
          include: { branch: true, department: true, position: true },
        },
      },
    });
  },

  findIds: async (startTime, endTime) => {
    const prisma = prismaContext.get();

    try {
      const passes = await prisma.face_passes.findMany({
        where: {
          date: {
            gte: new Date(startTime),
            lte: new Date(endTime),
          },
        },
        select: {
          identifier: true,
        },
      });

      return passes.map((p) => p.identifier);
    } catch (err) {
      console.error("Ошибка при получении идентификаторов:", err);
      return [];
    }
  },

  updateById: async (id, data, tx = null) => {
    const prisma = tx || prismaContext.get();

    return prisma.face_passes.update({
      where: { id: Number(id) },
      data,
    });
  },

  updatePhoto: async (id, photo, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.face_passes.update({ where: { id }, data: { photo } });
  },

  deleteById: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();

    return prisma.face_passes.delete({
      where: { id: Number(id) },
    });
  },
};
