import { Bot, session } from "grammy";

import cron from "node-cron";

import { startNotificationsWorker } from "./src/workers/notificationsWorker.js";
import { setupCommands } from "./src/handlers/commandHandler.js";
import { sendDatabaseBackup } from "./src/services/backupService.js";
import { notificationsOutboxService } from "../../modules/notificationsOutbox/notificationsOutbox.service.js";

const bot = new Bot(process.env.BOT_TOKEN);

function initBackUpScheduler() {
  cron.schedule(
    "0 19 * * *",
    async () => {
      try {
        await sendDatabaseBackup(bot);
      } catch (err) {
        console.error("❌ Ошибка в планировщике бэкапа:", err);
      }
    },
    { timezone: "Asia/Tashkent" },
  );

  console.log(`📅 Планировщик бэкапов запущен`);
}

function initCleanupNotificationScheduler() {
  cron.schedule(
    "0 19 * * *",
    async () => {
      try {
        const deleted =
          await notificationsOutboxService.deleteOldSentNotifications();
        console.log(`🗑 Удалено отправленных уведомлений: ${deleted.count}`);
      } catch (err) {
        console.error("❌ Ошибка при удалении отправленных уведомлений:", err);
      }
    },
    { timezone: "Asia/Tashkent" },
  );

  console.log("🗑 Планировщик очистки отправленных уведомлений запущен");
}

export async function startTelegramBot() {
  bot.use(
    session({
      initial: () => ({ section: null, botChat: null }),
    }),
  );

  bot.use(setupCommands);

  try {
    startNotificationsWorker(bot);
  } catch (err) {
    console.error("❌ Не удалось запустить startNotificationsWorker:", err);
  }

  initBackUpScheduler();
  initCleanupNotificationScheduler();

  return bot.start({
    onStart: (info) => console.log(`✨ Телеграм бот запущен`),
    drop_pending_updates: true,
  });
}
