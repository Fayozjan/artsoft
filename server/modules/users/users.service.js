import bcrypt from "bcryptjs";
import { UserModel } from "./users.model.js";
import { MenuModel } from "../menus/menus.model.js";
import { createAuditLog } from "../../utils/auditLog.js";
import { LoginLockout } from "../../services/loginLockout.js";
import {
  normalizeTelegramId,
  assertTelegramIdFree,
  syncTelegramLink,
} from "../../utils/telegramTenantLink.js";

const omitPassword = (u) => u ? (({ password, ...rest }) => rest)(u) : null;

const SIDEBAR_POSITIONS = ["left", "top", "hidden"];

// Администратор задаёт логину только интерфейсные настройки (расположение меню и
// страницу после входа); остальные ключи settings принадлежат самому пользователю.
const mergeInterfaceSettings = (current, incoming) => {
  const next = { ...(current || {}) };
  if (!incoming || typeof incoming !== "object") return next;

  if (SIDEBAR_POSITIONS.includes(incoming.sidebarPosition)) {
    next.sidebarPosition = incoming.sidebarPosition;
  }
  if (typeof incoming.startPage === "string" && incoming.startPage.startsWith("/")) {
    next.startPage = incoming.startPage;
  }
  return next;
};

const toIntArray = (value) =>
  Array.isArray(value)
    ? [...new Set(value.map(Number).filter(Number.isInteger))]
    : [];

const toBool = (value) => value === true || value === "true";

// Карта прав формы {menuId: {view, add, update, delete}} → строки
// user_telegram_menu_access. null / не объект → [] (права телеграма сбрасываются).
const toTelegramMenuRows = (menu) =>
  menu && typeof menu === "object" && !Array.isArray(menu)
    ? Object.entries(menu).map(([menu_id, perms]) => ({
        menu_id: Number(menu_id),
        can_view: !!perms?.view,
        can_add: !!perms?.add,
        can_update: !!perms?.update,
        can_delete: !!perms?.delete,
      }))
    : [];

// Права для меню: в телеграм приложении — отдельный набор логина, а пока он не задан
// (нет строк) — те же права, что в вебе.
const resolveMenuAccess = async (userId, platform) => {
  if (platform === "telegram") {
    const telegramAccesses = await UserModel.getTelegramMenuAccess(userId);
    if (telegramAccesses.length > 0) return telegramAccesses;
  }
  return UserModel.getMenuAccess(userId);
};

export const UserService = {
  create: async (data) => {
    const {
      username,
      password,
      employee_id,
      access_level,
      branches,
      departments,
      status,
      menu,
      personal_menus,
      telegramId,
      view_mode,
      ignore_gps_check,
      settings,
      production_operation_ids,
      can_edit_sticker,
      production_own_only,
      telegram_work_punch,
      telegram_menu,
    } = data;

    if (
      ["branch", "department"].includes(access_level) &&
      (!Array.isArray(
        { branch: branches, department: departments }[access_level],
      ) ||
        { branch: branches, department: departments }[access_level].length ===
          0)
    ) {
      const error = new Error(
        "Необходимо выбрать хотя бы один элемент для данного уровня доступа.",
      );
      error.statusCode = 400;
      throw error;
    }

    const telegramMenuAccess = toTelegramMenuRows(telegram_menu);

    const normalizedTelegramId = normalizeTelegramId(telegramId);
    await assertTelegramIdFree(normalizedTelegramId);

    const hashedPassword = await bcrypt.hash(password, 10);

    const menuAccess = Object.entries(menu || {}).map(([menu_id, perms]) => ({
      menu_id: Number(menu_id),
      can_view: perms.view,
      can_add: perms.add,
      can_update: perms.update,
      can_delete: perms.delete,
    }));

    const result = await UserModel.create({
      username,
      password: hashedPassword,
      employee_id: Number(employee_id),
      access_level,
      branch_access: branches || [],
      department_access: departments || [],
      personal_menus: personal_menus || [],
      telegram_id: normalizedTelegramId,
      view_mode: view_mode || "branch",
      status,
      ignore_gps_check: ignore_gps_check === true || ignore_gps_check === "true",
      settings: mergeInterfaceSettings({}, settings),
      production_operation_ids: toIntArray(production_operation_ids),
      can_edit_sticker: can_edit_sticker === undefined ? true : toBool(can_edit_sticker),
      production_own_only: toBool(production_own_only),
      telegram_work_punch: toBool(telegram_work_punch),
      menuAccess: {
        create: menuAccess,
      },
      ...(telegramMenuAccess.length > 0 && {
        telegramMenuAccess: { create: telegramMenuAccess },
      }),
    });
    await syncTelegramLink(null, normalizedTelegramId);
    await createAuditLog({ userId: data.createdBy, action: "create", entity: "users", recordId: result.id, newData: omitPassword(result) });
    return result;
  },

  get: async (page, limit, filters = {}) => {
    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.max(parseInt(limit) || 50, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const { search, status } = filters || {};

    const where = {
      NOT: { username: "root" },
    };

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        {
          employee: {
            OR: [
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
              { middle_name: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    if (status !== undefined && status !== "") {
      where.status = status === "true";
    }

    const [data, total, totalMenus] = await Promise.all([
      UserModel.getList({ skip, take: limitNumber, where }),
      UserModel.count(where),
      MenuModel.countAll(),
    ]);

    const formattedData = data.map((item) => {
      const employee = item.employee;

      const employeeFullName = employee
        ? `${employee.last_name} ${employee.first_name}${
            employee.middle_name ? " " + employee.middle_name : ""
          } (${employee.id})`
        : null;

      const { _count, ...rest } = item;

      return {
        ...rest,
        employeeFullName,
        menuCount: _count?.menuAccess ?? 0,
      };
    });

    return {
      data: formattedData,
      totalMenus,
      pagination: {
        totalItems: total,
        currentPage: pageNumber,
        pageSize: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  },

  getById: async (id) => {
    return UserModel.getById(Number(id));
  },

  getInfo: async (id) => {
    return UserModel.getInfo(Number(id));
  },

  getAccess: async (userId) => {
    const access = await UserModel.getAccess(userId);

    if (!access) {
      const err = new Error("Пользователь не найден");
      err.statusCode = 404;
      throw err;
    }

    return access;
  },

  updateById: async (id, data) => {
    const {
      username,
      password,
      employee_id,
      access_level,
      branches,
      departments,
      status,
      menu,
      personal_menus,
      telegramId,
      view_mode,
      ignore_gps_check,
      settings,
      production_operation_ids,
      can_edit_sticker,
      production_own_only,
      telegram_work_punch,
      telegram_menu,
    } = data;

    if (
      ["branch", "department"].includes(access_level) &&
      (!Array.isArray(
        { branch: branches, department: departments }[access_level],
      ) ||
        { branch: branches, department: departments }[access_level].length ===
          0)
    ) {
      const error = new Error(
        "Необходимо выбрать хотя бы один элемент для данного уровня доступа.",
      );
      error.statusCode = 400;
      throw error;
    }

    // Нет поля в запросе — Telegram ID не трогаем (undefined Prisma пропускает)
    const normalizedTelegramId = normalizeTelegramId(telegramId);
    await assertTelegramIdFree(normalizedTelegramId);

    const updateData = {
      username,
      employee_id: Number(employee_id),
      access_level,
      branch_access: branches || [],
      department_access: departments || [],
      personal_menus: personal_menus || [],
      telegram_id: normalizedTelegramId,
      view_mode: view_mode || "branch",
      status,
      ignore_gps_check: ignore_gps_check === true || ignore_gps_check === "true",
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const menuAccessOperations =
      menu && Object.keys(menu).length
        ? Object.entries(menu).map(([menu_id, m]) => ({
            user_id: Number(id),
            menu_id: Number(menu_id),
            can_view: !!m.view,
            can_add: !!m.add,
            can_update: !!m.update,
            can_delete: !!m.delete,
          }))
        : [];

    const old = await UserModel.getById(Number(id));

    // Поля, которых нет в запросе, не трогаем — старый клиент не должен сбросить права.
    if (settings !== undefined) {
      updateData.settings = mergeInterfaceSettings(old?.settings, settings);
    }
    if (production_operation_ids !== undefined) {
      updateData.production_operation_ids = toIntArray(production_operation_ids);
    }
    if (can_edit_sticker !== undefined) {
      updateData.can_edit_sticker = toBool(can_edit_sticker);
    }
    if (production_own_only !== undefined) {
      updateData.production_own_only = toBool(production_own_only);
    }
    if (telegram_work_punch !== undefined) {
      updateData.telegram_work_punch = toBool(telegram_work_punch);
    }

    // Права телеграма: нет поля — не трогаем, null — сбросить (снова как в вебе),
    // объект — заменить.
    const telegramMenuOperations =
      telegram_menu === undefined
        ? undefined
        : toTelegramMenuRows(telegram_menu).map((row) => ({
            ...row,
            user_id: Number(id),
          }));

    const result = await UserModel.updateById(
      id,
      updateData,
      menuAccessOperations,
      telegramMenuOperations,
    );
    if (normalizedTelegramId !== undefined) {
      await syncTelegramLink(old?.telegram_id, normalizedTelegramId);
    }
    await createAuditLog({ userId: data.updatedBy, action: "update", entity: "users", recordId: id, oldData: omitPassword(old), newData: omitPassword(result) });
    return result;
  },

  getMenu: async (userId, platform = "web") => {
    const [accesses, menus] = await Promise.all([
      resolveMenuAccess(userId, platform),
      MenuModel.getAllMenus(),
    ]);

    const accessMap = new Map();
    accesses.forEach((a) => accessMap.set(a.menu_id, a));

    const buildTree = (parentId = null) => {
      return menus
        .filter((m) => m.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((menu) => {
          const children = buildTree(menu.id);
          const perms = accessMap.get(menu.id);

          const canView = (perms && perms.can_view) || children.length > 0;

          if (!canView) return null;

          return {
            id: menu.id,
            name: menu.name,
            path: menu.path,
            sort_order: menu.sort_order,
            permissions: {
              view: !!perms?.can_view,
              add: !!perms?.can_add,
              update: !!perms?.can_update,
              delete: !!perms?.can_delete,
            },
            children,
          };
        })
        .filter(Boolean);
    };

    return buildTree();
  },

  updateProfile: async (userId, data) => {
    const {
      currentPassword,
      newPassword,
      theme,
      language,
      sidebar,
      view_mode,
      active_branch_id,
      settings,
    } = data;

    const user = await UserModel.getWithPassword(userId);

    if (!user) {
      const err = new Error("Пользователь не найден");
      err.statusCode = 404;
      throw err;
    }

    const updateData = {};

    if (newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        const err = new Error("Текущий пароль неверный");
        err.statusCode = 400;
        throw err;
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (theme !== undefined) updateData.theme = theme;
    if (language !== undefined) updateData.language = language;
    if (sidebar !== undefined)
      updateData.sidebar = typeof sidebar === "string" ? sidebar : sidebar ? "opened" : "closed";
    if (view_mode !== undefined) updateData.view_mode = view_mode;
    if (active_branch_id !== undefined)
      updateData.active_branch_id = active_branch_id;
    if (settings !== undefined) updateData.settings = settings;

    return UserModel.updateProfile(userId, updateData);
  },

  // === Блокировки входа ===

  listLockouts: (tenant) => LoginLockout.listLocked(tenant),

  unlockLogin: async ({ tenant, userId, actorId }) => {
    const user = await UserModel.getUsernameById(userId);

    if (!user) {
      const err = new Error("Пользователь не найден");
      err.statusCode = 404;
      throw err;
    }

    const key = LoginLockout.buildKey(tenant, user.username);
    const wasLocked = LoginLockout.unlock(key);

    if (wasLocked) {
      await createAuditLog({
        userId: actorId,
        action: "unlock",
        entity: "users",
        recordId: user.id,
        newData: { username: user.username },
      });
    }

    return { username: user.username, wasLocked };
  },
};
