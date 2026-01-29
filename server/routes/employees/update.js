import express from "express";
import pool from "../../db.js";
import multer from "multer";
import path from "path";
import sharp from "sharp";
import {
  updateUserPhoto,
  removeUserFromDoors,
  updateUserAndPhoto,
} from "../../utils/doorFunctions.js";
import dotenv from "dotenv";
dotenv.config();

const server_id = process.env.SERVER_ID;
const UPLOADS_PATH = "uploads/";
const router = express.Router();
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Загрузка только изображений!"), false);
  }
};

const upload = multer({ storage, fileFilter });

// Изменения данных пользователя
router.post("/profile/add", upload.single("photo"), async (req, res) => {
  const {
    surname,
    name,
    patronymic,
    date_of_birth,
    gender,
    place_of_birth,
    passport,
    passport_given_date,
    passport_validity_period,
    pinfl,
    nationality,
    education,
    family,
    telephone,
    email,
    address,
    work_schedule_id,
    employee_number,
    education_specialty,
  } = req.body;

  let filePath = null;

  if (req.file) {
    const time = Date.now();
    const outputFileName = `${pinfl}${time}.jpg`;
    const outputPath = path.join(UPLOADS_PATH, outputFileName);

    try {
      await sharp(req.file.buffer)
        .resize(400, 300, { fit: "inside" })
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      filePath = `api/uploads/${outputFileName}`;
    } catch (err) {
      console.error("Ошибка при обработке изображения:", err);
      return res
        .status(500)
        .json({ error: "Ошибка при обработке изображения" });
    }
  }

  try {
    const values = [
      surname,
      name,
      patronymic,
      date_of_birth || null,
      gender,
      place_of_birth,
      passport,
      passport_given_date || null,
      passport_validity_period || null,
      pinfl,
      nationality,
      education,
      family,
      telephone,
      email,
      address,
      work_schedule_id,
      employee_number || null,
      education_specialty,
      filePath,
    ];

    const result = await pool.query(
      `INSERT INTO users (
        surname, name, patronymic, date_of_birth, gender,
        place_of_birth, passport, passport_given_date, passport_validity_period,
        pinfl, nationality, education, family, telephone, email,
        address, work_schedule_id, employee_number, education_specialty, photo
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20
      ) RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Не удалось добавить пользователя" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при добавлении пользователя" });
  }
});

// Изменения данных пользователя
router.patch("/profile/:id", upload.single("photo"), async (req, res) => {
  const user_id = req.params.id;
  const {
    surname,
    name,
    patronymic,
    date_of_birth,
    gender,
    place_of_birth,
    passport,
    passport_given_date,
    passport_validity_period,
    pinfl,
    nationality,
    education,
    family,
    telephone,
    email,
    address,
    work_schedule_id,
    employee_number,
    education_specialty,
    photo,
  } = req.body;

  let filePath = photo;

  if (req.file) {
    const time = Date.now();
    const outputFileName = `${pinfl}${time}.jpg`;
    const outputPath = path.join(UPLOADS_PATH, outputFileName);

    try {
      await sharp(req.file.buffer)
        .resize(400, 300, { fit: "inside" })
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      filePath = `api/uploads/${outputFileName}`;
    } catch (err) {
      console.error("Ошибка при обработке изображения:", err);
      return res
        .status(500)
        .json({ error: "Ошибка при обработке изображения" });
    }
  }

  try {
    const values = [
      surname,
      name,
      patronymic,
      date_of_birth || null,
      gender,
      place_of_birth,
      passport,
      passport_given_date || null,
      passport_validity_period || null,
      pinfl,
      nationality,
      education,
      family,
      telephone,
      email,
      address,
      work_schedule_id,
      employee_number || null,
      education_specialty,
      filePath,
      user_id,
    ];

    const result = await pool.query(
      `UPDATE users SET 
        surname = $1, 
        name = $2, 
        patronymic = $3, 
        date_of_birth = $4, 
        gender = $5, 
        place_of_birth = $6, 
        passport = $7, 
        passport_given_date = $8, 
        passport_validity_period = $9, 
        pinfl = $10, 
        nationality = $11, 
        education = $12, 
        family = $13, 
        telephone = $14, 
        email = $15, 
        address = $16, 
        work_schedule_id = $17,
        employee_number = $18,
        education_specialty = $19,
        photo = $20
      WHERE user_id = $21 RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Пользователь не найден" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при обновлении пользователя" });
  }
});

// Изменения данных касаемо работы пользователя
router.post("/work/:id", async (req, res) => {
  const user_id = req.params.id;
  const {
    branch_id,
    department_id,
    description,
    event_date,
    event_type,
    order_number,
    position_id,
  } = req.body;

  try {
    // 1. Сохраняем новое событие в историю
    await pool.query(
      `INSERT INTO user_history 
        (user_id, branch_id, department_id, description, event_date, event_type, order_number, position_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user_id,
        branch_id || null,
        department_id || null,
        description,
        event_date,
        event_type,
        order_number,
        position_id || null,
      ]
    );

    // 2. Получаем последнее по дате событие для пользователя
    const { rows } = await pool.query(
      `SELECT * FROM user_history 
       WHERE user_id = $1 
       ORDER BY event_date DESC 
       LIMIT 1`,
      [user_id]
    );

    const latestEvent = rows[0];

    // 3. Определяем статус на основе последнего события
    let status = "active"; // по умолчанию

    if (latestEvent.event_type === "leave") {
      status = "vacation";
    } else if (latestEvent.event_type === "termination") {
      status = "terminated";
    }

    // 4. Обновляем статус и другие поля, если они есть
    await pool.query(
      `UPDATE users 
       SET 
         status = $1,
         branch_id = COALESCE($2, branch_id),
         department_id = COALESCE($3, department_id),
         position_id = COALESCE($4, position_id)
       WHERE user_id = $5`,
      [
        status,
        latestEvent.branch_id,
        latestEvent.department_id,
        latestEvent.position_id,
        user_id,
      ]
    );

    // 5. Если статус terminated то нужно удалить сотрудника из дверей
    if (status === "terminated") {
      try {
        await removeUserFromDoors(user_id);
      } catch (err) {
        console.log("Удаление из дверей не выполнено:", err.message);
      }
    }

    // 6. Если не terminated — обычный успех
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сохранения истории" });
  }
});

// Изменения данных касаемо работы пользователя
router.patch("/work/:id", async (req, res) => {
  const id = req.params.id;
  const {
    user_id,
    branch_id,
    department_id,
    description,
    event_date,
    event_type,
    order_number,
    position_id,
  } = req.body;

  try {
    // 1. Сохраняем новое событие в историю
    await pool.query(
      `UPDATE user_history SET 
        branch_id = $2,
        department_id = $3,
        description = $4,
        event_date = $5,
        event_type = $6,
        order_number = $7,
        position_id = $8,
        user_id = $9
      WHERE id = $1`,
      [
        id,
        branch_id || null,
        department_id || null,
        description,
        event_date,
        event_type,
        order_number,
        position_id || null,
        user_id,
      ]
    );

    // 2. Получаем последнее по дате событие для пользователя
    const { rows } = await pool.query(
      `SELECT * FROM user_history 
       WHERE user_id = $1 
       ORDER BY event_date DESC 
       LIMIT 1`,
      [user_id]
    );

    const latestEvent = rows[0];

    // 3. Определяем статус на основе последнего события
    let status = "active";

    if (latestEvent.event_type === "leave") {
      status = "vacation";
    } else if (latestEvent.event_type === "termination") {
      status = "terminated";
    }

    // 4. Обновляем статус и другие поля, если они есть
    await pool.query(
      `UPDATE users 
       SET 
         status = $1,
         branch_id = COALESCE($2, branch_id),
         department_id = COALESCE($3, department_id),
         position_id = COALESCE($4, position_id)
       WHERE user_id = $5`,
      [
        status,
        latestEvent.branch_id,
        latestEvent.department_id,
        latestEvent.position_id,
        user_id,
      ]
    );

    // 5. Если статус terminated то нужно удалить сотрудника из дверей
    if (status === "terminated") {
      try {
        await removeUserFromDoors(user_id);
        console.log("Пользователь удален со всех дверей.");
      } catch (err) {
        console.log("Ошибка при удалении со всех дверей.");
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сохранения истории" });
  }
});

// Изменения дверей пользователя
router.patch("/door/:id", upload.single("photo"), async (req, res) => {
  const user_id = req.params.id;
  const { surname, name, door, photo, status } = req.body;

  let filePath = photo;

  if (req.file) {
    const time = Date.now();
    const outputFileName = `${pinfl}${time}.jpg`;
    const outputPath = path.join(UPLOADS_PATH, outputFileName);

    try {
      await sharp(req.file.buffer)
        .resize(400, 300, { fit: "inside" })
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      filePath = `api/uploads/${outputFileName}`;
    } catch (err) {
      console.error("Ошибка при обработке изображения:", err);
      return res
        .status(500)
        .json({ error: "Ошибка при обработке изображения" });
    }
  }

  let doors = [];
  if (door) {
    try {
      doors = JSON.parse(door);
    } catch (err) {
      console.error("Ошибка при разборе списка дверей:", err);
      return res
        .status(400)
        .json({ error: "Некорректный формат списка дверей" });
    }
  }

  // Если статус terminated то нужно удалить сотрудника из дверей
  if (status === "terminated" && doors.length > 0) {
    try {
      await removeUserFromDoors(user_id);
      res.status(200).json({ message: "Пользователь удален со всех дверей." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  try {
    const { rows: allDoors } = await pool.query("SELECT * FROM doors");

    const { rows: allUserDoors } = await pool.query(
      "SELECT door FROM users WHERE user_id = $1",
      [user_id]
    );

    const userDoors = allUserDoors.map((userDoor) => userDoor.door).flat();

    const toAdd = doors.filter((item) => !userDoors.includes(item));
    const toDelete = userDoors.filter((item) => !doors.includes(item));

    const photo_url = `http://${server_id}:7000/${filePath}`;

    // Для добавления дверей
    if (toAdd) {
      for (const door of allDoors) {
        if (toAdd.includes(door.id)) {
          try {
            updateUserAndPhoto(
              door.door_ip_entry,
              user_id,
              surname,
              name,
              photo_url
            );
            updateUserAndPhoto(
              door.door_ip_exit,
              user_id,
              surname,
              name,
              photo_url
            );
          } catch (err) {
            console.error(
              `Ошибка при обновлении пользователя или фото: ${err}`
            );
          }
        }
      }
    }

    // Для удаления дверей
    if (toDelete) {
      // Для последовательного удаления
      for (const door of allDoors) {
        if (toDelete.includes(door.id)) {
          try {
            await removeUserFromDoors(user_id);
            res
              .status(200)
              .json({ message: "Пользователь удален со всех дверей." });
          } catch (err) {
            res.status(500).json({ error: err.message });
          }
        }
      }
    }

    // Для обновления фото
    if (filePath) {
      // Асинхронная обработка по очереди
      for (const door of allDoors) {
        if (userDoors.includes(door.id)) {
          try {
            updateUserPhoto(
              door.door_ip_entry,
              user_id,
              photo_url,
              surname,
              name
            );
            updateUserPhoto(
              door.door_ip_exit,
              user_id,
              photo_url,
              surname,
              name
            );
          } catch (err) {
            console.error(`Ошибка при обновлении фото: ${err}`);
          }
        }
      }
    }

    const values = [doors, filePath, user_id];

    const result = await pool.query(
      `UPDATE users SET 
        door = $1,
        photo = $2
      WHERE user_id = $3 RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Пользователь не найден" });
    }

    res.status(200).json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при обновлении пользователя" });
  }
});

export default router;
