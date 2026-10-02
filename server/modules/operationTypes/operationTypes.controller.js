import { OperationTypesService } from "./operationTypes.service.js";

const VALIDATION_CODES = [
  "NAME_REQUIRED",
  "NAME_TAKEN",
  "INVALID_COMPLEXITY",
  "TARGET_SELF",
  "TARGET_NOT_FOUND",
  "TARGET_REWORK_MISMATCH",
  "INVALID_EMPLOYEES",
  "EMPLOYEE_NOT_FOUND",
];

export const OperationTypesController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await OperationTypesService.getAll({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении типов операций:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  getActive: async (req, res) => {
    try {
      const data = await OperationTypesService.getActive();
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении типов операций:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await OperationTypesService.getById(req.params.id);
      if (!data) return res.status(404).json({ error: "Тип операции не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении типа операции:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  create: async (req, res) => {
    try {
      const data = await OperationTypesService.create(req.body, req.user.id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при создании типа операции:", err);
      res.status(500).json({ error: "Ошибка при создании типа операции" });
    }
  },

  update: async (req, res) => {
    try {
      const data = await OperationTypesService.update(req.params.id, req.body);
      if (!data) return res.status(404).json({ error: "Тип операции не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при обновлении типа операции:", err);
      res.status(500).json({ error: "Ошибка при обновлении типа операции" });
    }
  },

  remove: async (req, res) => {
    try {
      const data = await OperationTypesService.delete(req.params.id);
      if (!data) return res.status(404).json({ error: "Тип операции не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (err.code === "IN_USE") return res.status(409).json({ error: err.message });
      console.error("Ошибка при удалении типа операции:", err);
      res.status(500).json({ error: "Ошибка при удалении типа операции" });
    }
  },
};
