import * as workScheduleModel from "./workSchedules.model.js";
import * as workScheduleService from "./workSchedules.service.js";

export const addWorkSchedule = async (req, res) => {
  try {
    const schedule = await workScheduleService.addWorkSchedule(req.body);
    res.status(201).json({ success: true, data: schedule });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Ошибка при добавлении графика",
    });
  }
};

export const getWorkSchedules = async (req, res) => {
  try {
    const { page, pageSize, filters } = req.query;

    const result = await workScheduleService.getWorkSchedules({
      page,
      pageSize,
      filters,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении графиков:", err);
    res.status(500).json({
      success: false,
      error: "Ошибка при получении графиков",
    });
  }
};

export const getActiveWorkSchedules = async (req, res) => {
  try {
    const result = await workScheduleModel.getActiveWorkSchedules();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Ошибка при получении активных графиков:", err);
    res.status(500).json({
      success: false,
      error: "Ошибка при получении активных графиков",
    });
  }
};

export const getWorkSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await workScheduleService.getWorkSchedule(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: "График не найден",
      });
    }

    res.json({ success: true, data: schedule });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Ошибка при получении графика",
    });
  }
};

export const editWorkSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await workScheduleService.updateWorkSchedule(id, req.body);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Ошибка при обновлении графика",
    });
  }
};

export const removeWorkSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await workScheduleModel.deleteWorkSchedule(id);
    res.json({ success: true, data: schedule });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Ошибка при удалении графика" });
  }
};
