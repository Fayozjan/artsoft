import path from "path";
import fs from "fs";
import { TasksService } from "./tasks.service.js";

const TASKS_UPLOAD_DIR = path.join(process.cwd(), "uploads", "tasks");

export const TasksController = {
  list: async (req, res) => {
    try {
      const filters = typeof req.query.filters === "string" ? JSON.parse(req.query.filters) : (req.query.filters || {});
      if (req.query.status) filters.status = req.query.status;
      if (req.query.my_tasks) filters.my_tasks = req.query.my_tasks;
      if (req.query.my_employee_id) filters.my_employee_id = req.query.my_employee_id;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.priority) filters.priority = req.query.priority;
      if (req.query.assignee_employee_id) filters.assignee_employee_id = req.query.assignee_employee_id;
      if (req.query.created_by_id) filters.created_by_id = req.query.created_by_id;
      const pageSize = req.query.pageSize || req.query.limit;
      const result = await TasksService.getAll({ page: req.query.page, pageSize, filters, userId: req.user.id });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении задач" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await TasksService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      res.status(500).json({ error: "Ошибка при получении задачи" });
    }
  },

  create: async (req, res) => {
    try {
      const data = req.body;
      if (data.assignee_employee_id) data.assignee_employee_id = Number(data.assignee_employee_id);
      if (data.assignee_department_id) data.assignee_department_id = Number(data.assignee_department_id);
      if (data.assignee_position_id) data.assignee_position_id = Number(data.assignee_position_id);
      if (data.assignee_user_id) data.assignee_user_id = Number(data.assignee_user_id);
      const task = await TasksService.create(data, req.user.id);
      res.status(201).json({ success: true, data: task });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при создании задачи" });
    }
  },

  update: async (req, res) => {
    try {
      const data = req.body;
      if (data.assignee_employee_id !== undefined) data.assignee_employee_id = data.assignee_employee_id ? Number(data.assignee_employee_id) : null;
      if (data.assignee_department_id !== undefined) data.assignee_department_id = data.assignee_department_id ? Number(data.assignee_department_id) : null;
      if (data.assignee_position_id !== undefined) data.assignee_position_id = data.assignee_position_id ? Number(data.assignee_position_id) : null;
      if (data.assignee_user_id !== undefined) data.assignee_user_id = data.assignee_user_id ? Number(data.assignee_user_id) : null;
      const task = await TasksService.update(req.params.id, data, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      if (err.message === "CANNOT_EDIT") return res.status(400).json({ error: "Нельзя редактировать задачу в этом статусе" });
      res.status(500).json({ error: "Ошибка при обновлении задачи" });
    }
  },

  remove: async (req, res) => {
    try {
      await TasksService.remove(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      res.status(500).json({ error: "Ошибка при удалении задачи" });
    }
  },

  publish: async (req, res) => {
    try {
      const task = await TasksService.publish(req.params.id, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      if (err.message === "INVALID_STATUS") return res.status(400).json({ error: "Задача не в статусе черновика" });
      if (err.message === "FORBIDDEN") return res.status(403).json({ error: "Только создатель может опубликовать задачу" });
      res.status(500).json({ error: "Ошибка при публикации задачи" });
    }
  },

  unpublish: async (req, res) => {
    try {
      const task = await TasksService.unpublish(req.params.id, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      if (err.message === "INVALID_STATUS") return res.status(400).json({ error: "Задача не в статусе 'Назначена'" });
      if (err.message === "FORBIDDEN") return res.status(403).json({ error: "Только создатель может отозвать задачу" });
      res.status(500).json({ error: "Ошибка при отзыве задачи" });
    }
  },

  accept: async (req, res) => {
    try {
      const task = await TasksService.accept(req.params.id, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      if (err.message === "INVALID_STATUS") return res.status(400).json({ error: "Задача не назначена" });
      res.status(500).json({ error: "Ошибка при принятии задачи" });
    }
  },

  unaccept: async (req, res) => {
    try {
      const task = await TasksService.unaccept(req.params.id, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      if (err.message === "INVALID_STATUS") return res.status(400).json({ error: "Задача не в работе" });
      res.status(500).json({ error: "Ошибка при отмене принятия" });
    }
  },

  uncomplete: async (req, res) => {
    try {
      const task = await TasksService.uncomplete(req.params.id, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      if (err.message === "INVALID_STATUS") return res.status(400).json({ error: "Задача не выполнена" });
      res.status(500).json({ error: "Ошибка при отмене завершения" });
    }
  },

  complete: async (req, res) => {
    try {
      const task = await TasksService.complete(req.params.id, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      if (err.message === "INVALID_STATUS") return res.status(400).json({ error: "Задача не в работе" });
      res.status(500).json({ error: "Ошибка при завершении задачи" });
    }
  },

  uncancel: async (req, res) => {
    try {
      const task = await TasksService.uncancel(req.params.id, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      if (err.message === "INVALID_STATUS") return res.status(400).json({ error: "Задача не отменена" });
      res.status(500).json({ error: "Ошибка при восстановлении задачи" });
    }
  },

  cancel: async (req, res) => {
    try {
      const task = await TasksService.cancel(req.params.id, req.user.id);
      res.json({ success: true, data: task });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Задача не найдена" });
      if (err.message === "INVALID_STATUS") return res.status(400).json({ error: "Нельзя отменить подтверждённую задачу" });
      res.status(500).json({ error: "Ошибка при отмене задачи" });
    }
  },

  addComment: async (req, res) => {
    try {
      const comment = await TasksService.addComment(req.params.id, req.user.id, req.body.text);
      res.status(201).json({ success: true, data: comment });
    } catch (err) {
      res.status(500).json({ error: "Ошибка при добавлении комментария" });
    }
  },

  removeComment: async (req, res) => {
    try {
      await TasksService.removeComment(req.params.id, req.params.commentId, req.user.id);
      res.json({ success: true });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Комментарий не найден" });
      res.status(500).json({ error: "Ошибка при удалении комментария" });
    }
  },

  uploadFile: async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
      const file = await TasksService.addFile(req.params.id, req.user.id, req.file);
      res.status(201).json({ success: true, data: file });
    } catch (err) {
      res.status(500).json({ error: "Ошибка при загрузке файла" });
    }
  },

  removeFile: async (req, res) => {
    try {
      await TasksService.removeFile(req.params.id, req.params.fileId, req.user.id);
      res.json({ success: true });
    } catch (err) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Файл не найден" });
      res.status(500).json({ error: "Ошибка при удалении файла" });
    }
  },

  downloadFile: async (req, res) => {
    try {
      const raw = req.params[0] || "";
      if (!raw) return res.status(400).json({ error: "Не указан файл" });

      // Старые записи могли сохранить полный путь с обратными слэшами (Windows)
      // и префиксом "uploads/tasks/" — приводим к единому виду.
      let rel = raw.replace(/\\/g, "/").replace(/^\/+/, "");
      rel = rel.replace(/^uploads\/tasks\//, "");

      const safeName = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = path.join(TASKS_UPLOAD_DIR, safeName);

      if (filePath !== TASKS_UPLOAD_DIR && !filePath.startsWith(TASKS_UPLOAD_DIR + path.sep)) {
        return res.status(403).json({ error: "Доступ запрещён" });
      }

      await fs.promises.access(filePath, fs.constants.R_OK).catch(() => {
        const err = new Error("Файл не найден");
        err.status = 404;
        throw err;
      });

      res.sendFile(filePath);
    } catch (err) {
      res.status(err.status ?? 400).json({ error: err.message || "Ошибка при получении файла" });
    }
  },
};
