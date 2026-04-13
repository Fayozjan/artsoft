import fs from "fs";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import path from "path";
import { InputFile } from "grammy";
import { notificationsOutboxModel } from "../modules/notificationsOutbox/notificationsOutbox.model.js";
import PQueue from "p-queue";
import { Bot } from "grammy";

const queueGlobal = new PQueue({ interval: 1000, intervalCap: 30 });
const queuePerChat = new Map();
const processingIds = new Set();

const POLL_INTERVAL = 5000;
const MAX_RETRIES = 3;

function getQueueForChat(chatId) {
  if (!queuePerChat.has(chatId)) {
    queuePerChat.set(chatId, new PQueue({ interval: 1000, intervalCap: 1 }));
  }
  return queuePerChat.get(chatId);
}

function toTashkentTime(date) {
  return new Date(new Date(date).getTime() + 5 * 60 * 60 * 1000);
}

const parsePlate = (raw = "") => {
  const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  // 50Z436BB
  let match = clean.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/);
  if (match) {
    const region = match[1],
      series = match[2],
      number = match[3],
      suffix = match[4];
    return {
      region,
      series,
      number,
      suffix,
      formatted: `${region} ${series} ${number} ${suffix}`,
    };
  }

  // 50717CAA
  match = clean.match(/^(\d{2})(\d{3})([A-Z]{3})$/);
  if (match) {
    const region = match[1],
      number = match[2],
      suffix = match[3];
    return {
      region,
      series: null,
      number,
      suffix,
      formatted: `${region} ${number} ${suffix}`,
    };
  }

  // 8570BA50 → 50 857 BA
  match = clean.match(/^(\d{3,4})([A-Z]{2})(\d{2})$/);
  if (match) {
    const region = match[3],
      number = match[1],
      suffix = match[2];
    return {
      region,
      series: null,
      number,
      suffix,
      formatted: `${region} ${number} ${suffix}`,
    };
  }

  return {
    region: null,
    series: null,
    number: raw || "—",
    suffix: null,
    formatted: raw || "—",
  };
};

// ─── Построение сообщения из payload ─────────────────────────────────────────

function buildFacePassMessage(payload) {
  const formattedDate = format(
    toTashkentTime(payload.date),
    "dd.MM.yyyy HH:mm",
    {
      locale: ru,
    },
  );

  const text = [
    `${payload.direction === "exit" ? "🔴 Выход" : "🟢 Вход"} ${formattedDate}`,
    `🚪 <b>Дверь:</b> ${payload.door_name || "—"}`,
    "",
    `👤 <b>ФИО:</b> ${payload.full_name || "—"}`,
    `🏢 <b>Филиал:</b> ${payload.branch || "неизвестно"}`,
    `🏛️ <b>Отдел:</b> ${payload.department || "неизвестно"}`,
    `💼 <b>Должность:</b> ${payload.position || "неизвестно"}`,
  ].join("\n");

  const photoPath = payload.photo
    ? path.resolve(process.cwd(), payload.photo)
    : null;

  return { text, photoPath };
}

function buildAnprPassMessage(payload) {
  const formattedDate = format(
    toTashkentTime(payload.date),
    "dd.MM.yyyy HH:mm",
    {
      locale: ru,
    },
  );

  const directionLabel =
    payload.direction === "forward"
      ? "🟢 Въезд"
      : payload.direction === "reverse"
        ? "🔴 Выезд"
        : "📅";

  const text = [
    `${directionLabel} ${formattedDate}`,
    `🚗 <b>Номер:</b> ${parsePlate(payload.plate_number).formatted}`,
    "",
    `🏢 <b>Филиал:</b> ${payload.branch_name || "—"}`,
    `⛩ <b>Ворота:</b> ${payload.gate_name || "—"}`,
  ].join("\n");

  const photoPath = payload.photo
    ? path.resolve(process.cwd(), payload.photo)
    : null;

  return { text, photoPath };
}

function buildMessage(source_type, payload) {
  switch (source_type) {
    case "face_pass":
      return buildFacePassMessage(payload);
    case "anpr_pass":
      return buildAnprPassMessage(payload);
    default:
      throw new Error(`Unknown source_type: ${source_type}`);
  }
}

// ─── Отправка одного уведомления ─────────────────────────────────────────────

async function sendNotification(bot, notification) {
  const { id, chat_id, source_type, payload, retry_count } = notification;

  try {
    const { text, photoPath } = buildMessage(source_type, payload);
    const hasPhoto = photoPath && fs.existsSync(photoPath);

    if (hasPhoto) {
      await bot.api.sendPhoto(chat_id, new InputFile(photoPath), {
        caption: text,
        parse_mode: "HTML",
      });
    } else {
      await bot.api.sendMessage(chat_id, text, { parse_mode: "HTML" });
    }

    await notificationsOutboxModel.update(id, { status: "sent" });
  } catch (err) {
    const update =
      retry_count < MAX_RETRIES
        ? { retry_count: { increment: 1 } }
        : { status: "error", error: err.message };

    await notificationsOutboxModel.update(id, update);
  }
}

// ─── Воркер ──────────────────────────────────────────────────────────────────

async function processNotifications(bot) {
  try {
    const notifications = await notificationsOutboxModel.findMany({
      filter: { status: "pending" },
      orderBy: { event_date: "asc" },
      take: 100,
    });

    if (!notifications.length) return;

    for (const notification of notifications) {
      if (processingIds.has(notification.id)) continue;
      processingIds.add(notification.id);

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

// ─── Запуск ──────────────────────────────────────────────────────────────────

export function startNotificationsWorker() {
  if (!process.env.BOT_TOKEN) {
    console.error("❌ BOT_TOKEN не задан, воркер не запущен");
    return;
  }

  const bot = new Bot(process.env.BOT_TOKEN);
  console.log("🤖 Notifications worker started");

  // Сразу первый вызов, потом каждые 5 сек
  processNotifications(bot);
  setInterval(() => processNotifications(bot), POLL_INTERVAL);
}
