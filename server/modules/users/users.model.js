import { prismaContext } from "../../utils/prismaContext.js";
import { CRON_ACTOR, isCronActor } from "../../utils/cronActor.js";

export const UserModel = {
  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.users.create({ data });
  },

  getList: async ({
    skip = 0,
    take = 50,
    where = {},
    orderBy = { id: "asc" },
  }) => {
    const prisma = prismaContext.get();

    return prisma.users.findMany({
      skip,
      take,
      orderBy,
      where,
      select: {
        id: true,
        username: true,
        access_level: true,
        view_mode: true,
        status: true,
        _count: {
          select: {
            menuAccess: { where: { can_view: true } },
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
          },
        },
      },
    });
  },

  count: async (where = {}) => {
    const prisma = prismaContext.get();
    return prisma.users.count({ where });
  },

  getUsernameById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.users.findUnique({
      where: { id: Number(id) },
      select: { id: true, username: true },
    });
  },

  getById: async (id) => {
    // Крон-актор (см. utils/cronActor.js) — не строка в users, отдаём синтетического
    // пользователя с полным доступом: отчёт крон-задачи ограничивает только её фильтр.
    if (isCronActor(id)) return { ...CRON_ACTOR };

    const prisma = prismaContext.get();

    return prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        employee_id: true,
        access_level: true,
        branch_access: true,
        department_access: true,
        view_mode: true,
        telegram_id: true,
        active_branch_id: true,
        personal_menus: true,
        status: true,
        ignore_gps_check: true,
        settings: true,
        production_operation_ids: true,
        can_edit_sticker: true,
        production_own_only: true,
        telegram_work_punch: true,
        menuAccess: {
          select: {
            menu_id: true,
            can_view: true,
            can_add: true,
            can_update: true,
            can_delete: true,
          },
        },
        telegramMenuAccess: {
          select: {
            menu_id: true,
            can_view: true,
            can_add: true,
            can_update: true,
            can_delete: true,
          },
        },
      },
    });
  },

  getWithPassword: async (id) => {
    const prisma = prismaContext.get();

    return prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
      },
    });
  },

  getInfo: async (id) => {
    const prisma = prismaContext.get();

    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        access_level: true,
        employee_id: true,
        employee: {
          select: {
            last_name: true,
            first_name: true,
            photo: true,
            position: {
              select: { name: true },
            },
          },
        },
      },
    });

    return {
      id: user?.id,
      access_level: user?.access_level,
      employee_id: user?.employee_id,
      first_name: user?.employee?.first_name,
      last_name: user?.employee?.last_name,
      photo: user?.employee?.photo,
      position: user?.employee?.position?.name || undefined,
    };
  },

  // telegramMenuOperations: undefined — права телеграма не трогаем, [] — сбросить
  // (телеграм снова использует веб-права), непустой список — заменить.
  updateById: async (
    userId,
    dataToUpdate,
    menuAccessOperations = [],
    telegramMenuOperations,
  ) => {
    const prisma = prismaContext.get();

    return prisma.$transaction(async (tx) => {
      const updatedUser = await tx.users.update({
        where: { id: Number(userId) },
        data: dataToUpdate,
      });

      await tx.user_menu_access.deleteMany({
        where: { user_id: Number(userId) },
      });

      if (menuAccessOperations.length > 0) {
        await tx.user_menu_access.createMany({
          data: menuAccessOperations,
        });
      }

      if (telegramMenuOperations !== undefined) {
        await tx.user_telegram_menu_access.deleteMany({
          where: { user_id: Number(userId) },
        });

        if (telegramMenuOperations.length > 0) {
          await tx.user_telegram_menu_access.createMany({
            data: telegramMenuOperations,
          });
        }
      }

      return updatedUser;
    });
  },

  getMenuAccess: async (userId) => {
    const prisma = prismaContext.get();

    return prisma.user_menu_access.findMany({
      where: { user_id: Number(userId) },
    });
  },

  getTelegramMenuAccess: async (userId) => {
    const prisma = prismaContext.get();

    return prisma.user_telegram_menu_access.findMany({
      where: { user_id: Number(userId) },
    });
  },

  getAccess: async (id) => {
    const prisma = prismaContext.get();

    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        employee_id: true,
        branch_access: true,
        department_access: true,
        access_level: true,
        view_mode: true,
        active_branch_id: true,
        personal_menus: true,
        settings: true,
        production_operation_ids: true,
        can_edit_sticker: true,
        production_own_only: true,
        telegram_work_punch: true,
        menuAccess: {
          where: { can_view: true },
          select: {
            can_view: true,
            can_add: true,
            can_update: true,
            can_delete: true,
            menu: {
              select: {
                id: true,
                name: true,
                path: true,
                parent_id: true,
                sort_order: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const [branches, departments] = await Promise.all([
      user.branch_access.length > 0
        ? prisma.branches.findMany({
            where: { id: { in: user.branch_access } },
            select: { id: true, name: true, address: true },
            orderBy: { name: "asc" },
          })
        : [],

      user.department_access.length > 0
        ? prisma.departments.findMany({
            where: { id: { in: user.department_access } },
            select: { id: true, name: true, branch_id: true },
            orderBy: { name: "asc" },
          })
        : [],
    ]);

    const menu = user.menuAccess.map(({ menu, ...permissions }) => ({
      ...menu,
      permissions: {
        view: permissions.can_view,
        add: permissions.can_add,
        update: permissions.can_update,
        delete: permissions.can_delete,
      },
    }));

    return {
      employee_id: user.employee_id,
      access_level: user.access_level,
      view_mode: user.view_mode,
      active_branch_id: user.active_branch_id,
      personal_menus: user.personal_menus,
      telegram_work_punch: user.telegram_work_punch,
      settings: user.settings,
      production: {
        operation_type_ids: user.production_operation_ids,
        can_edit_sticker: user.can_edit_sticker,
        own_only: user.production_own_only,
      },
      branches,
      departments,
      menu,
    };
  },

  updateProfile: async (userId, data) => {
    const prisma = prismaContext.get();

    return prisma.users.update({
      where: { id: userId },
      data,
    });
  },
};
