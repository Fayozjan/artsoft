import { CronTasksService } from "./cronTasks.service.js";

export const CronTasksController = {
  async getAll(req, res) {
    try {
      const data = await CronTasksService.getAll();
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в getAll cronTasks:", err);
      res.status(err.statusCode || 400).json({ error: err.message || "Ошибка при обработке данных" });
    }
  },

  async getOne(req, res) {
    try {
      const id = Number(req.params.id);
      const data = await CronTasksService.getById(id);
      if (!data) {
        return res.status(404).json({ error: "Задача не найдена" });
      }
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в getOne cronTasks:", err);
      res.status(err.statusCode || 400).json({ error: err.message || "Ошибка при обработке данных" });
    }
  },

  async create(req, res) {
    try {
      const data = await CronTasksService.create({ ...req.body, userId: req.user.id });
      res.status(201).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в create cronTasks:", err);
      res.status(err.statusCode || 400).json({ error: err.message || "Ошибка при обработке данных" });
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id);
      const data = await CronTasksService.update({ ...req.body, id, userId: req.user.id });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в update cronTasks:", err);
      res.status(err.statusCode || 400).json({ error: err.message || "Ошибка при обработке данных" });
    }
  },

  async toggle(req, res) {
    try {
      const id = Number(req.params.id);
      const data = await CronTasksService.toggle({ id, userId: req.user.id });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в toggle cronTasks:", err);
      res.status(err.statusCode || 400).json({ error: err.message || "Ошибка при обработке данных" });
    }
  },

  async remove(req, res) {
    try {
      const id = Number(req.params.id);
      await CronTasksService.delete({ id, userId: req.user.id });
      res.json({ success: true });
    } catch (err) {
      console.error("Ошибка в remove cronTasks:", err);
      res.status(err.statusCode || 400).json({ error: err.message || "Ошибка при обработке данных" });
    }
  },

  async runNow(req, res) {
    try {
      const id = Number(req.params.id);
      const data = await CronTasksService.runNow(id);
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка в runNow cronTasks:", err);
      res.status(err.statusCode || 400).json({ error: err.message || "Ошибка при отправке отчёта" });
    }
  },
};
