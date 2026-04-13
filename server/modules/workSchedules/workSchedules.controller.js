import { workScheduleService } from "./workSchedules.service.js";

export const workScheduleController = {
  create: async (req, res) => {
    try {
      const result = await workScheduleService.create(req.body);
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Ошибка при добавлении графика",
      });
    }
  },

  getAll: async (req, res) => {
    try {
      const { page, pageSize, filters } = req.query;

      const result = await workScheduleService.getAll({
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
  },

  getActive: async (req, res) => {
    try {
      const result = await workScheduleService.getActive();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных графиков:", err);
      res.status(500).json({
        success: false,
        error: "Ошибка при получении активных графиков",
      });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const schedule = await workScheduleService.getById(id);

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
  },

  updateById: async (req, res) => {
    try {
      const { id } = req.params;

      const updated = await workScheduleService.updateById(id, req.body);

      res.json({ success: true, data: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        error: "Ошибка при обновлении графика",
      });
    }
  },

  deleteById: async (req, res) => {
    try {
      const { id } = req.params;
      const schedule = await workScheduleService.deleteById(id);
      res.json({ success: true, data: schedule });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ success: false, error: "Ошибка при удалении графика" });
    }
  },
};
