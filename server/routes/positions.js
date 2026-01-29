import express from "express";
import pool from "../db.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  const { page, pageSize, sort = "asc" } = req.query;
  console.log("page", page);
  console.log("pageSize", pageSize);

  const validSortDirections = ["asc", "desc"]; // Разрешённые направления сортировки
  const sortDirection = validSortDirections.includes(sort.toLowerCase())
    ? sort
    : "asc"; // Проверяем параметр `sort`

  try {
    if (!page && !pageSize) {
      // Если параметры пагинации не переданы, возвращаем весь список с сортировкой
      const result = await pool.query(`
        SELECT 
          p.id, 
          p.name, 
          p.status,
          COUNT(e.position_id) AS user_count
        FROM positions p
        LEFT JOIN employees e ON e.position_id = p.id
        GROUP BY p.id, p.name, p.status
        ORDER BY p.name ${sortDirection}; -- Сортировка по имени
      `);

      res.status(200).json({
        success: true,
        data: result.rows,
        pagination: "sacs", // Пагинация не используется
      });
      return;
    }

    // Если параметры переданы, используем пагинацию с сортировкой
    const pageNumber = parseInt(page, 10) || 1;
    const pageLimit = parseInt(pageSize, 10) || 10;
    const offset = (pageNumber - 1) * pageLimit;

    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT p.id) AS total
      FROM positions p
      LEFT JOIN employees e ON e.position_id = p.id;
    `);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / pageLimit);

    const paginatedResult = await pool.query(
      `
      SELECT 
        p.id, 
        p.name, 
        p.status,
        COUNT(e.position_id) AS user_count
      FROM positions p
      LEFT JOIN employees e ON e.position_id = p.id
      GROUP BY p.id, p.name, p.status
      ORDER BY p.name ${sortDirection} -- Сортировка по имени
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
    console.error("Ошибка при получении списка должностей:", err);
    res.status(500).json({ error: "Ошибка при получении данных о должностях" });
  }
});

router.post("/add", async (req, res) => {
  const { name, status } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO positions (name, status) VALUES ($1, $2) RETURNING *",
      [name, status]
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

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, status FROM positions WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Должность не найдена" });
    }

    res.status(200).json({ success: true, position: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при получении должности по id:", err);
    res.status(500).json({ error: "Ошибка при получении данных о должности" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;

  try {
    const result = await pool.query(
      "UPDATE positions SET name = $1, status = $2 WHERE id = $3 RETURNING *",
      [name, status, id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Должность не найдена" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при обновлении должности:", err);
    res.status(500).json({ error: "Ошибка при обновлении должности" });
  }
});

export default router;
