import { Composer, Keyboard, InputFile } from "grammy";
import axios from "axios";
import fs from "node:fs/promises";
import pool from "../services/db.js";
import { generateAttendanceExcel } from "../services/excelService.js";

const composer = new Composer();

const attendanceDateKeyboard = new Keyboard()
  .text("🗓 Сегодня")
  .text("🗓 Вчера")
  .row()
  .text("⬅️ Назад")
  .resized();

// Главный вход в меню посещаемости
composer.hears("📈 Посещаемость", async (ctx) => {
  const { rows } = await pool.query(
    "SELECT users, receive_attendance_report FROM telegram_bot WHERE chat_id = $1",
    [ctx.chat.id],
  );

  const botChat = rows[0];
  if (!botChat?.receive_attendance_report) {
    return ctx.reply("❌ У вас нет доступа к этой команде");
  }

  ctx.session.botChat = botChat; // Сохраняем в сессию для быстрого доступа
  await ctx.reply("Выберите период:", { reply_markup: attendanceDateKeyboard });
});

// Универсальный обработчик дат
composer.hears(["🗓 Сегодня", "🗓 Вчера"], async (ctx) => {
  const period = ctx.message.text.includes("Сегодня") ? "today" : "yesterday";
  await handleAttendanceRequest(ctx, period);
});

async function handleAttendanceRequest(ctx, period) {
  const date =
    period === "today"
      ? new Date().toISOString().split("T")[0]
      : new Date(Date.now() - 864e5).toISOString().split("T")[0];

  const botChat = ctx.session.botChat;
  if (!botChat)
    return ctx.reply("Сессия истекла, нажмите '📈 Посещаемость' снова.");

  try {
    await ctx.reply("⏳ Загрузка данных...");

    // Запрос к Backend API
    const { data: res } = await axios.post(
      `${process.env.BACKEND_URL}/api/attendance/by-users`,
      {
        date,
        user_ids: botChat.users,
      },
    );

    if (!res.success || !res.data?.length) {
      return ctx.reply(`ℹ️ На ${date} данные не найдены.`);
    }

    const grouped = groupEmployeesByDept(res.data);

    // Если данных много — шлем файл
    if (res.data.length > 30) {
      const filePath = await generateAttendanceExcel(date, grouped);
      try {
        await ctx.replyWithDocument(new InputFile(filePath), {
          caption: `📊 Отчёт за ${date}`,
        });
      } finally {
        await fs.unlink(filePath).catch(() => {}); // Удаляем в любом случае
      }
      return;
    }

    // Если данных мало — шлем текстом (с разбивкой)
    const messages = formatAttendanceText(date, grouped);
    for (const msg of messages) {
      await ctx.reply(msg, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("Attendance Error:", error);
    await ctx.reply("⚠️ Ошибка сервера при получении данных.");
  }
}

// Helpers
function groupEmployeesByDept(data) {
  return data.reduce((acc, emp) => {
    const dept = emp.department || "Без отдела";
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(emp);
    return acc;
  }, {});
}

function formatAttendanceText(date, grouped) {
  const header = `📊 <b>Посещаемость за ${date}:</b>\n\n`;
  const parts = [];
  let current = "";

  for (const [dept, emps] of Object.entries(grouped)) {
    let section = `🏢 <b>${dept}</b>\n`;
    emps.forEach((emp, i) => {
      section +=
        `${i + 1}. <b>${emp.name}</b>\n` +
        `   ⏱ ${emp.entry || "—"} - ${emp.exit || "—"} (${emp.workDuration || "-"})\n\n`;
    });

    if ((header + current + section).length > 4000) {
      parts.push(current);
      current = section;
    } else {
      current += section;
    }
  }
  parts.push(current);
  return parts.map((p, i) => (i === 0 ? header + p : p));
}

export default composer;
