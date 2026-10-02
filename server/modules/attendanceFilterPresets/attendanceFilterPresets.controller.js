import { AttendanceFilterPresetService } from "./attendanceFilterPresets.service.js";

export const AttendanceFilterPresetController = {
  async getAll(req, res) {
    try {
      const data = await AttendanceFilterPresetService.getAll();
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в getAll attendanceFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async create(req, res) {
    try {
      const { name, filter } = req.body;
      const data = await AttendanceFilterPresetService.create({
        name,
        filter,
        userId: req.user.id,
      });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в create attendanceFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id);
      const { name, filter } = req.body;
      const data = await AttendanceFilterPresetService.update({
        id,
        name,
        filter,
        userId: req.user.id,
      });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в update attendanceFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async remove(req, res) {
    try {
      const id = Number(req.params.id);
      await AttendanceFilterPresetService.delete({ id, userId: req.user.id });
      res.json({ success: true });
    } catch (err) {
      console.error("Ошибка в remove attendanceFilterPresets:", err);
      res.status(err.statusCode || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },
};
