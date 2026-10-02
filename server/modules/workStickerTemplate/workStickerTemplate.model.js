import { prismaContext } from "../../utils/prismaContext.js";
import { DEFAULTS } from "./workStickerTemplate.presets.js";

export const WorkStickerTemplateModel = {
  list: () => {
    const prisma = prismaContext.get();
    return prisma.work_sticker_templates.findMany({ orderBy: { id: "asc" } });
  },

  findById: (id) => {
    const prisma = prismaContext.get();
    return prisma.work_sticker_templates.findUnique({ where: { id } });
  },

  // Активный вариант — тот, по которому печатаются стикеры. Если активного нет
  // (напр. правили БД руками) — берём самый старый; если записей нет вовсе,
  // создаём дефолтную при первом обращении.
  getActive: async () => {
    const prisma = prismaContext.get();
    const existing = await prisma.work_sticker_templates.findFirst({
      orderBy: [{ is_active: "desc" }, { id: "asc" }],
    });
    if (existing) return existing;
    return prisma.work_sticker_templates.create({ data: { ...DEFAULTS, is_active: true } });
  },

  // Новый вариант (копия) всегда неактивен — печать не меняется, пока его явно
  // не выберут.
  create: (data) => {
    const prisma = prismaContext.get();
    return prisma.work_sticker_templates.create({ data: { ...data, is_active: false } });
  },

  update: (id, data) => {
    const prisma = prismaContext.get();
    return prisma.work_sticker_templates.update({ where: { id }, data });
  },

  // Ровно один активный: снимаем флаг со всех и ставим выбранному в одной
  // транзакции, чтобы печать не осталась без активного варианта.
  activate: async (id) => {
    const prisma = prismaContext.get();
    const [, activated] = await prisma.$transaction([
      prisma.work_sticker_templates.updateMany({ data: { is_active: false } }),
      prisma.work_sticker_templates.update({ where: { id }, data: { is_active: true } }),
    ]);
    return activated;
  },

  remove: (id) => {
    const prisma = prismaContext.get();
    return prisma.work_sticker_templates.delete({ where: { id } });
  },
};
