import express from "express";
import pool from "../db.js";
const router = express.Router();
import bcrypt from "bcrypt";

import { authMiddleware } from "../middlewares/authMiddleware.js";

router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const pageNumber = Math.max(parseInt(page, 10), 1);
    const limitNumber = Math.max(parseInt(limit, 10), 1);
    const offset = (pageNumber - 1) * limitNumber;

    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.username,
        u.employee_id,
        u.status,
        u.access_level,
        u.branches,
        u.departments,
        u.menu,
        TRIM(
          COALESCE(e.surname, '') || ' ' ||
          COALESCE(e.name, '') || ' ' ||
          COALESCE(e.patronymic, '')
        ) AS full_name
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      ORDER BY u.id
      LIMIT $1 OFFSET $2;
      `,
      [limitNumber, offset]
    );

    const totalResult = await pool.query(`SELECT COUNT(*) AS total FROM users`);
    const total = parseInt(totalResult.rows[0].total, 10);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        totalItems: total,
        currentPage: pageNumber,
        pageSize: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (err) {
    console.error("Ошибка при получении списка логинов:", err);
    res.status(500).json({ error: "Ошибка при получении данных о логинах" });
  }
});

router.get("/menu", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const menu = await pool.query(`SELECT menu FROM users WHERE id = $1`, [
      userId,
    ]);

    if (!menu.rows.length) {
      return res.status(404).json({ message: "Меню не найдено" });
    }

    res.json(menu.rows[0].menu);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Роут для получения логина по id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, username, user_id, status, access_level, branches, departments, menu FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Логин не найден" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при получении логина по id:", err);
    res.status(500).json({ error: "Ошибка при получении данных о логинах" });
  }
});

// Роут для добавления логина
router.post("/add", async (req, res) => {
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
  const userId = +user_id;
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // ✅ Проверка: если multi-branch, то branches должен быть массивом и не пустым
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

  // ✅ Проверка: если multi-department, то departments должен быть массивом и не пустым
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

  // ✅ Проверка: если доступ не 'absolute', user_id обязателен
  if (
    access_level !== "absolute" &&
    (user_id === undefined ||
      user_id === null ||
      user_id === "" ||
      user_id === 0)
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Для доступа отличного от 'absolute' необходимо указать пользователя (user_id).",
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO logins (username, password, user_id, access_level, branches, departments, status, menu) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [
        username,
        hashedPassword,
        userId,
        access_level,
        branches,
        departments,
        status,
        menu,
      ]
    );
    res.status(201).json({ success: true, result: result.rows });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Такое имя уже существует!" });
    }
    res.status(500).json({ error: "Ошибка при добавлении должности" });
  }
});

// Роут для обновления логина
router.put("/edit/:id", async (req, res) => {
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

  // ✅ Проверка: если multi-branch, то branches должен быть массивом и не пустым
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

  // ✅ Проверка: если multi-department, то departments должен быть массивом и не пустым
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

  // ✅ Проверка: если доступ не 'absolute', user_id обязателен
  if (
    access_level !== "absolute" &&
    (user_id === undefined ||
      user_id === null ||
      user_id === "" ||
      user_id === 0)
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Для доступа отличного от 'absolute' необходимо указать пользователя (user_id).",
    });
  }

  try {
    let query;
    let values;

    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      query = `
        UPDATE logins 
        SET username = $1, password = $2, user_id = $3, access_level = $4, branches = $5, departments = $6, status = $7, menu = $8 
        WHERE id = $9 
        RETURNING *`;
      values = [
        username,
        hashedPassword,
        user_id,
        access_level,
        branches,
        departments,
        status,
        menu,
        id,
      ];
    } else {
      query = `
        UPDATE logins 
        SET username = $1, user_id = $2, access_level = $3, branches = $4, departments = $5, status = $6, menu = $7 
        WHERE id = $8 
        RETURNING *`;
      values = [
        username,
        user_id,
        access_level,
        branches,
        departments,
        status,
        menu,
        id,
      ];
    }

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Логин не найден" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при обновлении логина:", err);
    res.status(500).json({ error: "Ошибка при обновлении логина" });
  }
});

export default router;
