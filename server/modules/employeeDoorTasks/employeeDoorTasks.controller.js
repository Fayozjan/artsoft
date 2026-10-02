import { EmployeeDoorTasksService } from "./employeeDoorTasks.service.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const EmployeeDoorTasksController = {
  async create(req, res) {
    try {
      const { employee_id, door_id, action } = req.body;

      if (!employee_id || !door_id || !action) {
        return res.status(400).json({
          message: "employee_id, door_id и action обязательны",
        });
      }

      const task = await EmployeeDoorTasksService.addTask(
        Number(employee_id),
        Number(door_id),
        action,
      );

      await createAuditLog({
        userId: req.user?.id, action: "create", entity: "employee_door_tasks",
        recordId: task.id, newData: task,
      });

      return res.status(201).json(task);
    } catch (err) {
      console.error("Ошибка при создании задачи:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  },

  async getPending(req, res) {
    try {
      const tasks = await EmployeeDoorTasksService.getPendingTasks();
      return res.json(tasks);
    } catch (err) {
      console.error("Ошибка при получении pending задач:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;

      const updated = await EmployeeDoorTasksService.updateTask(
        Number(id),
        data,
      );

      await createAuditLog({
        userId: req.user?.id, action: "update", entity: "employee_door_tasks",
        recordId: Number(id), newData: updated,
      });

      return res.json(updated);
    } catch (err) {
      console.error("Ошибка при обновлении задачи:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  },

  async deleteMany(req, res) {
    try {
      const filter = req.body;

      const result = await EmployeeDoorTasksService.deleteTasks(filter);

      await createAuditLog({
        userId: req.user?.id, action: "delete", entity: "employee_door_tasks",
        oldData: { filter, count: result.count },
      });

      return res.json({
        message: "Задачи удалены",
        count: result.count,
      });
    } catch (err) {
      console.error("Ошибка при удалении задач:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  },
};
