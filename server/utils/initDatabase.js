import fs from "fs";
import pg from "pg";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import seed from "../prisma/seed.js";
import { PrismaClient } from "@prisma/client";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initDatabase(databaseUrl) {
  const match = databaseUrl.match(
    /postgresql:\/\/(.*?):(.*?)@(.*?):(\d+)\/(.*)/
  );
  if (!match) throw new Error("❌ Неверный формат DATABASE_URL");

  const [_, user, password, host, port, database] = match;

  const client = new Client({
    user,
    password,
    host,
    port,
    database: "postgres",
  });

  await client.connect();

  // --- Проверяем, существует ли база
  const res = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = '${database}'`
  );

  let isNewDatabase = false;

  if (res.rowCount === 0) {
    console.log(`📦 База "${database}" не найдена — создаю...`);
    await client.query(`CREATE DATABASE "${database}"`);
    console.log("✅ База успешно создана!");
    isNewDatabase = true;
  } else {
    console.log("✅ База уже существует.");
  }

  await client.end();

  // --- Применяем миграции
  const hasMigrations =
    fs.existsSync(path.join(__dirname, "../prisma/migrations")) &&
    fs.readdirSync(path.join(__dirname, "../prisma/migrations")).length > 0;

  try {
    if (hasMigrations) {
      console.log("📜 Применяю миграции...");
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
    } else {
      console.log("⚙️ Миграции не найдены — создаю первую...");
      execSync("npx prisma migrate dev --name init --create-only", {
        stdio: "inherit",
      });
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
    }
    console.log("✅ Таблицы созданы или обновлены.");
  } catch (err) {
    console.error("❌ Ошибка при применении миграций:", err.message);
  }

  // --- Если база новая, выполняем seed
  const prisma = new PrismaClient();
  try {
    if (isNewDatabase) {
      console.log("🌱 Новая база — запускаю seed...");
      await seed();
      console.log("✅ Seed выполнен (новая база).");
    } else {
      // Если база существовала, проверим наличие админа
      const admin = await prisma.users.findUnique({
        where: { username: "admin" },
      });

      if (!admin) {
        console.log("👤 Админ не найден — запускаю seed...");
        await seed();
      } else {
        console.log("✅ Админ уже существует — seed пропущен.");
      }
    }
  } catch (err) {
    console.error("❌ Ошибка при выполнении seed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}
