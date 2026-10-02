import * as calendarService from "./productionCalendar.service.js";

// Календарь за год или месяц
export async function getCalendar(req, res) {
  try {
    const { year, month } = req.query;

    const data = await calendarService.getCalendarService({
      year: year || new Date().getFullYear(),
      month,
    });

    res.json({ success: true, data });
  } catch (e) {
    console.error("Ошибка при получении производственного календаря:", e.message);
    res.status(400).json({ success: false, message: e.message });
  }
}

// Норма рабочего времени
export async function getNorm(req, res) {
  try {
    const { year, month } = req.query;

    const data = await calendarService.getNormService({
      year: year || new Date().getFullYear(),
      month,
    });

    res.json({ success: true, data });
  } catch (e) {
    console.error("Ошибка при расчёте нормы рабочего времени:", e.message);
    res.status(400).json({ success: false, message: e.message });
  }
}

// Массовое сохранение дней
export async function saveDays(req, res) {
  try {
    const days = Array.isArray(req.body) ? req.body : req.body?.days;

    const data = await calendarService.saveDaysService({
      days,
      userId: req.user.id,
    });

    res.json({ success: true, data });
  } catch (e) {
    console.error("Ошибка при сохранении производственного календаря:", e.message);
    res.status(400).json({ success: false, message: e.message });
  }
}

// Сброс дней к значениям по умолчанию
export async function resetDays(req, res) {
  try {
    const dates = Array.isArray(req.body) ? req.body : req.body?.dates;

    const data = await calendarService.resetDaysService({
      dates,
      userId: req.user.id,
    });

    res.json({ success: true, data });
  } catch (e) {
    console.error("Ошибка при сбросе дней календаря:", e.message);
    res.status(400).json({ success: false, message: e.message });
  }
}

// Полный сброс года
export async function resetYear(req, res) {
  try {
    const data = await calendarService.resetYearService({
      year: req.params.year,
      userId: req.user.id,
    });

    res.json({ success: true, data });
  } catch (e) {
    console.error("Ошибка при сбросе года календаря:", e.message);
    res.status(400).json({ success: false, message: e.message });
  }
}
