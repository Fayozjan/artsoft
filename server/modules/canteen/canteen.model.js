import { prismaContext } from "../../utils/prismaContext.js";

const employeeSelect = {
  id: true,
  first_name: true,
  last_name: true,
  middle_name: true,
  employee_number: true,
  photo: true,
  status: true,
  branch: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
};

export const CanteenModel = {
  // ─── Нормы ────────────────────────────────────────────────────────────────
  findAllowances: async ({ where, skip, take, orderBy }) => {
    const prisma = prismaContext.get();
    return prisma.canteen_allowances.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || [{ employee: { last_name: "asc" } }],
      include: { employee: { select: employeeSelect } },
    });
  },

  countAllowances: async (where) => {
    const prisma = prismaContext.get();
    return prisma.canteen_allowances.count({ where });
  },

  sumDailyLimit: async (where) => {
    const prisma = prismaContext.get();
    const result = await prisma.canteen_allowances.aggregate({
      where,
      _sum: { daily_limit: true },
    });
    return result._sum.daily_limit || 0;
  },

  findAllowanceById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.canteen_allowances.findUnique({
      where: { id: Number(id) },
      include: { employee: { select: employeeSelect } },
    });
  },

  findAllowanceByEmployee: async (employeeId) => {
    const prisma = prismaContext.get();
    return prisma.canteen_allowances.findUnique({
      where: { employee_id: Number(employeeId) },
    });
  },

  // Повторное назначение тому же сотруднику — не ошибка, а изменение нормы
  upsertAllowance: async (employeeId, data) => {
    const prisma = prismaContext.get();
    return prisma.canteen_allowances.upsert({
      where: { employee_id: Number(employeeId) },
      create: { employee_id: Number(employeeId), ...data },
      update: data,
      include: { employee: { select: employeeSelect } },
    });
  },

  updateAllowance: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.canteen_allowances.update({
      where: { id: Number(id) },
      data,
      include: { employee: { select: employeeSelect } },
    });
  },

  deleteAllowance: async (id) => {
    const prisma = prismaContext.get();
    return prisma.canteen_allowances.delete({ where: { id: Number(id) } });
  },

  // ─── Порции ───────────────────────────────────────────────────────────────
  countServed: async (employeeId, mealDate) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.count({
      where: {
        employee_id: Number(employeeId),
        meal_date: mealDate,
        status: "served",
      },
    });
  },

  createMeal: async (data) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.create({
      data,
      include: { employee: { select: employeeSelect } },
    });
  },

  // Пакетная запись событий из опроса устройств (крон events_sync).
  // skipDuplicates — то же событие могло прийти и через webhook.
  bulkCreateMeals: async (rows) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.createMany({ data: rows, skipDuplicates: true });
  },

  findMeals: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.findMany({
      where,
      skip,
      take,
      orderBy: { date: "desc" },
      include: {
        employee: { select: employeeSelect },
        faceDevice: { select: { id: true, name: true } },
      },
    });
  },

  countMeals: async (where) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.count({ where });
  },

  // Удаление ошибочного прохода. accessWhere тот же, что в списке:
  // чужой филиал не должен удаляться подбором id.
  findMealById: async (id, accessWhere = {}) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.findFirst({
      where: { id: Number(id), ...accessWhere },
      include: {
        employee: { select: employeeSelect },
        faceDevice: { select: { id: true, name: true } },
      },
    });
  },

  deleteMeal: async (id) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.delete({ where: { id: Number(id) } });
  },

  findMealsByIds: async (ids, accessWhere = {}) => {
    const prisma = prismaContext.get();
    if (ids.length === 0) return [];
    return prisma.canteen_meals.findMany({
      where: { id: { in: ids }, ...accessWhere },
      include: {
        employee: { select: employeeSelect },
        faceDevice: { select: { id: true, name: true } },
      },
    });
  },

  deleteMealsByIds: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.deleteMany({ where: { id: { in: ids } } });
  },

  // Выданные за день порции сразу по нескольким сотрудникам, в порядке
  // выдачи. Из одного запроса получаем и расход за день, и порядковый номер
  // каждой порции — иначе лента экрана делала бы по запросу на строку
  // каждые 1.5 секунды.
  servedByEmployee: async (employeeIds, mealDate) => {
    const prisma = prismaContext.get();
    if (employeeIds.length === 0) return [];
    return prisma.canteen_meals.findMany({
      where: {
        employee_id: { in: employeeIds },
        meal_date: mealDate,
        status: "served",
      },
      select: { id: true, employee_id: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
  },

  groupMealsByStatus: async (where) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });
  },

  // Строки за период для отчёта. Полей минимум — агрегация идёт в сервисе.
  mealsForReport: async (where) => {
    const prisma = prismaContext.get();
    return prisma.canteen_meals.findMany({
      where,
      select: {
        id: true,
        employee_id: true,
        date: true,
        meal_date: true,
        status: true,
        deny_reason: true,
        daily_limit: true,
        employee: { select: employeeSelect },
      },
      orderBy: { date: "asc" },
    });
  },

  // Ключи уже обработанных событий за период — опрос устройств не должен
  // пересчитывать нормы по тем же проходам.
  findMealIds: async (startTime, endTime) => {
    const prisma = prismaContext.get();
    try {
      const meals = await prisma.canteen_meals.findMany({
        where: { date: { gte: new Date(startTime), lte: new Date(endTime) } },
        select: { identifier: true, face_device_id: true },
      });
      return meals.map((m) => `${m.face_device_id ?? "null"}:${m.identifier}`);
    } catch (err) {
      console.error("Ошибка при получении идентификаторов порций:", err);
      return [];
    }
  },

  // ─── Терминалы столовой ───────────────────────────────────────────────────
  findCanteenDevices: async () => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findMany({
      where: { purpose: "canteen" },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        device_ip: true,
        status: true,
        door: { select: { id: true, name: true, branch_id: true } },
      },
    });
  },
};
