import { prismaPublic } from "../../utils/prismaForTenant.js";

export const notificationsOutboxModel = {
  create: (data) => {
    return prismaPublic.notifications_outbox.create({ data });
  },

  createMany: (data) => {
    return prismaPublic.notifications_outbox.createMany({
      data,
      skipDuplicates: true,
    });
  },

  findMany: ({ filter = {}, orderBy = { created_at: "asc" }, take } = {}) => {
    return prismaPublic.notifications_outbox.findMany({
      where: filter,
      orderBy,
      take,
    });
  },

  update: (id, data) => {
    return prismaPublic.notifications_outbox.update({
      where: { id },
      data,
    });
  },

  updateMany: (filter, data) => {
    return prismaPublic.notifications_outbox.updateMany({
      where: filter,
      data,
    });
  },
};
