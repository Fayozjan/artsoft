import fs from "fs";
import path from "path";
import { InputFile } from "grammy";
import pool from "../services/db.js";

const POLL_INTERVAL = 2000;
const MAX_RETRIES = 3;

async function sendNotification(bot, notification) {
  const { id, chat_id, payload, retry_count } = notification;

  try {
    const {
      user_name,
      user_id,
      event_type,
      door_name,
      event_time,
      event_photo,
    } = payload;

    let text = [
      `👤 <b>Имя:</b> ${user_name} (id: ${user_id})`,
      `🕒 <b>Время:</b> ${event_time}`,
      `🚪 <b>Дверь:</b> ${door_name || "—"}`,
      `${event_type === "exit" ? "🔴 Выход" : "🟢 Вход"}`,
    ].join("\n");

    if (event_photo) {
      const photoPath = path.resolve(
        process.cwd(),
        "..",
        "server",
        event_photo.replace("api/events/", "events/"),
      );
      if (fs.existsSync(photoPath)) {
        await bot.api.sendPhoto(chat_id, new InputFile(photoPath), {
          caption: text,
          parse_mode: "HTML",
        });
      } else {
        await bot.api.sendMessage(chat_id, text, { parse_mode: "HTML" });
      }
    } else {
      await bot.api.sendMessage(chat_id, text, { parse_mode: "HTML" });
    }

    // помечаем как отправленное
    await pool.query(
      `UPDATE notifications_outbox SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [id],
    );
    console.log(`✅ Уведомление ${id} доставлено пользователю ${chat_id}`);
  } catch (err) {
    console.error(
      `❌ Ошибка отправки уведомления ${id} пользователю ${chat_id}:`,
      err.message,
    );

    if (retry_count + 1 < MAX_RETRIES) {
      await pool.query(
        `UPDATE notifications_outbox SET retry_count = retry_count + 1, updated_at = NOW() + INTERVAL '5 seconds' WHERE id = $1`,
        [id],
      );
    } else {
      // увеличиваем retry_count и оставляем pending
      await pool.query(
        `UPDATE notifications_outbox SET retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1`,
        [id],
      );
    }
  }
}

async function processNotifications(bot, queue) {
  try {
    // Берём "pending" уведомления, можно по одной или batch
    const res = await pool.query(`
      SELECT id, chat_id, payload, retry_count
      FROM notifications_outbox
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
    `);

    if (res.rows.length === 0) return;

    for (const notification of res.rows) {
      queue.add(() => sendNotification(bot, notification));
    }
  } catch (err) {
    console.error("Ошибка при обработке очереди уведомлений:", err);
  }
}

export function startNotificationsWorker(bot, queue) {
  console.log("🚀 Worker уведомлений запущен...");
  setInterval(() => processNotifications(bot, queue), POLL_INTERVAL);
}
