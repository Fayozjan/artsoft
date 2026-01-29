import express from "express";
import pool from "../../db.js";
import dotenv from "dotenv";

import { authMiddleware } from "../../middlewares/authMiddleware.js";

dotenv.config();

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  const {
    branch_id,
    department_id,
    employee_id,
    position_id,
    status,
    page,
    pageSize,
  } = req.query;

  const usePagination = page !== undefined;
  const pageNumber = parseInt(page, 10) || 1;
  const pageLimit = parseInt(pageSize, 10) || 50;
  const offset = (pageNumber - 1) * pageLimit;

  try {
    // 1. Получаем данные о правах пользователя
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
        WHERE u.id = $1;
      `,
      [userId] // берём из токена
    );

    if (!userAccess.rows.length) {
      return res.status(403).json({ error: "Пользователь не найден" });
    }

    const {
      access_level: access_level,
      employee_branch_id: employee_branch_id,
      employee_department_id: employee_department_id,
      access_branches: access_branches,
      access_departments: access_departments,
    } = userAccess.rows[0];

    const conditions = [];
    const values = [];
    let valueIndex = 1;

    const addCondition = (condition, value) => {
      if (value !== undefined && value !== null && value !== "") {
        conditions.push(condition);
        values.push(value);
        valueIndex++;
      }
    };

    // === Фильтры из query ===
    addCondition("e.branch_id = $" + valueIndex, branch_id);
    addCondition("e.department_id = $" + valueIndex, department_id);
    addCondition("e.id = $" + valueIndex, employee_id);
    addCondition("e.position_id = $" + valueIndex, position_id);

    // === Статус ===
    if (status === "unknown") {
      conditions.push(
        `(e.status IS NULL OR e.status NOT IN ('active', 'vacation', 'terminated'))`
      );
    } else {
      addCondition("e.status = $" + valueIndex, status);
    }

    // === Ограничение по доступу ===
    if (access_level === "branch" && employee_branch_id) {
      addCondition("e.branch_id = $" + valueIndex, employee_branch_id);
    }

    if (
      access_level === "multi-branch" &&
      Array.isArray(access_branches) &&
      access_branches.length > 0
    ) {
      const placeholders = access_branches.map(() => `$${valueIndex++}`);
      conditions.push(`e.branch_id IN (${placeholders.join(", ")})`);
      values.push(...access_branches.map(Number));
    }

    if (access_level === "department" && employee_department_id) {
      addCondition("e.department_id = $" + valueIndex, employee_department_id);
    }

    if (
      access_level === "multi-department" &&
      Array.isArray(access_departments) &&
      access_departments.length > 0
    ) {
      const placeholders = access_departments.map(() => `$${valueIndex++}`);
      conditions.push(`e.department_id IN (${placeholders.join(", ")})`);
      values.push(...access_departments.map(Number));
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // === Основной запрос ===
    let query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY e.surname ASC) AS row_num,
        e.id AS employee_id,
        e.surname,
        e.name,
        e.patronymic,
        e.branch_id,
        e.department_id,
        e.position_id,
        e.date_of_birth,
        e.gender,
        e.passport,
        e.pinfl,
        e.photo,
        e.status,
        b.name AS branch_name, 
        d.name AS department_name, 
        p.name AS position_name,
        ws.name AS work_schedule_name,
        TO_CHAR(uh_hired.event_date AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS hired_date,
        TO_CHAR(uh_term.event_date AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS terminated_date
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN work_schedules ws ON e.work_schedule_id = ws.id
      LEFT JOIN LATERAL (
        SELECT event_date
        FROM employee_history
        WHERE employee_id = e.id AND event_type = 'hired'
        ORDER BY event_date DESC
        LIMIT 1
      ) AS uh_hired ON TRUE
      LEFT JOIN LATERAL (
        SELECT event_date
        FROM employee_history
        WHERE employee_id = e.id AND event_type = 'termination'
        ORDER BY event_date DESC
        LIMIT 1
      ) AS uh_term ON TRUE
      ${whereClause}
      ORDER BY e.surname ASC
    `;

    if (usePagination) {
      query += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    }

    const queryValues = usePagination ? [...values, pageLimit, offset] : values;
    const result = await pool.query(query, queryValues);

    if (usePagination) {
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM employees e
        ${whereClause};
      `;
      const countResult = await pool.query(countQuery, values);
      const totalItems = parseInt(countResult.rows[0].total, 10);
      const totalPages = Math.ceil(totalItems / pageLimit);

      return res.status(200).json({
        success: true,
        data: result.rows,
        pagination: {
          totalItems,
          totalPages,
          currentPage: pageNumber,
          pageSize: pageLimit,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении пользователей" });
  }
});

// Получение пользователя через ID
router.get("/:id", async (req, res) => {
  const user_id = req.params.id;

  try {
    // Получаем основную информацию о пользователе
    const userResult = await pool.query(
      `SELECT *,
         TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
         TO_CHAR(passport_given_date, 'YYYY-MM-DD') AS passport_given_date,
         TO_CHAR(passport_validity_period, 'YYYY-MM-DD') AS passport_validity_period,
         TO_CHAR(date_of_employment, 'YYYY-MM-DD') AS date_of_employment,
         TO_CHAR(date_of_dismissal, 'YYYY-MM-DD') AS date_of_dismissal
       FROM employees 
       WHERE id = $1`,
      [user_id]
    );

    if (userResult.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Пользователь не найден" });
    }

    const user = userResult.rows[0];

    // Получаем имя должности
    const positionResult = await pool.query(
      `SELECT name FROM positions WHERE id = $1`,
      [user.position_id]
    );

    user.position_name =
      positionResult.rowCount > 0
        ? positionResult.rows[0].name
        : "Должность не найдена";

    // Получаем имя отдела
    const departmentResult = await pool.query(
      `SELECT name FROM departments WHERE id = $1`,
      [user.department_id]
    );

    user.department_name =
      departmentResult.rowCount > 0
        ? departmentResult.rows[0].name
        : "Отдел не найден";

    // Получаем имя филиала
    const branchResult = await pool.query(
      `SELECT name FROM branches WHERE id = $1`,
      [user.branch_id]
    );

    user.branch_name =
      branchResult.rowCount > 0
        ? branchResult.rows[0].name
        : "Филиал не найден";

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении данных пользователя" });
  }
});

// Получение истории пользователя
router.get("/history/:id", async (req, res) => {
  const user_id = req.params.id;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        h.*, 
        e.name,
        e.surname,
        e.patronymic,
        p.name AS position_name,
        d.name AS department_name,
        b.name AS branch_name
      FROM employee_history h
      LEFT JOIN employee e ON h.employee_id = e.id
       LEFT JOIN branches b ON h.branch_id = b.id
       LEFT JOIN departments d ON h.department_id = d.id
      LEFT JOIN positions p ON h.position_id = p.id
      WHERE h.employee_id = $1
      ORDER BY h.event_date DESC
      `,
      [employee_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Ошибка при получении истории сотрудника:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Получить последний найм сотрудника
router.get("/last-hire/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        h.*, 
        p.name AS position_name,
        d.name AS department_name,
        b.name AS branch_name,
        (h.event_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent') AS event_date_local
        FROM user_history h
        LEFT JOIN positions p ON h.position_id = p.id
        LEFT JOIN departments d ON h.department_id = d.id
        LEFT JOIN branches b ON h.branch_id = b.id
        WHERE h.user_id = $1 AND h.event_type = 'hired'
        ORDER BY h.event_date DESC
        LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Найм не найден" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Ошибка при получении последнего найма:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

export default router;
