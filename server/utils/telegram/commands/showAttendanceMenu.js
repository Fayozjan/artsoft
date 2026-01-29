import { Keyboard } from "grammy";
import axios from "axios";
import pool from "../../../db.js";

import ExcelJS from "exceljs";

import fs from "fs";
import fspromises from "fs/promises";

import path from "path";
import FormData from "form-data";

async function sendAttendanceFile(botToken, chatId, date) {
  const filePath = path.resolve(`./uploads/attendance_${date}.xlsx`);

  if (!fs.existsSync(filePath)) {
    throw new Error("Файл отчёта не найден");
  }

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("document", fs.createReadStream(filePath));
  form.append("caption", `Отчёт за дату ${date}`);
  form.append("parse_mode", "HTML");

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      form,
      {
        headers: form.getHeaders(),
      }
    );

    if (response.data.ok) {
      console.log("Файл успешно отправлен в Telegram");
    } else {
      console.error("Ошибка при отправке файла:", response.data);
    }
  } catch (error) {
    console.error("Ошибка запроса к Telegram API:", error.message || error);
  }
}

const generateAttendanceExcel = async (date, groupedData) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");

  // Заголовки таблицы
  sheet.columns = [
    { header: "Отдел", key: "department", width: 25 },
    { header: "Имя", key: "name", width: 25 },
    { header: "Должность", key: "position", width: 25 },
    { header: "Вход", key: "entry", width: 15 },
    { header: "Выход", key: "exit", width: 15 },
    { header: "Отработано", key: "worked", width: 15 },
  ];

  // Заполняем строки
  for (const [department, employees] of Object.entries(groupedData)) {
    for (const emp of employees) {
      sheet.addRow({
        department,
        name: emp.name,
        position: emp.position,
        entry: emp.entry || "нет входа",
        exit: emp.exit || "нет выхода",
        worked: emp.workDuration ?? "00:00",
      });
    }
  }

  const filePath = path.resolve(`./uploads/attendance_${date}.xlsx`);

  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

export default function showAttendanceMenu(botToken, bot, mainKeyboard) {
  const attendanceDateKeyboard = new Keyboard()
    .text("🗓 Сегодня ")
    .text("🗓 Вчера ")
    .row()
    .text("⬅️ Назад")
    .resized();

  // Обработчик кнопки "Опоздавшие"
  bot.hears("📈 Посещаемость", async (ctx) => {
    try {
      const chatId = ctx.chat.id;

      // Проверяем доступ чата к команде
      const {
        rows: [botChat],
      } = await pool.query(
        "SELECT users, receive_attendance_report FROM telegram_bot WHERE chat_id = $1",
        [chatId]
      );

      if (botChat.length === 0 || !botChat.receive_attendance_report) {
        return ctx.reply("❌ У вас нет доступа к этой команде", {
          reply_markup: mainKeyboard,
        });
      }

      ctx.session.section = "attendance";
      ctx.session.botChat = botChat;

      // Отправляем кнопки для выбора даты
      ctx.reply("Выберите период:", {
        reply_markup: attendanceDateKeyboard,
      });
    } catch (error) {
      console.error("Ошибка в обработке кнопки /late:", error);
      ctx.reply("⚠️ Произошла ошибка при обработке запроса");
    }
  });

  // Обработчик кнопки "Сегодня"
  bot.hears("🗓 Сегодня", async (ctx) => {
    await handleAttendanceRequest(ctx, "today");
  });

  // Обработчик кнопки "Вчера"
  bot.hears("🗓 Вчера", async (ctx) => {
    await handleAttendanceRequest(ctx, "yesterday");
  });

  // Обработчик кнопки "Назад"
  bot.hears("⬅️ Назад", async (ctx) => {
    await ctx.reply({
      reply_markup: mainKeyboard,
    });
  });

  // Функция для обработки запроса посещаемости сотрудников
  const handleAttendanceRequest = async (ctx, period) => {
    try {
      const chatId = ctx.chat.id;
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 864e5)
        .toISOString()
        .split("T")[0];

      const date = period === "today" ? today : yesterday;

      const botChat = ctx.session.botChat;

      if (!botChat || !botChat.receive_attendance_report) {
        return ctx.reply("❌ У вас нет доступа к этой команде", {
          reply_markup: mainKeyboard,
        });
      }

      const response = await axios.post(
        "http://localhost:7000/api/attendance/by-users",
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

      const attendanceData = response.data.data;

      if (!attendanceData || attendanceData.length === 0) {
        return ctx.reply(`ℹ️ На ${date} нет данных о посещаемости`, {
          reply_markup: mainKeyboard,
        });
      }

      // 🧱 Группируем по отделам
      const groupedByDepartment = {};

      attendanceData.forEach((emp) => {
        const department = emp.department || "Без отдела";
        if (!groupedByDepartment[department]) {
          groupedByDepartment[department] = [];
        }
        groupedByDepartment[department].push(emp);
      });

      const header = `📊 <b>Посещаемость за ${date}:</b>\n\n`;
      const parts = [];
      let currentMessage = "";

      // Проходим по отделам
      for (const [department, employees] of Object.entries(
        groupedByDepartment
      )) {
        let deptSection = `🏢 <b>${department}</b>\n`;

        employees.forEach((emp, index) => {
          const entry =
            `${index + 1}. <b>${emp.name}</b>\n` +
            `   📌 Должность: ${emp.position}\n` +
            `   ⏱ Время: ${emp.entry ? emp.entry : "нет входа"} - ${
              emp.exit ? emp.exit : "нет выхода"
            }\n` +
            `   💼 Отработано: ${emp.workDuration ?? "-"}\n\n`;

          deptSection += entry;
        });

        const totalLength = attendanceData.length;

        if (totalLength > 30) {
          const filePath = await generateAttendanceExcel(
            date,
            groupedByDepartment
          );

          // Проверяем, что файл существует
          if (!fs.existsSync(filePath)) {
            return ctx.reply("❌ Файл отчёта не найден");
          }

          await sendAttendanceFile(botToken, ctx.chat.id, date);
          await fspromises.unlink(filePath);

          return;
        }

        // Если сообщение превышает лимит — разбиваем
        if ((header + currentMessage + deptSection).length > 4000) {
          parts.push(currentMessage);
          currentMessage = deptSection;
        } else {
          currentMessage += deptSection;
        }
      }

      // Добавляем последнюю часть
      if (currentMessage.length > 0) {
        parts.push(currentMessage);
      }

      // 📨 Отправляем по частям
      for (let i = 0; i < parts.length; i++) {
        const text = (i === 0 ? header : "") + parts[i];
        await ctx.reply(text, { parse_mode: "HTML" });
      }
    } catch (error) {
      console.error("Ошибка в команде /attendance:", error);
      ctx.reply("⚠️ Произошла ошибка при обработке запроса", {
        reply_markup: mainKeyboard,
      });
    }
  };
}
