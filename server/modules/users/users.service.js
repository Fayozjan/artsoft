import bcrypt from "bcryptjs";
import { UserModel } from "./users.model.js";
import { MenuModel } from "../menus/menus.model.js";

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

    const hashedPassword = await bcrypt.hash(password, 10);

    const menuAccess = Object.entries(menu).map(([menu_id, perms]) => ({
      menu_id: Number(menu_id),
      can_view: perms.view,
      can_add: perms.add,
      can_update: perms.update,
      can_delete: perms.delete,
    }));

    return UserModel.create({
      username,
      password: hashedPassword,
      employee_id: Number(employee_id),
      access_level,
      branch_access: branches || [],
      department_access: departments || [],
      personal_menus: personal_menus || [],
      telegram_id: telegramId,
      view_mode: view_mode || "branch",
      status,
      ignore_gps_check: ignore_gps_check === true || ignore_gps_check === "true",
      menuAccess: {
        create: menuAccess,
      },
    });
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

    const [data, total] = await Promise.all([
      UserModel.getList({ skip, take: limitNumber, where }),
      UserModel.count(where),
    ]);

    const formattedData = data.map((item) => {
      const employee = item.employee;

      const employeeFullName = employee
        ? `${employee.last_name} ${employee.first_name}${
            employee.middle_name ? " " + employee.middle_name : ""
          } (${employee.id})`
        : null;

      return {
        ...item,
        employeeFullName,
      };
    });

    return {
      data: formattedData,
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

    const updateData = {
      username,
      employee_id: Number(employee_id),
      access_level,
      branch_access: branches || [],
      department_access: departments || [],
      personal_menus: personal_menus || [],
      telegram_id: telegramId,
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

    return UserModel.updateById(id, updateData, menuAccessOperations);
  },

  getMenu: async (userId) => {
    const [accesses, menus] = await Promise.all([
      UserModel.getMenuAccess(userId),
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
    if (view_mode !== undefined) updateData.view_mode = view_mode;
    if (active_branch_id !== undefined)
      updateData.active_branch_id = active_branch_id;
    if (settings !== undefined) updateData.settings = settings;

    return UserModel.updateProfile(userId, updateData);
  },
};
