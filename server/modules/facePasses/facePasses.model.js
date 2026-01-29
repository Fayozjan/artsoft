import prisma from "../../prisma/client.js";

export async function getFacePasses({ where, skip, take }) {
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
          },
        },
        door: true,
      },
    }),
    prisma.face_passes.count({ where }),
  ]);

  return { records, total };
}

export const getFacePassById = async (id) => {
  return prisma.face_passes.findUnique({
    where: { id: Number(id) },
    include: {
      employee: {
        include: { branch: true, department: true, position: true },
      },
    },
  });
};

export const createFacePass = async (data) => {
  return prisma.face_passes.create({ data });
};

export const updateFacePass = async (id, data) => {
  return prisma.face_passes.update({
    where: { id: Number(id) },
    data,
  });
};

export const deleteFacePass = async (id) => {
  return prisma.face_passes.delete({
    where: { id: Number(id) },
  });
};

export const getFacePassIds = async (startTime, endTime) => {
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
};
