import express from "express";
import pool from "../../db.js";
import multer from "multer";
import path from "path";
import sharp from "sharp";
import axios from "axios";
import dotenv from "dotenv";
import fetch from "digest-fetch";

dotenv.config();
const username = "admin";
const password = process.env.PASSWORD;
const server_id = process.env.SERVER_ID;
const client = new fetch(username, password);
const api_set_user = "/ISAPI/AccessControl/UserInfo/Record?format=json";
const api_set_user_photo = "/ISAPI/Intelligent/FDLib/FDSetUp?format=json";

const UPLOADS_PATH = "uploads/";

// Настройка для хранения файлов
const storage = multer.memoryStorage(); // Сохраняем файл в памяти

// Фильтр для проверки типа файла
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true); // Разрешаем только изображения
  } else {
    cb(new Error("Загрузка только изображений!"), false);
  }
};

const upload = multer({ storage, fileFilter });

// Роут для добавления пользователя
const router = express.Router();

router.post("/", upload.single("photo"), async (req, res) => {
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
    branch,
    department,
    position,
    order_number,
    date_of_employment,
    date_of_dismissal,
    door,
    employee_number,
    work_schedule_id,
    status,
  } = req.body;

  let filePath = null;

  // Обработка фото, если оно предоставлено
  if (req.file) {
    const outputFileName = `${pinfl}.jpg`;
    const outputPath = path.join(UPLOADS_PATH, outputFileName);

    try {
      await sharp(req.file.buffer) // Обрабатываем изображение
        .resize(400, 300, { fit: "inside" }) // Изменяем размер
        .jpeg({ quality: 90 }) // Сжимаем и сохраняем в формате jpeg
        .toFile(outputPath); // Сохраняем файл

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
    doors = JSON.parse(door); // Преобразуем строку обратно в массив
  }

  const values = [
    surname,
    name,
    patronymic,
    date_of_birth || null,
    gender,
    place_of_birth || null,
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
    branch,
    department,
    position || null,
    order_number,
    date_of_employment || null,
    date_of_dismissal || null,
    doors || null,
    employee_number || null,
    work_schedule_id || null,
    status,
    filePath,
  ];

  try {
    const result = await pool.query(
      `INSERT INTO employees (surname, name, patronymic, date_of_birth, gender, place_of_birth, passport, passport_given_date, passport_validity_period, pinfl, nationality, education, family, telephone, email, address, branch_id, department_id, position_id, order_number, date_of_employment, date_of_dismissal, door, work_schedule_id, employee_number, status, photo) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING *`,
      values
    );

    const user_id = result.rows[0].user_id.toString();
    let photo_url = result.rows[0].photo
      ? `http://${server_id}:7000/${result.rows[0].photo.toString()}`
      : null;

    if (doors.length > 0 && photo_url && status) {
      // Шаг 1: Запросить IP-адреса дверей (door_ip_entry и door_ip_exit)
      const doorQuery = await pool.query(
        "SELECT door_ip_entry, door_ip_exit FROM doors WHERE id = ANY($1)",
        [doors]
      );

      // Шаг 2: Обработать результат
      const doorIPs = doorQuery.rows.map((row) => ({
        entryIP: row.door_ip_entry,
        exitIP: row.door_ip_exit,
      }));

      // Шаг 3: Используем IP-адреса для запросов к Hikvision
      for (const { entryIP, exitIP } of doorIPs) {
        try {
          // --- Первый запрос: добавление пользователя на entryIP ---
          const userResponse = await client.fetch(
            `http://${entryIP}${api_set_user}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                UserInfo: {
                  employeeNo: user_id,
                  userType: "normal",
                  Valid: {
                    enable: true,
                    beginTime: "2023-01-01T00:00:00",
                    endTime: "2037-12-31T23:59:59",
                  },
                  doorRight: "1",
                  RightPlan: [
                    {
                      doorNo: 1,
                      planTemplateNo: "1",
                    },
                  ],
                  name: `${surname} ${name}`,
                },
              }),
            }
          );

          if (userResponse.ok) {
            console.log(
              `Пользователь добавлен на Hikvision с IP ${entryIP}:`,
              await userResponse.json()
            );
          } else {
            console.error(
              `Ошибка добавления пользователя на IP ${entryIP}:`,
              await userResponse.text()
            );
          }
        } catch (error) {
          console.error(
            `Ошибка при добавлении пользователя на Hikvision с IP ${entryIP}:`,
            error.message
          );
        }

        try {
          // --- Второй запрос: добавление фотографии пользователя на entryIP ---

          const photoResponse = await client.fetch(
            `http://${entryIP}${api_set_user_photo}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                faceURL: photo_url,
                faceLibType: "blackFD",
                FDID: "1",
                FPID: user_id,
                bornTime: "1990-01-01T00:00:00Z",
                name: `${surname} ${name}`,
                PicFeaturePoints: [
                  {
                    featurePointType: "face",
                    coordinatePoint: {
                      x: 160,
                      y: 160,
                      width: 1,
                      height: 1,
                    },
                  },
                ],
                saveFacePic: true,
              }),
            }
          );

          if (photoResponse.ok) {
            console.log(
              `Фото пользователя добавлено на Hikvision с IP ${entryIP}:`,
              await photoResponse.json()
            );
          } else {
            console.error(
              `Ошибка добавления фото на IP ${entryIP}:`,
              await photoResponse.text()
            );
          }
        } catch (error) {
          console.error(
            `Ошибка при добавлении фото на Hikvision с IP ${entryIP}:`,
            error.message
          );
        }

        try {
          // --- Первый запрос: добавление пользователя на entryIP ---
          const userResponse = await client.fetch(
            `http://${exitIP}${api_set_user}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                UserInfo: {
                  employeeNo: user_id,
                  userType: "normal",
                  Valid: {
                    enable: true,
                    beginTime: "2023-01-01T00:00:00",
                    endTime: "2037-12-31T23:59:59",
                  },
                  doorRight: "1",
                  RightPlan: [
                    {
                      doorNo: 1,
                      planTemplateNo: "1",
                    },
                  ],
                  name: `${surname} ${name}`,
                },
              }),
            }
          );

          if (userResponse.ok) {
            console.log(
              `Пользователь добавлен на Hikvision с IP ${exitIP}:`,
              await userResponse.json()
            );
          } else {
            console.error(
              `Ошибка добавления пользователя на IP ${exitIP}:`,
              await userResponse.text()
            );
          }
        } catch (error) {
          console.error(
            `Ошибка при добавлении пользователя на Hikvision с IP ${exitIP}:`,
            error.message
          );
        }

        try {
          // --- Второй запрос: добавление фотографии пользователя на entryIP ---
          const photoResponse = await client.fetch(
            `http://${exitIP}${api_set_user_photo}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                faceURL: photo_url,
                faceLibType: "blackFD",
                FDID: "1",
                FPID: user_id,
                bornTime: "1990-01-01T00:00:00Z",
                name: `${surname} ${name}`,
                PicFeaturePoints: [
                  {
                    featurePointType: "face",
                    coordinatePoint: {
                      x: 160,
                      y: 160,
                      width: 1,
                      height: 1,
                    },
                  },
                ],
                saveFacePic: true,
              }),
            }
          );

          if (photoResponse.ok) {
            console.log(
              `Фото пользователя добавлено на Hikvision с IP ${exitIP}:`,
              await photoResponse.json()
            );
          } else {
            console.error(
              `Ошибка добавления фото на IP ${exitIP}:`,
              await photoResponse.text()
            );
          }
        } catch (error) {
          console.error(
            `Ошибка при добавлении фото на Hikvision с IP ${exitIP}:`,
            error.message
          );
        }
      }
    }

    res.json({
      success: true,
      message: "Пользователь добавлен успешно",
      user_id: user_id,
    });
  } catch (error) {
    console.error("Ошибка при добавлении пользователя:", error.message);
    res.status(500).json({ error: "Ошибка при добавлении пользователя" });
  }
});

export default router;
