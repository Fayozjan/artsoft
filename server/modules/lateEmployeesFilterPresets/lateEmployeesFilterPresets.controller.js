import { LateEmployeesFilterPresetService } from "./lateEmployeesFilterPresets.service.js";

export const LateEmployeesFilterPresetController = {
  async getAll(req, res) {
    try {
      const data = await LateEmployeesFilterPresetService.getAll();
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в getAll lateEmployeesFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async create(req, res) {
    try {
      const { name, filter } = req.body;
      const data = await LateEmployeesFilterPresetService.create({
        name,
        filter,
        userId: req.user.id,
      });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в create lateEmployeesFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id);
      const { name, filter } = req.body;
      const data = await LateEmployeesFilterPresetService.update({
        id,
        name,
        filter,
        userId: req.user.id,
      });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в update lateEmployeesFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async remove(req, res) {
    try {
      const id = Number(req.params.id);
      await LateEmployeesFilterPresetService.delete({ id, userId: req.user.id });
      res.json({ success: true });
    } catch (err) {
      console.error("Ошибка в remove lateEmployeesFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },
};
