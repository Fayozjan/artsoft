import bcrypt from "bcryptjs";
import * as usersModel from "./users.model.js";
import { UserService } from "./users.service.js";

export const addUser = async (req, res) => {
  const {
    username,
    password,
    user_id,
    access_level,
    branches,
    departments,
    status,
    menu,
  } = req.body;

  // Проверки
  if (
    access_level === "multi-branch" &&
    (!Array.isArray(branches) || branches.length === 0)
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Для доступа 'multi-branch' необходимо выбрать хотя бы один филиал.",
    });
  }

  if (
    access_level === "multi-department" &&
    (!Array.isArray(departments) || departments.length === 0)
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Для доступа 'multi-department' необходимо выбрать хотя бы один отдел.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await usersModel.createUser({
      username,
      password: hashedPassword,
      employee_id: user_id,
      access_level,
      branches,
      departments,
      status,
      menu,
    });

    res.status(201).json({ success: true, result: newUser });
  } catch (err) {
    console.error(err);
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Такое имя логина уже существует!" });
    }
    res.status(500).json({ error: "Ошибка при добавлении логина" });
  }
};

export const editUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const { currentPassword, newPassword, theme, language } = req.body;

    const user = await usersModel.getUser(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "Пользователь не найден" });
    }

    if (newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res
          .status(400)
          .json({ success: false, error: "Текущий пароль неверный" });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    user.theme = theme ?? user.theme;
    user.language = language ?? user.language;

    const updatedUser = await usersModel.editUserById(userId, user);

    res.status(200).json({ success: true, data: updatedUser });
  } catch (err) {
    console.error("Ошибка при обновлении пользователя:", err);
    res
      .status(500)
      .json({ success: false, error: "Ошибка при обновлении пользователя" });
  }
};

export const editUserById = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const updatedUser = await UserService.editUserById(id, data);
    res.status(200).json({ success: true, result: updatedUser });
  } catch (err) {
    console.error("Ошибка при обновлении пользователя:", err);

    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ success: false, error: err.message });
    }

    if (err.code === "NOT_FOUND") {
      return res
        .status(404)
        .json({ success: false, error: "Пользователь не найден" });
    }

    res
      .status(500)
      .json({ success: false, error: "Ошибка при обновлении пользователя" });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { page, pageSize, filters } = req.query;

    const result = await UserService.getUsers(page, pageSize, filters);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Ошибка при получении списка логинов:", err);
    res.status(500).json({ error: "Ошибка при получении данных о логинах" });
  }
};

export const getUserInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const userInfo = await usersModel.getUserInfo(userId);

    if (!userInfo) {
      return res.status(404).json({ message: "Не найдено" });
    }

    res.json(userInfo);
  } catch (err) {
    console.error("Ошибка в userInfo:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
};

export const UserController = {
  getUserById: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await UserService.getUserById(Number(id));

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "Логин не найден" });
      }

      res.status(200).json({ success: true, data: user });
    } catch (err) {
      console.error("Ошибка при получении логина по id:", err);
      res.status(500).json({ error: "Ошибка при получении данных о логинах" });
    }
  },

  getUserMenu: async (req, res) => {
    try {
      const userId = req.user.id;
      const menu = await UserService.getUserMenu(userId);

      if (!menu) {
        return res.status(404).json({ message: "Меню не найдено" });
      }

      res.json(menu);
    } catch (err) {
      console.error("Ошибка в /menu:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
};
