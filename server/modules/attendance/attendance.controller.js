import {
  getAttendanceService,
  getAttendanceServiceByEmployeeId,
} from "./attendance.service.js";

export const AttendanceController = {
  async getAttendance(req, res) {
    try {
      const userId = req.user.id;
      const { filters } = req.query;

      const data = await getAttendanceService({
        userId,
        filters,
      });

      res.json({ success: true, ...data });
    } catch (err) {
      console.error("Ошибка в getAttendance:", err);

      res.status(err.status || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },

  async getAttendanceByEmployeeId(req, res) {
    try {
      const userId = req.user.id;
      const { employeeId } = req.params;
      const { filters } = req.query;

      const data = await getAttendanceServiceByEmployeeId({
        userId,
        filters,
        employeeId,
      });

      res.json({ success: true, ...data });
    } catch (err) {
      console.error("Ошибка в getAttendance:", err);

      res.status(err.status || 500).json({
        error: err.message || "Ошибка при обработке данных",
      });
    }
  },
};
