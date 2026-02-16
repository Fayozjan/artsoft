import prisma from "../../prisma/client.js";

export const notificationsOutboxModel = {
  // просто создает одну запись
  create: (data) => prisma.notifications_outbox.create({ data }),

  // просто создает несколько записей
  createMany: (data) =>
    prisma.notifications_outbox.createMany({
      data,
      skipDuplicates: true,
    }),

  findMany: (filter) =>
    prisma.notifications_outbox.findMany({
      where: filter,
      include: {
        facePass: {
          include: {
            employee: {
              select: {
                id: true,
                last_name: true,
                first_name: true,
                middle_name: true,
                branch: { select: { name: true } },
                department: { select: { name: true } },
                position: { select: { name: true } },
              },
            },
            door: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { facePass: { date: "asc" } },
    }),

  update: (id, data) =>
    prisma.notifications_outbox.update({
      where: { id },
      data,
    }),

  updateMany: (filter, data) =>
    prisma.notifications_outbox.updateMany({
      where: filter,
      data,
    }),
};
