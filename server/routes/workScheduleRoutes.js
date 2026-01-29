import express from "express";
import {
  createWorkSchedule,
  getAllSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from "../controllers/workScheduleController.js";

const router = express.Router();

// Добавление нового графика работы
router.post("/add", createWorkSchedule);

// Получение всех графиков работы
router.get("/", getAllSchedules);

// Получение одного графика по ID
router.get("/:id", getScheduleById);

// Обновление графика по ID
router.put("/:id", updateSchedule);

// Удаление графика по ID
router.delete("/:id", deleteSchedule);

export default router;
