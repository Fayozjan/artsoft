import { Composer, Keyboard } from "grammy";
import axios from "axios";
import pool from "../../../../db.js";

const composer = new Composer();

const lateDateKeyboard = new Keyboard()
  .text("📅 Сегодня")
  .text("📅 Вчера")
  .row()
  .text("⬅️ Назад")
  .resized();

composer.hears("📊 Опоздавшие", async (ctx) => {
  try {
    const { rows } = await pool.query(
      "SELECT users, receive_late_report FROM telegram_bot WHERE chat_id = $1",
      [ctx.chat.id],
    );

    const botChat = rows[0];

    if (!botChat?.receive_late_report) {
      return ctx.reply("❌ У вас нет доступа к этой команде");
    }

    // Сохраняем состояние в сессию
    ctx.session.section = "late";
    ctx.session.botChat = botChat;

    await ctx.reply("Выберите период для отчета по опозданиям:", {
      reply_markup: lateDateKeyboard,
    });
  } catch (error) {
    console.error("Error in late menu access:", error);
    await ctx.reply("⚠️ Ошибка проверки прав доступа.");
  }
});

composer.hears(["📅 Сегодня", "📅 Вчера"], async (ctx) => {
  if (ctx.session.section !== "late") return;

  const period = ctx.message.text.includes("Сегодня") ? "today" : "yesterday";
  await handleLateRequest(ctx, period);
});

/**
 * Основная логика получения данных и отправки
 */
async function handleLateRequest(ctx, period) {
  const date =
    period === "today"
      ? new Date().toISOString().split("T")[0]
      : new Date(Date.now() - 864e5).toISOString().split("T")[0];

  const botChat = ctx.session.botChat;
  if (!botChat)
    return ctx.reply("Сессия истекла. Нажмите '📊 Опоздавшие' снова.");

  try {
    await ctx.reply(`🔍 Загружаю список за ${date}...`);

    const { data: res } = await axios.post(
      `${process.env.BACKEND_URL}/api/late/by-users`,
      {
        date,
        user_ids: botChat.users,
      },
    );

    if (!res.success) throw new Error("Backend response error");

    const { lateEmployees } = res.data;

    if (!lateEmployees || lateEmployees.length === 0) {
      return ctx.reply(`✅ На ${date} опозданий не зафиксировано.`);
    }

    // Форматируем и отправляем (с учетом лимитов Telegram)
    const messages = formatLateText(date, lateEmployees);
    for (const msg of messages) {
      await ctx.reply(msg, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("Late Request Error:", error.message);
    await ctx.reply("⚠️ Не удалось получить данные об опозданиях.");
  }
}

/**
 * Хелпер для формирования текста сообщений
 */
function formatLateText(date, employees) {
  const header = `📊 <b>Список опоздавших на ${date}:</b>\n\n`;
  const parts = [];
  let currentPart = "";

  employees.forEach((emp, index) => {
    const fullName = [emp.surname, emp.name, emp.patronymic]
      .filter(Boolean)
      .join(" ");
    const line =
      `${index + 1}. <b>${fullName}</b>\n` +
      `   🏢 ${emp.department_name}\n` +
      `   ⏱ Опоздание: <b>${emp.late_minutes} мин.</b>\n` +
      `   (${emp.scheduled_start?.substring(0, 5)} → ${emp.actual_start})\n\n`;

    // Если добавление этой строки превысит лимит 4096 символов
    if (header.length + currentPart.length + line.length > 4000) {
      parts.push(currentPart);
      currentPart = line;
    } else {
      currentPart += line;
    }
  });

  parts.push(currentPart);

  // Добавляем заголовок только к первой части
  return parts.map((text, i) => (i === 0 ? header + text : text));
}

export default composer;
