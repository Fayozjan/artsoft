import { Keyboard } from "grammy";
import axios from "axios";
import pool from "../../../db.js";

export default function showLateMenu(bot, mainKeyboard) {
  const lateDateKeyboard = new Keyboard()
    .text("📅 Сегодня")
    .text("📅 Вчера")
    .row()
    .text("⬅️ Назад")
    .resized();

  // Обработчик кнопки "Опоздавшие"
  bot.hears("📊 Опоздавшие", async (ctx) => {
    try {
      const chatId = ctx.chat.id;

      // Проверяем доступ чата к команде
      const {
        rows: [botChat],
      } = await pool.query(
        "SELECT users, receive_late_report FROM telegram_bot WHERE chat_id = $1",
        [chatId]
      );

      if (botChat.length === 0 || !botChat.receive_late_report) {
        return ctx.reply("❌ У вас нет доступа к этой команде", {
          reply_markup: mainKeyboard,
        });
      }

      ctx.session.section = "late";
      ctx.session.botChat = botChat;

      // Отправляем кнопки для выбора даты
      ctx.reply("Выберите период:", {
        reply_markup: lateDateKeyboard,
      });
    } catch (error) {
      console.error("Ошибка в обработке кнопки /late:", error);
      ctx.reply("⚠️ Произошла ошибка при обработке запроса");
    }
  });

  // Обработчик кнопки "Сегодня"
  bot.hears("📅 Сегодня", async (ctx) => {
    console.log(ctx.session.section);
    if (ctx.session.section === "late") {
      await handleLateRequest(ctx, "today");
    }
  });

  // Обработчик кнопки "Вчера"
  bot.hears("📅 Вчера", async (ctx) => {
    console.log(ctx.session.section);
    if (ctx.session.section === "late") {
      await handleLateRequest(ctx, "yesterday");
    }
  });

  // Обработчик кнопки "Назад"
  bot.hears("⬅️ Назад", async (ctx) => {
    await ctx.reply("Главное меню:", {
      reply_markup: mainKeyboard,
    });
  });

  // Функция для обработки запроса опоздавших сотрудников
  const handleLateRequest = async (ctx, period) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 864e5)
        .toISOString()
        .split("T")[0];

      const date = period === "today" ? today : yesterday;

      const botChat = ctx.session.botChat;

      if (botChat.length === 0 || !botChat.receive_late_report) {
        return ctx.reply("❌ У вас нет доступа к этой команде", {
          reply_markup: mainKeyboard,
        });
      }

      const response = await axios.post(
        "http://localhost:7000/api/late/by-users",
        {
          date: date,
          user_ids: botChat.users,
        }
      );

      if (!response.data.success) {
        return ctx.reply("⚠️ Ошибка при получении данных с сервера", {
          reply_markup: mainKeyboard,
        });
      }

      const { lateEmployees } = response.data.data;

      if (!lateEmployees || lateEmployees.length === 0) {
        return ctx.reply(`✅ На ${date} нет опоздавших сотрудников`, {
          reply_markup: mainKeyboard,
        });
      }

      // 🧱 Формируем сообщение по частям
      const header = `📊 <b>Список опоздавших на ${date}:</b>\n\n`;
      const parts = [];
      let currentMessage = "";

      lateEmployees.forEach((emp, index) => {
        const entry =
          `${index + 1}. <b>${emp.surname || ""} ${emp.name || ""} ${
            emp.patronymic || ""
          }</b>\n` +
          `   Отдел: ${emp.department_name}\n` +
          `   ⏱ Опоздание: <b>${emp.late_minutes} мин.</b>\n` +
          `   (${emp.scheduled_start.substring(0, 5)} → ${
            emp.actual_start
          })\n\n`;

        if ((header + currentMessage + entry).length > 4000) {
          parts.push(currentMessage);
          currentMessage = entry;
        } else {
          currentMessage += entry;
        }
      });

      if (currentMessage.length > 0) {
        parts.push(currentMessage);
      }

      // 📨 Отправляем по частям
      for (let i = 0; i < parts.length; i++) {
        const text = (i === 0 ? header : "") + parts[i];
        await ctx.reply(text, { parse_mode: "HTML" });
      }
    } catch (error) {
      console.error("Ошибка в команде /late:", error);
      ctx.reply("⚠️ Произошла ошибка при обработке запроса", {
        reply_markup: mainKeyboard,
      });
    }
  };
}
