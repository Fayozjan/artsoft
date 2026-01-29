import fs from "fs";
import path from "path";
import FormData from "form-data";
import axios from "axios";
import pool from "../../../db.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function listenToEvents(botToken, bot, queue) {
  // Оригинальный код для обработки событий
  pool
    .connect()
    .then((client) => {
      client
        .query("LISTEN new_event_channel")
        .then(() => {
          client.on("notification", async (msg) => {
            if (msg.channel === "new_event_channel") {
              try {
                const event = JSON.parse(msg.payload);
                const userResult = await pool.query(
                  `SELECT 
                    u.user_id AS user_id, 
                    u.name AS user_name, 
                    p.name AS position_name, 
                    d.name AS department_name
                    FROM 
                    users u
                    LEFT JOIN 
                    position p ON u.position_id = p.id
                    LEFT JOIN 
                    departments d ON u.department_id = d.id
                    WHERE 
                    u.user_id = $1;
`,
                  [event.user_id]
                );

                if (userResult.rows.length === 0) {
                  console.log(
                    `Сотрудник с ID ${event.user_id} не найден в базе данных.`
                  );
                  return;
                }
                const { position_name, department_name } = userResult.rows[0];

                // Формируем сообщение
                const message = `👤 <b>Имя:</b> ${
                  event.user_name || "неизвестно"
                } ${event.user_id}
🏢 <b>Отдел:</b> ${department_name || "неизвестно"}
📌 <b>Должность:</b> ${position_name || "неизвестно"}
🆔 <b>ID:</b> ${event.identifier || "неизвестно"}
🕒 <b>Время:</b> ${event.event_time || "неизвестно"}
${event.event_type === "exit" ? "🔴" : "🟢"} <b>Тип:</b> ${
                  event.event_type === "exit" ? "Выход" : "Вход" || ""
                }
🚪 <b>Дверь:</b> ${event.door_name || ""}`;

                // Извлекаем список всех chat_id и users из таблицы telegram_bot
                const result = await client.query(
                  "SELECT chat_id, users FROM telegram_bot"
                );

                // Для каждого результата из базы данных
                for (const row of result.rows) {
                  const { chat_id, users } = row;

                  // Проверяем, если event.user_id находится в массиве users
                  if (users.includes(event.user_id)) {
                    // Функция для отправки фото или сообщения
                    const sendToTelegram = async (chatId) => {
                      try {
                        if (event.event_photo) {
                          const relativePhotoPath = event.event_photo.replace(
                            "api/events/",
                            ""
                          );

                          console.log("relativePhotoPath", relativePhotoPath);

                          const photoPath = path.resolve(
                            __dirname,
                            "../../../events",
                            relativePhotoPath
                          );

                          console.log("photoPath", photoPath);

                          if (fs.existsSync(photoPath)) {
                            const form = new FormData();
                            form.append("chat_id", chatId);
                            form.append("caption", message);
                            form.append(
                              "photo",
                              fs.createReadStream(photoPath)
                            );
                            form.append("parse_mode", "HTML");

                            const response = await axios.post(
                              `https://api.telegram.org/bot${botToken}/sendPhoto`,
                              form,
                              {
                                headers: {
                                  ...form.getHeaders(),
                                },
                              }
                            );

                            if (response.data.ok) {
                              console.log(
                                "Фото и сообщение отправлены в Telegram!"
                              );
                              return;
                            } else {
                              console.error(
                                "Ошибка при отправке фото:",
                                response.data
                              );
                            }
                          } else {
                            console.error("Файл с фото не найден:", photoPath);
                          }
                        }

                        // Если фото отсутствует или произошла ошибка, отправляем текстовое сообщение
                        await bot.api.sendMessage(chatId, message, {
                          parse_mode: "HTML",
                        });
                        // console.log(
                        //   'Сообщение отправлено в Telegram без фото!'
                        // );
                      } catch (error) {
                        if (
                          error.response &&
                          error.response.data &&
                          error.response.data.error_code === 429
                        ) {
                          console.log(
                            "Ошибка 429: Слишком много запросов. Повтор через 3 секунды..."
                          );
                          // Автоматический ретрай через 3 секунды
                          setTimeout(() => sendToTelegram(chatId), 3000);
                        } else {
                          console.error(
                            "Ошибка при отправке в Telegram:",
                            error
                          );
                        }
                      }
                    };

                    // Добавляем в очередь с ограничением частоты
                    await queue.add(() => sendToTelegram(chat_id)); // Отправляем сообщение пользователю
                  } else {
                    // Если user_id не найден в массиве users, выводим сообщение в консоль
                    console.log(
                      `Сотрудник с ID ${event.user_id} не найден в списке разрешенных пользователей.`
                    );
                  }
                }
              } catch (error) {
                console.error("Ошибка обработки уведомления:", error);
              }
            }
          });

          client.on("error", (err) => {
            console.error("Ошибка в клиенте PostgreSQL:", err);
          });
        })
        .catch((err) => {
          console.error("Ошибка настройки канала LISTEN:", err);
        });
    })
    .catch((err) => {
      console.error("Ошибка подключения к базе данных:", err);
    });
}
