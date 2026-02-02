import { EmployeeWorkScheduleHistoryModel } from "./employeeScheduleHistory.model.js";

export const EmployeeWorkScheduleHistoryService = {
  deleteById: async (id) => {
    try {
      const record = await EmployeeWorkScheduleHistoryModel.findById(id);

      if (!record) {
        return { success: false, message: "Запись не найдена" };
      }

      await EmployeeWorkScheduleHistoryModel.deleteById(id);

      return { success: true, message: "Запись успешно удалена" };
    } catch (error) {
      console.error("Ошибка при удалении записи истории:", error);
      return { success: false, message: "Ошибка сервера" };
    }
  },
};
