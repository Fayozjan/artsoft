import { Bot, session } from "grammy";
import PQueue from "p-queue";
import cron from "node-cron";

import { startNotificationsWorker } from "./workers/notificationsWorker.js";
import { setupCommands } from "./handlers/commandHandler.js";
import { sendDatabaseBackup } from "./services/backupService.js";

const bot = new Bot(process.env.BOT_TOKEN);
const queue = new PQueue({ interval: 1000, intervalCap: 1 });

function initScheduler() {
  const backupTime = process.env.BACKUP_TIME;
  if (!backupTime) {
    console.warn("⚠️ BACKUP_TIME не задан. Автоматические бэкапы отключены.");
    return;
  }

  cron.schedule(
    backupTime,
    async () => {
      console.log("⏰ Запуск планового бэкапа...");
      try {
        await sendDatabaseBackup(bot);
      } catch (err) {
        console.error("❌ Ошибка в планировщике бэкапа:", err);
      }
    },
    { timezone: "Asia/Tashkent" },
  );

  console.log(`📅 Планировщик бэкапов запущен: ${backupTime}`);
}

export async function startBot() {
  bot.use(
    session({
      initial: () => ({ section: null, botChat: null }),
    }),
  );

  bot.use(setupCommands);

  try {
    startNotificationsWorker(bot, queue);
  } catch (err) {
    console.error("❌ Не удалось запустить startNotificationsWorker:", err);
  }

  initScheduler();

  return bot.start({
    onStart: (info) => console.log(`✨ Бот @${info.username} запущен`),
    drop_pending_updates: true,
  });
}
