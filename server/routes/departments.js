import express from "express";
import pool from "../db.js";
const router = express.Router();

import { authMiddleware } from "../middlewares/authMiddleware.js";

/*
router.get("/", async (req, res) => {
  const { page, pageSize, sort = "asc" } = req.query;

  const validSortDirections = ["asc", "desc"];
  const sortDirection = validSortDirections.includes(sort.toLowerCase())
    ? sort.toLowerCase()
    : "asc";

  try {
    // === 1. Без пагинации ===
    if (!page && !pageSize) {
      const result = await pool.query(`
        SELECT 
          d.id, 
          d.name, 
          d.status,
          d.branch_id,
          b.name AS branches,
          COUNT(e.id) FILTER (WHERE e.status = 'active' OR e.status = 'true') AS employee_count
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id
        LEFT JOIN branches b ON d.branch_id = b.id
        GROUP BY d.id, d.name, d.status, d.branch_id, b.name
        ORDER BY LOWER(d.name) ${sortDirection}, d.id ASC;
      `);

      return res.status(200).json({
        success: true,
        data: result.rows,
        pagination: null,
      });
    }

    // === 2. С пагинацией ===
    const pageNumber = parseInt(page, 10) || 1;
    const pageLimit = parseInt(pageSize, 10) || 10;
    const offset = (pageNumber - 1) * pageLimit;

    // Общее количество
    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT d.id) AS total
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN branches b ON d.branch_id = b.id;
    `);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / pageLimit);

    const paginatedResult = await pool.query(
      `
      SELECT 
        d.id, 
        d.name, 
        d.status,
        d.branch_id,
        b.name AS branches,
        COUNT(e.id) FILTER (WHERE e.status = 'active' OR e.status = 'true') AS employee_count
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN branches b ON d.branch_id = b.id
      GROUP BY d.id, d.name, d.status, d.branch_id, b.name
      ORDER BY LOWER(b.name) ${sortDirection}, d.name, d.id ASC
      LIMIT $1 OFFSET $2;
    `,
      [pageLimit, offset]
    );

    res.status(200).json({
      success: true,
      data: paginatedResult.rows,
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize: pageLimit,
      },
    });
  } catch (err) {
    console.error("Ошибка при получении отделов:", err);
    res.status(500).json({ error: "Ошибка при получении данных об отделах" });
  }
});
*/

router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { page, pageSize, sort = "asc" } = req.query;

  const validSortDirections = ["asc", "desc"];
  const sortDirection = validSortDirections.includes(sort.toLowerCase())
    ? sort.toLowerCase()
    : "asc";

  try {
    // === 1. Получаем права доступа ===
    const userAccess = await pool.query(
      `
      SELECT
        u.access_level,
        u.branches   AS access_branches,
        u.departments AS access_departments,
        e.branch_id   AS employee_branch_id,
        e.department_id AS employee_department_id
      FROM users u
      JOIN employees e ON e.id = u.employee_id
      WHERE u.id = $1;
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

    // === 2. Условия доступа ===
    const conditions = [];
    const values = [];
    let valueIndex = 1;

    if (access_level === "branch" && employee_branch_id) {
      conditions.push(`d.branch_id = $${valueIndex++}`);
      values.push(employee_branch_id);
    }

    if (
      access_level === "multi-branch" &&
      Array.isArray(access_branches) &&
      access_branches.length > 0
    ) {
      const placeholders = access_branches.map(() => `$${valueIndex++}`);
      conditions.push(`d.branch_id IN (${placeholders.join(", ")})`);
      values.push(...access_branches.map(Number));
    }

    if (access_level === "department" && employee_department_id) {
      conditions.push(`d.id = $${valueIndex++}`);
      values.push(employee_department_id);
    }

    if (
      access_level === "multi-department" &&
      Array.isArray(access_departments) &&
      access_departments.length > 0
    ) {
      const placeholders = access_departments.map(() => `$${valueIndex++}`);
      conditions.push(`d.id IN (${placeholders.join(", ")})`);
      values.push(...access_departments.map(Number));
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // === 3. Если без пагинации ===
    if (!page && !pageSize) {
      const query = `
        SELECT 
          d.id, 
          d.name, 
          d.status,
          d.branch_id,
          b.name AS branch_name,
          COUNT(e.id) FILTER (WHERE e.status = 'active' OR e.status = 'true') AS employee_count
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id
        LEFT JOIN branches b ON d.branch_id = b.id
        ${whereClause}
        GROUP BY d.id, d.name, d.status, d.branch_id, b.name
        ORDER BY LOWER(d.name) ${sortDirection}, d.id ASC;
      `;
      const result = await pool.query(query, values);

      return res.status(200).json({
        success: true,
        data: result.rows,
        pagination: null,
      });
    }

    // === 4. С пагинацией ===
    const pageNumber = parseInt(page, 10) || 1;
    const pageLimit = parseInt(pageSize, 10) || 10;
    const offset = (pageNumber - 1) * pageLimit;

    const countQuery = `
      SELECT COUNT(DISTINCT d.id) AS total
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN branches b ON d.branch_id = b.id
      ${whereClause};
    `;
    const countResult = await pool.query(countQuery, values);
    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / pageLimit);

    const query = `
      SELECT 
        d.id, 
        d.name, 
        d.status,
        d.branch_id,
        b.name AS branch_name,
        COUNT(e.id) FILTER (WHERE e.status = 'active' OR e.status = 'true') AS employee_count
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN branches b ON d.branch_id = b.id
      ${whereClause}
      GROUP BY d.id, d.name, d.status, d.branch_id, b.name
      ORDER BY LOWER(b.name) ${sortDirection}, d.name, d.id ASC
      LIMIT $${valueIndex} OFFSET $${valueIndex + 1};
    `;

    const result = await pool.query(query, [...values, pageLimit, offset]);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize: pageLimit,
      },
    });
  } catch (err) {
    console.error("Ошибка при получении отделов:", err);
    res.status(500).json({ error: "Ошибка при получении данных об отделах" });
  }
});

router.post("/add", async (req, res) => {
  const { name, branch, status } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO departments (name, branch_id, status) VALUES ($1, $2, $3) RETURNING *",
      [name, branch, status]
    );
    res.status(201).json({ success: true, result: result.rows });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Имя с таким отделом уже существует!" });
    }
    res.status(500).json({ error: "Ошибка при добавлении отдела" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { name, status, branch } = req.body;
  console.log(status);

  try {
    const result = await pool.query(
      "UPDATE departments SET name = $1, status = $2, branch_id = $3 WHERE id = $4 RETURNING *",
      [name, status, branch, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Отдел не найден" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при обновлении отдела:", err);
    res.status(500).json({ error: "Ошибка при обновлении отдела" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, status, branch_id FROM departments WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Отдел не найден" });
    }

    res.status(200).json({ success: true, department: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при получении отдела по id:", err);
    res.status(500).json({ error: "Ошибка при получении данных об отделе" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Проверяем, есть ли сотрудники в отделе
    const employeeCountResult = await pool.query(
      "SELECT COUNT(*) AS employee_count FROM employees WHERE department_id = $1",
      [id]
    );

    const employeeCount = parseInt(
      employeeCountResult.rows[0].employee_count,
      10
    );

    if (employeeCount > 0) {
      return res
        .status(400)
        .json({ error: "Невозможно удалить отдел с сотрудниками" });
    }

    // Удаляем отдел
    const deleteResult = await pool.query(
      "DELETE FROM departments WHERE id = $1 RETURNING *",
      [id]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Отдел не найден" });
    }

    res.status(200).json({ success: true, message: "Отдел успешно удален" });
  } catch (err) {
    console.error("Ошибка при удалении отдела:", err);
    res.status(500).json({ error: "Ошибка при удалении отдела" });
  }
});

export default router;
