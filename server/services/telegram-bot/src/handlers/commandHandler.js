import { Composer } from "grammy";
import { mainKeyboard } from "../keyboards/mainKeyboard.js";
import { sendDatabaseBackup } from "../services/backupService.js";

// Импортируем дочерние обработчики
import attendanceHandler from "./attendanceHandler.js";
import lateMenuHandler from "./lateMenuHandler.js";

const composer = new Composer();

composer.command("start", async (ctx) => {
  await ctx.reply(
    "👋 Привет! Я бот мониторинга.\nИспользуй кнопки меню для работы.",
    {
      reply_markup: mainKeyboard,
    },
  );
});

composer.command("backup", async (ctx) => {
  try {
    await ctx.reply("🔄 Запускаю ручной бэкап...");
    await sendDatabaseBackup(ctx.bot); // Передаем инстанс бота
    await ctx.reply("✅ Бэкап успешно отправлен!");
  } catch (err) {
    await ctx.reply("❌ Ошибка при создании бэкапа. Проверьте логи сервера.");
  }
});

// Кнопка "Назад" — общая для всех подменю
composer.hears("⬅️ Назад", async (ctx) => {
  await ctx.reply("Возвращаю в главное меню", {
    reply_markup: mainKeyboard,
  });
});

composer.use(attendanceHandler);
composer.use(lateMenuHandler);

export { composer as setupCommands };
