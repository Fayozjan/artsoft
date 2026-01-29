import express from "express";
import pool from "../db.js";
const router = express.Router();

// Получение всех face-устройств
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(parseInt(page, 10), 1);
    const limitNumber = Math.max(parseInt(limit, 10), 1);
    const offset = (pageNumber - 1) * limitNumber;

    const result = await pool.query(
      `
      SELECT 
        fd.*, 
        d.name AS door_name
      FROM face_devices fd
      LEFT JOIN doors d ON fd.door_id = d.id
      ORDER BY fd.id ASC
      LIMIT $1 OFFSET $2
      `,
      [limitNumber, offset]
    );

    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total FROM face_devices`
    );
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
    console.error("Ошибка при получении face-устройств:", err);
    res.status(500).json({ error: "Ошибка при получении данных" });
  }
});

// Получение конкретного face-устройства по id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM face_devices WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Face-устройство не найдено" });
    }

    res.status(200).json({ success: true, device: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при получении face-устройства по id:", err);
    res
      .status(500)
      .json({ error: "Ошибка при получении данных о face-устройстве" });
  }
});

// Добавление
router.post("/add", async (req, res) => {
  const { name, direction, device_ip, port, door_id } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO face_devices (name, direction, device_ip, port, door_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [name, direction, device_ip, port, door_id, true]
    );
    res.status(201).json({ success: true, result: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при добавлении устройства" });
  }
});

// Изменение face-устройства
router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { name, direction, device_ip, port, door_id, status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE face_devices
       SET name = $1,
           direction = $2,
           device_ip = $3,
           port = $4,
           door_id = $5,
           status = $6
       WHERE id = $7
       RETURNING *`,
      [name, direction, device_ip, port, door_id, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Face-устройство не найдено",
      });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при обновлении face-устройства:", err);
    res.status(500).json({ error: "Ошибка при обновлении face-устройства" });
  }
});

export default router;
