import * as telegramBotsModel from "./telegramBots.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export async function getBots(req, res) {
  try {
    const { page, pageSize, filters } = req.query;

    const result = await telegramBotsModel.getBots(page, pageSize, filters);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении списка логинов:", err);
    res.status(500).json({ error: "Ошибка при получении данных" });
  }
}

export async function getBotById(req, res) {
  try {
    const { id } = req.params;
    const bot = await telegramBotsModel.getBotById(id);

    if (!bot) {
      return res.status(404).json({ error: "Бот не найден" });
    }

    res.status(200).json({ success: true, data: bot });
  } catch (err) {
    console.error("Ошибка при получении логина по id:", err);
    res.status(500).json({ error: "Ошибка при получении данных" });
  }
}

export async function addBot(req, res) {
  const userId = req.user?.id;
  try {
    const {
      name,
      chat_id,
      selectedEmployeeIds,
      receive_attendance_report,
      receive_event_alerts,
      receive_late_report,
    } = req.body;
    const bot = await telegramBotsModel.createBot({
      name,
      chat_id,
      selectedEmployeeIds: Array.isArray(selectedEmployeeIds)
        ? selectedEmployeeIds.map((id) => Number(id))
        : [],
      receive_attendance_report: Boolean(receive_attendance_report),
      receive_event_alerts: Boolean(receive_event_alerts),
      receive_late_report: Boolean(receive_late_report),
    });
    await createAuditLog({ userId, action: "create", entity: "telegram_bots", recordId: bot.id, newData: { id: bot.id, name: bot.name, chat_id: bot.chat_id } });
    res.status(201).json({ success: true, result: bot });
  } catch (err) {
    console.error("Ошибка при добавлении телеграм бота:", err);
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Такое имя уже существует!" });
    }
    res.status(500).json({ error: "Ошибка при добавлении" });
  }
}

export async function updateBot(req, res) {
  const userId = req.user?.id;
  try {
    const { id } = req.params;
    const data = req.body;

    const old = await telegramBotsModel.getBotById(id);
    const bot = await telegramBotsModel.updateBot(id, data);
    await createAuditLog({ userId, action: "update", entity: "telegram_bots", recordId: id, oldData: old ? { id: old.id, name: old.name, chat_id: old.chat_id } : null, newData: { id: bot.id, name: bot.name, chat_id: bot.chat_id } });

    res.status(200).json({ success: true, result: bot });
  } catch (err) {
    console.error("Ошибка при обновлении телеграм бота:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Телеграм бот не найден" });
    }
    res.status(500).json({ error: "Ошибка при обновлении" });
  }
}
