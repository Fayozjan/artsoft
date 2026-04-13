import { deleteHoliday } from "./holidays.model.js";

import * as holidaysService from "./holidays.service.js";

// Список
export async function getHolidays(req, res) {
  try {
    const { year, search } = req.query;

    const result = await holidaysService.getHolidaysService({
      year,
      search,
    });

    res.json({
      success: true,
      data: result.data,
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message,
    });
  }
}

// Получение по ID
export async function getHoliday(req, res) {
  try {
    const holiday = await holidaysService.getHolidayById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ error: "Праздник не найден" });
    }
    res.json({ success: true, data: holiday });
  } catch (e) {
    console.error("Ошибка при получении праздника:", e);
    res.status(500).json({ error: "Ошибка при получении данных" });
  }
}

// Добавление
export async function addHoliday(req, res) {
  try {
    const { name, date_from, date_to } = req.body;

    const data = await holidaysService.createHolidayService({
      name,
      date_from,
      date_to,
      added_by: req.user.id,
    });

    res.status(201).json({
      success: true,
      data,
    });
  } catch (e) {
    console.error("Ошибка при добавлении праздника:", e.message);

    res.status(400).json({
      success: false,
      message: e.message,
    });
  }
}

// Изменение
export async function updateHoliday(req, res) {
  try {
    const holiday = await holidaysService.updateHolidayById(
      req.params.id,
      req.body,
    );
    res.json({ success: true, data: holiday });
  } catch (e) {
    console.error("Ошибка при обновлении праздника:", e);
    res.status(500).json({ error: "Ошибка при обновлении" });
  }
}

// Удаление
export async function removeHoliday(req, res) {
  try {
    const holiday = await deleteHoliday(req.params.id);
    res.json({ success: true, data: holiday });
  } catch (e) {
    console.error("Ошибка при удалении праздника:", e);
    res.status(500).json({ error: "Ошибка при удалении" });
  }
}
