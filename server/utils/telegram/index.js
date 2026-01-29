import cron from "node-cron";
import { Keyboard, Bot, session } from "grammy";
import PQueue from "p-queue";
import dotenv from "dotenv";

dotenv.config();

import showLateMenu from "./commands/showLateMenu.js";
import listenToEvents from "./commands/listenToEvents.js";
import showAttendanceMenu from "./commands/showAttendanceMenu.js";
import { sendDatabaseBackup } from "./commands/sendBackup.js";
import showCheckPermission from "./commands/showCheckPermission.js";

export function Telegram(botToken) {
  const bot = new Bot(botToken);
  const queue = new PQueue({ interval: 1000, intervalCap: 1 });
  bot.use(session({ initial: () => ({}) }));

  const mainKeyboard = new Keyboard()
    .text("📊 Опоздавшие")
    .row()
    .text("📈 Посещаемость")
    .row()
    .text("🔍 Проверка разрешения")
    .resized();

  bot.command("start", (ctx) => {
    ctx.reply(
      "Привет! Используй кнопки для работы с ботом или дождитесь событий",
      {
        reply_markup: mainKeyboard,
      }
    );
  });

  showLateMenu(bot, mainKeyboard);
  showCheckPermission(bot, mainKeyboard);
  showAttendanceMenu(botToken, bot, mainKeyboard);
  listenToEvents(botToken, bot, queue);

  if (!process.env.BACKUP_TIME) {
    console.error("❌ BACKUP_TIME не задан в .env!");
  }

  // Планируем отправку бэкапа
  cron.schedule(
    process.env.BACKUP_TIME,
    () => {
      sendDatabaseBackup(botToken).catch((err) =>
        console.error("Ошибка при отправке бэкапа:", err)
      );
    },
    {
      timezone: "Asia/Tashkent",
    }
  );

  bot.command("backup", (ctx) => {
    sendDatabaseBackup(botToken)
      .then(() => ctx.reply("✅ Бэкап успешно отправлен!"))
      .catch(() => ctx.reply("❌ Произошла ошибка при отправке бэкапа."));
  });

  bot.start();
  return bot;
}
