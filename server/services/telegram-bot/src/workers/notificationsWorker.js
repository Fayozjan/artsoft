import fs from "fs";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import path from "path";
import { InputFile } from "grammy";
import { notificationsOutboxService } from "../../../../modules/notificationsOutbox/notificationsOutbox.service.js";
import PQueue from "p-queue";

// Глобальная очередь для всего бота (макс 30 сообщений/сек)
const queueGlobal = new PQueue({ interval: 1000, intervalCap: 30 });

// Очереди на каждый чат (макс 1 сообщение/сек на чат)
const queuePerChat = new Map();

// Отслеживание обрабатываемых уведомлений
const processingIds = new Set();

function getQueueForChat(chatId) {
  if (!queuePerChat.has(chatId)) {
    queuePerChat.set(chatId, new PQueue({ interval: 1000, intervalCap: 1 }));
  }
  return queuePerChat.get(chatId);
}

const POLL_INTERVAL = 5000;
const MAX_RETRIES = 3;

async function sendNotification(bot, notification) {
  const { id, chat_id, facePass, retry_count } = notification;

  const fullName = [
    facePass?.employee?.last_name,
    facePass?.employee?.first_name,
    facePass?.employee?.middle_name,
    facePass?.employee?.id,
  ]
    .filter(Boolean)
    .join(" ");

  const formatedDate = format(new Date(facePass?.date), "dd.MM.yyyy HH:mm", {
    locale: ru,
  });

  try {
    let text = [
      `${facePass?.direction === "exit" ? "🔴 Выход" : "🟢 Вход"} ${formatedDate}`,
      `🚪 <b>Дверь:</b> ${facePass?.door?.name || "—"}`,
      "",
      `👤 <b>ФИО:</b> ${fullName}`,
      `🏢 <b>Филиал:</b> ${facePass?.employee?.branch?.name || "неизвестно"}`,
      `🏛️ <b>Отдел:</b> ${facePass?.employee?.department?.name || "неизвестно"}`,
      `💼 <b>Должность:</b> ${facePass?.employee?.position?.name || "неизвестно"}`,
    ].join("\n");

    if (facePass.photo) {
      const photoPath = path.resolve(
        process.cwd(),
        "..",
        "server",
        facePass?.photo.replace("api/events/", "events/"),
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

    await notificationsOutboxService.updateNotification(id, {
      status: "sent",
    });
  } catch (err) {
    if (retry_count < MAX_RETRIES) {
      await notificationsOutboxService.updateNotification(id, {
        retry_count: { increment: 1 },
      });
    } else {
      await notificationsOutboxService.updateNotification(id, {
        status: "error",
      });
    }
  }
}

async function processNotifications(bot) {
  try {
    const notifications =
      await notificationsOutboxService.getPendingNotifications();
    if (!notifications.length) return;

    for (const notification of notifications) {
      if (processingIds.has(notification.id)) continue;
      processingIds.add(notification.id);

      // Добавляем задачу в глобальную очередь, которая внутри ставит её в очередь на чат
      queueGlobal.add(async () => {
        const chatQueue = getQueueForChat(notification.chat_id);
        await chatQueue.add(() => sendNotification(bot, notification));
        processingIds.delete(notification.id);
      });
    }
  } catch (err) {
    console.error("Ошибка при обработке очереди уведомлений:", err);
  }
}

export function startNotificationsWorker(bot) {
  setInterval(() => processNotifications(bot), POLL_INTERVAL);
}
