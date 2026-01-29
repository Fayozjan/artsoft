import express from "express";
import pool from "../db.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    // Получаем параметры пагинации из query или задаем значения по умолчанию
    const { page = 1, limit = 50 } = req.query;

    const pageNumber = Math.max(parseInt(page, 10), 1);
    const limitNumber = Math.max(parseInt(limit, 10), 1);
    const offset = (pageNumber - 1) * limitNumber;

    // Запрос для получения дверей и подсчета связанных сотрудников
    const result = await pool.query(
      `
      SELECT 
        d.*, 
        COUNT(e.door) AS employees_count
      FROM doors d
      LEFT JOIN employees e ON d.id = ANY(e.door)
      GROUP BY d.id
      ORDER BY d.name
      LIMIT $1 OFFSET $2;
      `,
      [limitNumber, offset]
    );

    // Запрос для подсчета общего количества дверей
    const totalResult = await pool.query(`SELECT COUNT(*) AS total FROM doors`);
    const total = parseInt(totalResult.rows[0].total, 10);

    // Отправка ответа
    res.status(200).json({
      success: true,
      data: result.rows.map((row) => ({
        ...row,
        user_count: parseInt(row.user_count, 10),
      })),
      pagination: {
        totalItems: total,
        currentPage: pageNumber,
        pageSize: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (err) {
    console.error("Ошибка при получении списка дверей:", err);
    res.status(500).json({ error: "Ошибка при получении данных о дверях" });
  }
});

router.post("/add", async (req, res) => {
  const { name } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO doors (name, status) VALUES ($1, $2) RETURNING *",
      [name, true]
    );
    res.status(201).json({ success: true, result: result.rows });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Такое имя уже существует!" });
    }
    res.status(500).json({ error: "Ошибка при добавлении двери" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`SELECT * FROM doors WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Дверь не найдена" });
    }

    res.status(200).json({ success: true, door: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при получении двери по id:", err);
    res.status(500).json({ error: "Ошибка при получении данных о двери" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;

  try {
    const result = await pool.query(
      "UPDATE doors SET name = $1, status = $2 WHERE id = $3 RETURNING *",
      [name, status, id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Дверь не найдена" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при обновлении двери:", err);
    res.status(500).json({ error: "Ошибка при обновлении двери" });
  }
});

export default router;
