import prisma from "../../prisma/client.js";

export async function getTimeOff({ where, skip = 0, take = 50 }) {
  const [records, total] = await Promise.all([
    prisma.time_off.findMany({
      where,
      skip,
      take,
      orderBy: { id: "desc" },
      include: {
        employee: {
          include: { branch: true, department: true, position: true },
        },
        addedBy: {
          select: {
            employee: true,
          },
        },
      },
    }),
    prisma.time_off.count({ where }),
  ]);

  return { records, total };
}

export async function getTimeOffAll({ where }) {
  const records = await prisma.time_off.findMany({
    where,
    orderBy: { id: "desc" },
    include: {
      employee: { include: { branch: true, department: true, position: true } },
      addedBy: true,
    },
  });

  return records;
}

export const getTimeOffById = async (id) => {
  return prisma.time_off.findUnique({
    where: { time_off_number: Number(id) },
    include: { employee: true, addedBy: true },
  });
};

export const createTimeOff = (data) => {
  return prisma.time_off.create({ data });
};

export const createManyTimeOffs = (data) => {
  return prisma.time_off.createMany({
    data,
    skipDuplicates: true,
  });
};

export const updateTimeOff = async (id, data) => {
  return prisma.time_off.update({
    where: { time_off_number: Number(id) },
    data,
  });
};

export const deleteTimeOff = async (id) => {
  return prisma.time_off.delete({
    where: { time_off_number: Number(id) },
  });
};
