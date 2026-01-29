import express from "express";
import pool from "../db.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { page, pageSize } = req.query;
  const limit = pageSize ? parseInt(pageSize, 10) : null;
  const offset = page && limit ? (parseInt(page, 10) - 1) * limit : null;

  try {
    // 1. Получаем права доступа пользователя
    const userAccess = await pool.query(
      `
        SELECT
          u.access_level,
          u.branches AS access_branches,
          u.departments AS access_departments,
          e.branch_id AS employee_branch_id,
          e.department_id AS employee_department_id
        FROM users u
        JOIN employees e ON e.id = u.employee_id
        WHERE u.id = $1
      `,
      [userId]
    );

    if (!userAccess.rows.length) {
      return res.status(403).json({ error: "Пользователь не найден" });
    }

    const {
      access_level,
      employee_branch_id,
      employee_department_id,
      access_branches,
      access_departments,
    } = userAccess.rows[0];

    const conditions = [];
    const values = [];
    let valueIndex = 1;

    // === Ограничения по доступу ===
    if (access_level === "branch" && employee_branch_id) {
      conditions.push(`b.id = $${valueIndex++}`);
      values.push(employee_branch_id);
    }

    if (
      access_level === "multi-branch" &&
      Array.isArray(access_branches) &&
      access_branches.length > 0
    ) {
      const placeholders = access_branches.map(() => `$${valueIndex++}`);
      conditions.push(`b.id IN (${placeholders.join(", ")})`);
      values.push(...access_branches.map(Number));
    }

    if (access_level === "department" && employee_department_id) {
      // доступ только к филиалу, в котором находится департамент
      conditions.push(
        `b.id = (SELECT branch_id FROM departments WHERE id = $${valueIndex++})`
      );
      values.push(employee_department_id);
    }

    if (
      access_level === "multi-department" &&
      Array.isArray(access_departments) &&
      access_departments.length > 0
    ) {
      const placeholders = access_departments.map(() => `$${valueIndex++}`);
      conditions.push(`
        b.id IN (
          SELECT DISTINCT branch_id
          FROM departments
          WHERE id IN (${placeholders.join(", ")})
        )
      `);
      values.push(...access_departments.map(Number));
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // 2. Подсчёт total
    const countQuery = `
      SELECT COUNT(DISTINCT b.id) AS total
      FROM branches b
      LEFT JOIN departments d ON d.branch_id = b.id
      LEFT JOIN (SELECT department_id, COUNT(*) AS employee_count FROM employees GROUP BY department_id) e 
        ON e.department_id = d.id
      ${whereClause};
    `;
    const countResult = await pool.query(countQuery, values);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = limit ? Math.ceil(totalItems / limit) : 1;

    // 3. Основной запрос
    let query = `
      SELECT 
        b.id, 
        b.name, 
        b.status, 
        COUNT(DISTINCT d.id) AS department_count,
        SUM(COALESCE(e.employee_count, 0)) AS employee_count
      FROM branches b
      LEFT JOIN departments d ON d.branch_id = b.id
      LEFT JOIN (SELECT department_id, COUNT(*) AS employee_count FROM employees GROUP BY department_id) e 
        ON e.department_id = d.id
      ${whereClause}
      GROUP BY b.id, b.name, b.status
      ORDER BY b.name ASC
    `;

    if (limit) {
      query += ` LIMIT $${valueIndex++} OFFSET $${valueIndex++}`;
      values.push(limit, offset);
    }

    const result = await pool.query(query, values);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: limit
        ? {
            totalItems,
            totalPages,
            currentPage: parseInt(page || 1, 10),
            pageSize: limit,
          }
        : null,
    });
  } catch (err) {
    console.error("Ошибка при получении филиалов:", err);
    res.status(500).json({ error: "Ошибка при получении филиалов" });
  }
});

router.post("/add", async (req, res) => {
  const { name, status } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO branches (name, status) VALUES ($1, $2) RETURNING *",
      [name, status]
    );
    res.status(201).json({ success: true, result: result.rows });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Такое имя уже существует!" });
    }
    res.status(500).json({ error: "Ошибка при добавлении филиала" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, status FROM branches WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Филиал не найден" });
    }

    res.status(200).json({ success: true, position: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при получении филиала по id:", err);
    res.status(500).json({ error: "Ошибка при получении данных о филиале" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;

  try {
    const result = await pool.query(
      "UPDATE branches SET name = $1, status = $2 WHERE id = $3 RETURNING *",
      [name, status, id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Филиал не найден" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при обновлении данных филиала:", err);
    res.status(500).json({ error: "Ошибка при обновлении данных филиала" });
  }
});

router.get("/:id/check", async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        SUM(count) AS total_usage 
      FROM (
        SELECT COUNT(*) AS count FROM departments WHERE branch_id = $1
        UNION ALL
        SELECT COUNT(*) AS count FROM employees WHERE branch_id = $1
      ) AS usage_counts;
    `;

    const result = await pool.query(query, [id]);

    const inUse = parseInt(result.rows[0].total_usage, 10) > 0; // Проверяем, используется ли филиал
    res.json({ inUse });
  } catch (error) {
    console.error("Ошибка при проверке использования филиала:", error.message);
    res.status(500).json({ error: "Ошибка сервера." });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deleteRes = await pool.query("DELETE FROM branches WHERE id = $1", [
      id,
    ]);

    if (deleteRes.rowCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "Филиал не найден." });
    }
  } catch (error) {
    console.error("Ошибка при удалении филиала:", error.message);
    res.status(500).json({ success: false, error: "Ошибка сервера." });
  }
});

export default router;
