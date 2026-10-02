import { EmployeeTeamsService } from "./employeeTeams.service.js";

const VALIDATION_CODES = [
  "OPERATION_TYPE_REQUIRED",
  "OPERATION_TYPE_NOT_FOUND",
  "NAME_REQUIRED",
  "NAME_TAKEN",
  "MEMBERS_REQUIRED",
  "INVALID_MEMBERS",
  "EMPLOYEE_NOT_FOUND",
  "MEMBER_NOT_ALLOWED",
];

export const EmployeeTeamsController = {
  getByOperationType: async (req, res) => {
    try {
      const operationTypeId = req.query.operation_type_id;
      if (!operationTypeId) return res.status(400).json({ error: "Не указан тип операции" });

      const data = await EmployeeTeamsService.getByOperationType(operationTypeId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при получении команд:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  create: async (req, res) => {
    try {
      const data = await EmployeeTeamsService.create(req.body, req.user.id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при создании команды:", err);
      res.status(500).json({ error: "Ошибка при создании команды" });
    }
  },

  update: async (req, res) => {
    try {
      const data = await EmployeeTeamsService.update(req.params.id, req.body);
      if (!data) return res.status(404).json({ error: "Команда не найдена" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при обновлении команды:", err);
      res.status(500).json({ error: "Ошибка при обновлении команды" });
    }
  },

  remove: async (req, res) => {
    try {
      const data = await EmployeeTeamsService.delete(req.params.id);
      if (!data) return res.status(404).json({ error: "Команда не найдена" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при удалении команды:", err);
      res.status(500).json({ error: "Ошибка при удалении команды" });
    }
  },
};
