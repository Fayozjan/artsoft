import bcrypt from "bcrypt";
import { UserModel } from "./users.model.js";
import { MenuModel } from "../menus/menus.model.js";

export const UserService = {
  editUserById: async (id, data) => {
    const {
      username,
      password,
      employee_id,
      access_level,
      branch_access,
      department_access,
      status,
      menu,
    } = data;

    // 1️⃣ Валидация доступа
    if (access_level === "branch") {
      if (!Array.isArray(branch_access) || branch_access.length === 0) {
        const err = new Error(
          "Для доступа 'branch' необходимо выбрать хотя бы один филиал.",
        );
        err.code = "VALIDATION_ERROR";
        throw err;
      }
    }

    if (access_level === "department") {
      if (!Array.isArray(department_access) || department_access.length === 0) {
        const err = new Error(
          "Для доступа 'department' необходимо выбрать хотя бы один отдел.",
        );
        err.code = "VALIDATION_ERROR";
        throw err;
      }
    }

    // 2️⃣ Подготовка данных для обновления
    const dataToUpdate = {
      username,
      employee_id: Number(employee_id),
      access_level,
      branch_access,
      department_access,
      status,
    };

    if (password && password.trim() !== "") {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    const menuAccessOperations =
      menu && Object.keys(menu).length
        ? Object.entries(menu).map(([menu_id, menuItem]) => ({
            user_id: Number(id),
            menu_id: Number(menu_id),
            can_view: !!menuItem.view,
            can_add: !!menuItem.add,
            can_update: !!menuItem.update,
            can_delete: !!menuItem.delete,
          }))
        : [];

    // 3️⃣ Обновление через модель
    const updatedUser = await UserModel.editUserById(
      id,
      dataToUpdate,
      menuAccessOperations,
    );

    if (!updatedUser) {
      const err = new Error("Пользователь не найден");
      err.code = "NOT_FOUND";
      throw err;
    }

    return updatedUser;
  },

  getUsers: async (page, limit, filters = {}) => {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 50, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const { search, status } = filters || {};
    const where = {};

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
      UserModel.findUsers({ skip, take: limitNumber, where }),
      UserModel.countUsers(where),
    ]);

    const formatedData = data.map((user) => {
      const { employee, access_level, ...rest } = user;

      const employeeFullName = employee
        ? [employee.last_name, employee.first_name, employee.middle_name]
            .filter(Boolean)
            .join(" ")
        : null;

      return {
        ...rest,
        employeeFullName,
        accessLevel: access_level,
      };
    });

    return {
      data: formatedData,
      pagination: {
        totalItems: total,
        currentPage: pageNumber,
        pageSize: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  },

  getUserById: async (id) => {
    const user = await UserModel.getUserById(Number(id));

    if (!user) return null;

    return user;
  },

  getUserMenu: async (userId) => {
    // 1️⃣ Данные из модели
    const [accesses, menus] = await Promise.all([
      UserModel.getUserMenuAccesses(Number(userId)),
      MenuModel.getAllMenus(),
    ]);

    // 2️⃣ Мапа доступов
    const accessMap = new Map();
    accesses.forEach((a) => accessMap.set(a.menu_id, a));

    // 3️⃣ Построение дерева
    const buildTree = (parentId = null) => {
      return menus
        .filter((menu) => menu.parent_id === parentId)
        .map((menu) => {
          const children = buildTree(menu.id);
          const perms = accessMap.get(menu.id);
          const canView = (perms && perms.can_view) || children.length > 0;

          if (!canView) return null;

          return {
            id: menu.id,
            name: menu.name,
            path: menu.path,
            parent_id: menu.parent_id,
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
};
