import express from "express";
import pool from "../db.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const pageNumber = Math.max(parseInt(page, 10), 1);
    const limitNumber = Math.max(parseInt(limit, 10), 1);
    const offset = (pageNumber - 1) * limitNumber;

    // Запрос для получения логинов с учетом пагинации
    const result = await pool.query(
      `
      SELECT * 
      FROM telegram_bot
      ORDER BY id
      LIMIT $1 OFFSET $2;
      `,
      [limitNumber, offset]
    );

    // Запрос для подсчета общего количества записей
    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total FROM telegram_bot`
    );
    const total = parseInt(totalResult.rows[0].total, 10);

    // Формируем и отправляем ответ
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

// Роут для получения должности по id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM telegram_bot WHERE id = $1`,
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

// Роут для добавления бота
router.post("/add", async (req, res) => {
  const { name, chat_id, users } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO telegram_bot (name, chat_id, users) VALUES ($1, $2, $3) RETURNING *",
      [name, chat_id, users]
    );
    res.status(201).json({ success: true, result: result.rows });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Такое имя уже существует!" });
    }
    res.status(500).json({ error: "Ошибка при добавлении телеграм бота" });
  }
});

// Роут для обновления бота
router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    chat_id,
    users,
    receive_late_report,
    receive_event_alerts,
    receive_attendance_report,
    status,
  } = req.body;

  try {
    const result = await pool.query(
      "UPDATE telegram_bot SET name = $1, chat_id = $2, users = $3, receive_late_report = $4, receive_event_alerts = $5, receive_attendance_report = $6, status = $7 WHERE id = $8 RETURNING *",
      [
        name,
        chat_id,
        users,
        receive_late_report,
        receive_event_alerts,
        receive_attendance_report,
        status,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Телеграм бот не найден" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при обновлении телеграм бота:", err);
    res.status(500).json({ error: "Ошибка при обновлении телеграм бота" });
  }
});

export default router;
