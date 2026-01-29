import express from "express";
const router = express.Router();
import pool from "../db.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

function formatDateForDB(dateStr, type) {
  if (!dateStr) return null;

  if (type === "day") {
    return new Date(dateStr + "T00:00:00").toISOString(); // 00:00 в локальном → UTC
  }

  return new Date(dateStr).toISOString(); // время как есть → UTC
}

// Добавление
router.post("/add", async (req, res) => {
  const {
    type,
    user_id,
    reason,
    date_from,
    date_to,
    creator_id,
    is_company_paid,
    credited_hours,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO permissions (type, user_id, reason, date_from, date_to, creator_id, is_company_paid, credited_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        type,
        user_id,
        reason,
        formatDateForDB(date_from),
        formatDateForDB(date_to),
        creator_id,
        is_company_paid,
        type === "day" ? credited_hours : 0,
      ]
    );

    res.status(201).json({ success: true, result: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при добавлении разрешения" });
  }
});

// Получение списка
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  // === Доступы ===
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

  try {
    const {
      page = 1,
      pageSize = 50,
      date_from,
      date_to,
      branch_id,
      department_id,
      employee_id,
    } = req.query;

    const limit = parseInt(pageSize, 10);
    const offset = (parseInt(page, 10) - 1) * limit;

    let whereClause = "WHERE 1=1"; // Базовый фильтр
    const values = []; // Хранение параметров запроса

    if (date_from) {
      whereClause += ` AND DATE(t.date_from) >= $${values.length + 1}::date`;
      values.push(date_from); // Пример: '2025-07-01'
    }

    if (date_to) {
      whereClause += ` AND DATE(t.date_to) <= $${values.length + 1}::date`;
      values.push(date_to); // Пример: '2025-07-01'
    }

    if (branch_id) {
      whereClause += ` AND e.branch_id = $${values.length + 1}`;
      values.push(Number(branch_id));
    }

    // Фильтрация по department_id (если передан)
    if (department_id) {
      whereClause += ` AND e.department_id = $${values.length + 1}`;
      values.push(Number(department_id));
    }

    // Фильтрация по user_id (если передан)
    if (employee_id) {
      whereClause += ` AND t.employee_id = $${values.length + 1}`;
      values.push(Number(employee_id));
    }

    // --- Ограничения доступа ---
    if (access_level === "department") {
      whereClause += ` AND e.department_id = $${values.length + 1}`;
      values.push(employee_department_id);
    } else if (
      access_level === "multi-department" &&
      Array.isArray(access_departments) &&
      access_departments.length > 0
    ) {
      whereClause += ` AND e.department_id = ANY($${values.length + 1}::int[])`;
      values.push(access_departments);
    } else if (access_level === "branch") {
      whereClause += ` AND e.branch_id = $${values.length + 1}`;
      values.push(employee_branch_id);
    } else if (
      access_level === "multi-branch" &&
      Array.isArray(access_branches) &&
      access_branches.length > 0
    ) {
      whereClause += ` AND e.branch_id = ANY($${values.length + 1}::int[])`;
      values.push(access_branches);
    } else if (access_level === "personal") {
      whereClause += ` AND e.id = $${values.length + 1}`;
      values.push(self_employee_id);
    }

    const query = `
    SELECT 
        ROW_NUMBER() OVER (ORDER BY t.id DESC) AS row_number,
        t.id,
        t.reason,
        t.is_company_paid,
        CASE 
          WHEN t.type = 'day' 
            THEN to_char((t.date_from AT TIME ZONE 'Asia/Tashkent')::date, 'DD-MM-YYYY')
          ELSE 
            to_char(t.date_from AT TIME ZONE 'Asia/Tashkent', 'DD-MM-YYYY HH24:MI:SS')
        END AS date_from,
        CASE 
          WHEN t.type = 'day' 
            THEN to_char((t.date_to AT TIME ZONE 'Asia/Tashkent')::date, 'DD-MM-YYYY')
          ELSE 
            to_char(t.date_to AT TIME ZONE 'Asia/Tashkent', 'DD-MM-YYYY HH24:MI:SS')
        END AS date_to,
        CONCAT_WS(' ', e.surname, e.name, e.patronymic, e.id) AS employee_full_name,
        b.name AS branch_name,
        d.name AS department_name,
        p.name AS position_name,
        CONCAT_WS(' ', creator.surname, creator.name, creator.patronymic) AS creator_full_name
    FROM time_off t
    JOIN employees e ON t.employee_id = e.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN employees creator ON t.creator_id = creator.id
    ${whereClause}
    ORDER BY t.id DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2};
    `;

    values.push(limit, offset); // Добавляем параметры лимита и оффсета

    const countQuery = `SELECT COUNT(*) AS total FROM time_off t 
      JOIN employees e ON t.employee_id = e.id
      ${whereClause};`;

    const [result, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2)), // Передаем параметры фильтрации, но без limit и offset
    ]);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        currentPage: parseInt(page, 10),
        totalPages,
        totalItems,
        pageSize: limit,
      },
    });
  } catch (err) {
    console.error("Ошибка при получении данных:", err);
    res.status(500).json({ error: "Ошибка при получении данных" });
  }
});

// Получение по ID
router.get("/:permission_number", async (req, res) => {
  try {
    const { permission_number } = req.params;

    const query = `
    SELECT 
      permission_number,
      reason,
      is_company_paid,
      user_id,
      creator_id,
      type,
      credited_hours,
      CASE 
        WHEN type = 'day' 
          THEN TO_CHAR(date_from AT TIME ZONE 'Asia/Tashkent', 'yyyy-MM-dd')
        ELSE 
          TO_CHAR(date_from AT TIME ZONE 'Asia/Tashkent', 'DD-MM-YYYY HH24:MI:SS')
      END AS date_from,
      CASE 
        WHEN type = 'day' 
          THEN TO_CHAR(date_to AT TIME ZONE 'Asia/Tashkent', 'yyyy-MM-dd')
        ELSE 
          TO_CHAR(date_to AT TIME ZONE 'Asia/Tashkent', 'DD-MM-YYYY HH24:MI:SS')
      END AS date_to
    FROM permissions 
    WHERE permission_number = $1;
    `;

    const result = await pool.query(query, [permission_number]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Разрешение не найдено" });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при получении разрешения:", err);
    res.status(500).json({ error: "Ошибка при получении данных" });
  }
});

// Изменение
router.put("/:permission_number", async (req, res) => {
  try {
    const { permission_number } = req.params;
    const {
      user_id,
      reason,
      date_from,
      date_to,
      is_company_paid,
      creator_id,
      type,
      credited_hours,
    } = req.body;

    // Проверяем, переданы ли данные
    if (!permission_number) {
      return res.status(400).json({ error: "Не указан номер разрешения" });
    }

    // Запрос на обновление разрешения
    const query = `
      UPDATE permissions
      SET 
        user_id = $1,
        reason = $2,
        date_from = $3,
        date_to = $4,
        is_company_paid = $5,
        creator_id = $6,
        type = $7,
        credited_hours = $8
      WHERE permission_number = $9
      RETURNING *;
    `;

    const values = [
      user_id,
      reason,
      formatDateForDB(date_from),
      formatDateForDB(date_to),
      is_company_paid,
      creator_id,
      type,
      type === "day" ? credited_hours : 0,
      permission_number,
    ];

    const { rowCount, rows } = await pool.query(query, values);

    // Проверяем, обновилось ли что-то
    if (rowCount === 0) {
      return res.status(404).json({ error: "Разрешение не найдено" });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Ошибка при обновлении разрешения:", err);
    res.status(500).json({ error: "Ошибка при обновлении разрешения" });
  }
});

// Удаление
router.delete("/:permission_number", async (req, res) => {
  try {
    const { permission_number } = req.params;

    if (!permission_number) {
      return res.status(400).json({ error: "Не указан номер разрешения" });
    }

    const deleteQuery = `DELETE FROM permissions WHERE permission_number = $1 RETURNING *;`;

    const { rowCount, rows } = await pool.query(deleteQuery, [
      permission_number,
    ]);

    if (rowCount === 0) {
      return res.status(404).json({ error: "Разрешение не найдено" });
    }

    res.status(200).json({
      success: true,
      message: `Разрешение ${permission_number} успешно удалено.`,
      deletedItem: rows[0],
    });
  } catch (err) {
    console.error("Ошибка при удалении разрешения:", err);
    res.status(500).json({ error: "Ошибка при удалении разрешения" });
  }
});

export default router;
