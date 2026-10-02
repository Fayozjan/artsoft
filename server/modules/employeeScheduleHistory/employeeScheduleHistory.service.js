import { EmployeeWorkScheduleHistoryModel } from "./employeeScheduleHistory.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const EmployeeWorkScheduleHistoryService = {
  deleteById: async (id, userId) => {
    try {
      const record = await EmployeeWorkScheduleHistoryModel.findById(id);

      if (!record) {
        return { success: false, message: "Запись не найдена" };
      }

      await EmployeeWorkScheduleHistoryModel.deleteById(id);
      await createAuditLog({ userId, action: "delete", entity: "employee_schedule_history", recordId: id, oldData: { id: record.id, employee_id: record.employee_id } });

      return { success: true, message: "Запись успешно удалена" };
    } catch (error) {
      console.error("Ошибка при удалении записи истории:", error);
      return { success: false, message: "Ошибка сервера" };
    }
  },
};
