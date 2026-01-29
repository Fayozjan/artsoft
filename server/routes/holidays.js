import express from "express";
const router = express.Router();
import pool from "../db.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

// Добавление
router.post("/add", async (req, res) => {
  const { name, date_from, date_to, creator_id } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO holidays (name, date_from, date_to, creator_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, date_from, date_to, creator_id]
    );
    res.status(201).json({ success: true, result: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при добавлении праздника" });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { selectedYear, page = 1, pageSize = 50 } = req.query;

    const limit = parseInt(pageSize, 10);
    const offset = (parseInt(page, 10) - 1) * limit;
    const year = selectedYear
      ? parseInt(selectedYear, 10)
      : new Date().getFullYear();

    const query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY h.date_from ASC) AS row_number,
        h.id, 
        h.name, 
        TO_CHAR(h.date_from, 'YYYY-MM-DD') AS date_from,
        TO_CHAR(h.date_to, 'YYYY-MM-DD') AS date_to,
        h.creator_id,
        CONCAT_WS(' ', e.surname, e.name, e.patronymic) AS creator_full_name
      FROM holidays h
      LEFT JOIN employees e ON h.creator_id = e.id
      WHERE h.date_from BETWEEN $1::DATE AND $2::DATE
      ORDER BY h.date_from ASC
      LIMIT $3 OFFSET $4;
    `;

    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM holidays 
      WHERE date_from BETWEEN $1::DATE AND $2::DATE;
    `;

    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    const [result, countResult] = await Promise.all([
      pool.query(query, [startOfYear, endOfYear, limit, offset]),
      pool.query(countQuery, [startOfYear, endOfYear]),
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
    console.error("Ошибка при получении списка праздников:", err);
    res.status(500).json({ error: "Ошибка при получении списка праздников" });
  }
});

// Получение по ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id, 
        name, 
        TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from, 
        TO_CHAR(date_to, 'YYYY-MM-DD') AS date_to
      FROM holidays WHERE id = $1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Праздник не найден" });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при получении праздника:", err);
    res.status(500).json({ error: "Ошибка при получении данных" });
  }
});

// Изменение
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date_from, date_to, creator_id } = req.body;

    // Проверяем, переданы ли данные
    if (!id) {
      return res.status(400).json({ error: "Не указан id" });
    }

    // Запрос на обновление разрешения
    const query = `
      UPDATE holidays
      SET 
        name = $1,
        date_from = $2,
        date_to = $3,
        creator_id = $4
      WHERE id = $5
      RETURNING *;
    `;

    const values = [name, date_from, date_to, creator_id, id];

    const { rowCount, rows } = await pool.query(query, values);

    // Проверяем, обновилось ли что-то
    if (rowCount === 0) {
      return res.status(404).json({ error: "Праздник не найден" });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Ошибка при обновлении праздника:", err);
    res.status(500).json({ error: "Ошибка при обновлении праздника" });
  }
});

// Удаление
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Не указан id" });
    }

    const deleteQuery = `DELETE FROM holidays WHERE id = $1 RETURNING *;`;

    const { rowCount, rows } = await pool.query(deleteQuery, [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: "Праздник не найден" });
    }

    res.status(200).json({
      success: true,
      message: `Праздник id:${id} успешно удален.`,
      deletedItem: rows[0],
    });
  } catch (err) {
    console.error("Ошибка при удалении праздника:", err);
    res.status(500).json({ error: "Ошибка при удалении праздника" });
  }
});

export default router;
