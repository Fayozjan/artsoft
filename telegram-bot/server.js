import pool from "./src/services/db.js";

import { startBot } from "./src/bot.js";

async function main() {
  try {
    // Проверяем БД перед стартом
    await pool.query("SELECT 1");
    console.log("🐘 База данных подключена успешно");

    await startBot();
  } catch (err) {
    console.error("💥 Критическая ошибка при запуске:", err);
    process.exit(1);
  }
}

main();
