import bcrypt from "bcrypt";
import * as usersModel from "../models/usersModel.js";

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
  const { id } = req.params;
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

  if (access_level !== "absolute" && (!user_id || user_id === 0)) {
    return res.status(400).json({
      success: false,
      error:
        "Для доступа отличного от 'absolute' необходимо указать пользователя (user_id).",
    });
  }

  try {
    const dataToUpdate = {
      username,
      employee_id: user_id,
      access_level,
      branches,
      departments,
      status,
      menu,
    };

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await usersModel.updateUser(id, dataToUpdate);

    res.status(200).json({ success: true, result: updatedUser });
  } catch (err) {
    console.error("Ошибка при обновлении логина:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Логин не найден" });
    }
    res.status(500).json({ error: "Ошибка при обновлении логина" });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = await usersModel.getUsers(page, limit);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Ошибка при получении списка логинов:", err);
    res.status(500).json({ error: "Ошибка при получении данных о логинах" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await usersModel.getUserById(Number(id));

    if (!user) {
      return res.status(404).json({ success: false, error: "Логин не найден" });
    }

    res.status(200).json({ success: true, result: user });
  } catch (err) {
    console.error("Ошибка при получении логина по id:", err);
    res.status(500).json({ error: "Ошибка при получении данных о логинах" });
  }
};

export const getUserMenu = async (req, res) => {
  try {
    const userId = req.user.id;
    const menu = await usersModel.getUserMenu(userId);

    if (!menu) {
      return res.status(404).json({ message: "Меню не найдено" });
    }

    res.json(menu);
  } catch (err) {
    console.error("Ошибка в /menu:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
};
