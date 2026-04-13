import { EmployeeDoorTasksService } from "./employeeDoorTasks.service.js";

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
