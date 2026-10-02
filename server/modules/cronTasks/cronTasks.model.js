import { prismaContext } from "../../utils/prismaContext.js";

export const CronTasksModel = {
  getAll: async () => {
    const prisma = prismaContext.get();
    return prisma.cron_tasks.findMany({
      orderBy: { id: "asc" },
      include: { addedBy: { select: { id: true, username: true } } },
    });
  },

  getById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.cron_tasks.findUnique({ where: { id: Number(id) } });
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.cron_tasks.create({
      data,
      include: { addedBy: { select: { id: true, username: true } } },
    });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.cron_tasks.update({ where: { id: Number(id) }, data });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.cron_tasks.delete({ where: { id: Number(id) } });
  },

  findDueDaily: async ({ hour, minute, weekday }) => {
    const prisma = prismaContext.get();
    return prisma.cron_tasks.findMany({
      where: {
        status: true,
        schedule_kind: "daily",
        hour,
        minute,
        days_of_week: { has: weekday },
      },
    });
  },

  // Для интервальных задач «пора ли запускать» считается по last_run_at,
  // поэтому фильтрация по времени — в планировщике, а не в запросе.
  findActiveInterval: async () => {
    const prisma = prismaContext.get();
    return prisma.cron_tasks.findMany({
      where: {
        status: true,
        schedule_kind: "interval",
        interval_minutes: { not: null },
      },
    });
  },

  markRun: async (id, { status, error = null }) => {
    const prisma = prismaContext.get();
    return prisma.cron_tasks.update({
      where: { id: Number(id) },
      data: {
        last_run_at: new Date(),
        last_run_status: status,
        last_run_error: error,
      },
    });
  },
};
