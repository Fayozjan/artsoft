import { TimesheetFilterPresetService } from "./timesheetFilterPresets.service.js";

export const TimesheetFilterPresetController = {
  async getAll(req, res) {
    try {
      const data = await TimesheetFilterPresetService.getAll();
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в getAll timesheetFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async create(req, res) {
    try {
      const { name, filter } = req.body;
      const data = await TimesheetFilterPresetService.create({
        name,
        filter,
        userId: req.user.id,
      });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в create timesheetFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id);
      const { name, filter } = req.body;
      const data = await TimesheetFilterPresetService.update({
        id,
        name,
        filter,
        userId: req.user.id,
      });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в update timesheetFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async remove(req, res) {
    try {
      const id = Number(req.params.id);
      await TimesheetFilterPresetService.delete({ id, userId: req.user.id });
      res.json({ success: true });
    } catch (err) {
      console.error("Ошибка в remove timesheetFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },
};
