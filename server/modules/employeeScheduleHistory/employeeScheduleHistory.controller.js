import { EmployeeWorkScheduleHistoryService } from "./employeeScheduleHistory.service.js";

export const EmployeeWorkScheduleHistoryController = {
  deleteById: async (req, res) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: "Не указан ID" });
    }

    const result = await EmployeeWorkScheduleHistoryService.deleteById(id);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(404).json(result);
    }
  },
};
