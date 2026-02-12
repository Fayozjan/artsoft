import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { InputFile } from "grammy";

// Превращаем старый execFile в современный Promise-based метод
const execFilePromise = promisify(execFile);

/**
 * Сервис для создания и отправки бэкапов БД
 */
export async function sendDatabaseBackup(bot) {
  const { DB_NAME, DB_USER, DB_PASSWORD, PG_DUMP_PATH, SERVER_TYPE, CHAT_ID } =
    process.env;

  const backupFileName = `backup-${new Date().toISOString().slice(0, 10)}.sql`;
  const backupPath = path.resolve(process.cwd(), backupFileName);

  // Настройка окружения для pg_dump
  const env = {
    ...process.env,
    PGPASSWORD: DB_PASSWORD,
    PATH:
      SERVER_TYPE === "WINDOWS"
        ? `${process.env.PATH};${PG_DUMP_PATH}`
        : process.env.PATH,
  };

  const args = ["-U", DB_USER, "-F", "c", "-f", backupPath, DB_NAME];

  try {
    console.log(`📦 Запуск создания бэкапа для базы: ${DB_NAME}...`);

    // 1. Выполнение дампа
    await execFilePromise("pg_dump", args, { env });

    // 2. Отправка в Telegram через API grammY (без axios и FormData)
    console.log(`📤 Отправка файла ${backupFileName} в чат ${CHAT_ID}...`);

    await bot.api.sendDocument(CHAT_ID, new InputFile(backupPath), {
      caption: `✅ <b>Ежедневный бэкап базы данных</b>\n📅 Дата: ${new Date().toLocaleString()}`,
      parse_mode: "HTML",
    });

    // 3. Удаление временного файла после отправки (Senior-стандарт: не мусорить на сервере)
    if (fs.existsSync(backupPath)) {
      await fs.promises.unlink(backupPath);
      console.log("🧹 Временный файл бэкапа удален.");
    }

    return true;
  } catch (error) {
    console.error("❌ Ошибка в backupService:", error.message);

    // Пытаемся уведомить админа об ошибке
    try {
      await bot.api.sendMessage(
        CHAT_ID,
        `⚠️ <b>Ошибка бэкапа:</b>\n<code>${error.message}</code>`,
        {
          parse_mode: "HTML",
        },
      );
    } catch (msgErr) {
      console.error("Не удалось отправить уведомление об ошибке в ТГ");
    }

    throw error;
  }
}
