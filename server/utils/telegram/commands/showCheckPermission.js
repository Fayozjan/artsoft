import { Keyboard } from "grammy";
import axios from "axios";
import pool from "../../../db.js";

export default function showCheckPermission(bot, mainKeyboard) {
  // Обработчик кнопки "Опоздавшие"
  bot.hears("🔍 Проверка разрешения", async (ctx) => {
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

      ctx.session.section = "verifyPermission";
      ctx.session.botChat = botChat;

      // Отправляем кнопки для выбора даты
      ctx.reply("Укажи номер разрешения");
    } catch (error) {
      console.error("Ошибка в обработке кнопки /verifyPermission:", error);
      ctx.reply("⚠️ Произошла ошибка при обработке запроса");
    }
  });

  bot.on("message:text", async (ctx) => {
    // Если пользователь нажал кнопку "Назад" — сразу обрабатываем это
    if (ctx.message.text === "Назад") {
      ctx.session.section = null;
      return ctx.reply("Вы вернулись в главное меню.", {
        reply_markup: mainKeyboard,
      });
    }

    // Если мы ожидаем ввод номера разрешения
    if (ctx.session.section === "verifyPermission") {
      const permissionNumber = ctx.message.text.trim();

      // Проверяем, что введён только номер (цифры)
      if (!/^\d+$/.test(permissionNumber)) {
        return ctx.reply(
          "❌ Неверный формат номера разрешения. Введите только цифры."
        );
      }

      try {
        const { rows } = await pool.query(
          `
        SELECT p.permission_number, p.reason, p.date_from, p.date_to,
              u.surname, u.name, u.department_name, u.position_name,
              c.full_name AS creator_full_name
        FROM permissions p
        LEFT JOIN users u ON p.user_id = u.user_id
        LEFT JOIN users c ON p.creator_id = c.user_id
        WHERE p.permission_number = $1
        `,
          [permissionNumber]
        );

        if (rows.length === 0) {
          // Разрешение не найдено — предлагаем ввести заново или выйти
          return ctx.reply(
            `Разрешение с номером ${permissionNumber} не найдено.\n` +
              "Пожалуйста, введите номер заново или нажмите кнопку 'Назад'.",
            {
              reply_markup: {
                keyboard: [[{ text: "Назад" }]],
                one_time_keyboard: true,
                resize_keyboard: true,
              },
            }
          );
        } else {
          const permission = rows[0];
          await ctx.reply(
            `<b>Информация о разрешении №${permission.permission_number}:</b>\n` +
              `ФИО: ${permission.surname || "не указано"}\n` +
              `Отдел: ${permission.department_name || "не указано"}\n` +
              `Должность: ${permission.position_name || "не указано"}\n` +
              `Причина: ${permission.reason || "не указано"}\n` +
              `Дата от: ${
                permission.date_from
                  ? permission.date_from.toLocaleString()
                  : "не указано"
              }\n` +
              `Дата до: ${
                permission.date_to
                  ? permission.date_to.toLocaleString()
                  : "не указано"
              }\n` +
              `Разрешил: ${permission.creator_full_name || "не указано"}`
          );
          // Завершаем сессию после успешной проверки
          ctx.session.section = null;
        }
      } catch (err) {
        console.error(err);
        await ctx.reply("Ошибка при получении данных. Попробуйте позже.");
        ctx.session.section = null;
      }

      return;
    }

    // Обработка других сообщений, если необходимо
  });
}
