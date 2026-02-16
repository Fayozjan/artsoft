import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { initDatabase } from "./utils/initDatabase.js";

dotenv.config();

const { SERVER_TYPE } = process.env;

await initDatabase(process.env.DATABASE_URL);

import { events_checker } from "./utils/eventsChecker.js";

import branchesRoutes from "./modules/branches/branches.routes.js";
import departmentRoutes from "./modules/departments/departments.routes.js";
import employeesRoutes from "./modules/employees/employees.routes.js";
import employmentOrderRoutes from "./modules/employmentOrders/employmentOrders.routes.js";
import employeeScheduleHistoryRoutes from "./modules/employeeScheduleHistory/employeeScheduleHistory.routes.js";

import authRoutes from "./routes/auth.js";

import logOut from "./routes/logout.js";
import changePass from "./routes/changePass.js";
import cookieParser from "cookie-parser";
import menuAccess from "./routes/menuAccess.js";

import attendance from "./modules/attendance/attendance.routes.js";
import timesheet from "./modules/timesheet/timesheet.routes.js";
import lateEmployeesRouter from "./modules/lateEmployees/lateEmployees.routes.js";
import facePassesRouter from "./modules/facePasses/facePasses.routes.js";
import workScheduleRoutes from "./modules/workSchedules/workSchedules.routes.js";
import timeOff from "./modules/timeOff/timeOff.routes.js";
import holidays from "./modules/holidays/holidays.routes.js";
import positionsRoutes from "./modules/positions/positions.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import telegramBots from "./modules/telegramBots/telegramBots.routes.js";
import doorsRoutes from "./modules/doors/doors.routes.js";
import faceDevicesRoutes from "./modules/faceDevices/faceDevices.routes.js";
import menusRoutes from "./modules/menus/menus.routes.js";
import { startTelegramBot } from "./services/telegram-bot/bot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
export const PORT = 7001;

app.use(express.static(path.join(__dirname, "../client/dist")));

// Middlewares
app.use(
  cors({
    origin: "http://localhost:5000",
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/uploads", express.static(path.resolve("uploads")));
app.use("/api/events", express.static(path.resolve("events")));

// Routes
app.use("/api/branches", branchesRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/employment-orders", employmentOrderRoutes);
app.use("/api/employee-schedule-history", employeeScheduleHistoryRoutes);
app.use("/api/face-passes", facePassesRouter);
app.use("/api/attendance", attendance);
app.use("/api/late-employees", lateEmployeesRouter);
app.use("/api/timesheet", timesheet);
app.use("/api/work-schedules", workScheduleRoutes);
app.use("/api/time-off", timeOff);
app.use("/api/holidays", holidays);
app.use("/api/positions", positionsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/telegram-bots", telegramBots);
app.use("/api/doors", doorsRoutes);
app.use("/api/face-devices", faceDevicesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/logout", logOut);
app.use("/api/change-password", changePass);
app.use("/api/menu-access", menuAccess);
app.use("/api/menus", menusRoutes);

if (SERVER_TYPE === "WINDOWS") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist", "index.html"));
  });
}

// setInterval(() => events_checker(-0.025), 120000); // Каждые 2 минуты запрос на получение данных из терминала за последние 30 мин
// setInterval(() => events_checker(-0.3), 1800000); // Каждые 30 мин делаем запрос на получение данных из терминала за последние 2 часа
// setInterval(() => events_checker(-1), 86400000); // Каждые день делаем запрос на получение данных из терминала за последние день
// setInterval(() => events_checker(-3), 259200000); // Каждые 3 дня делаем запрос на получение данных из терминала за последние 3 дня
//startTelegramBot();
//events_checker(-5);

process.on("uncaughtException", (err) => {
  console.error("Необработанная ошибка:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Отклоненное обещание без catch:", reason);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Сервер работает на ${PORT}`);
});
