import { OperationsService } from "./operations.service.js";

const VALIDATION_CODES = [
  "NO_ITEMS",
  "OPERATION_DATE_REQUIRED",
  "EMPLOYEE_REQUIRED",
  "OPERATION_TYPE_REQUIRED",
  "NOT_DRAFT",
  "NOT_ACCEPTED",
  "OPERATION_FORBIDDEN",
];

export const OperationsController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await OperationsService.getAll({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении операций:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await OperationsService.getById(req.params.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении операции:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  create: async (req, res) => {
    try {
      const data = await OperationsService.create(req.body, req.user.id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при создании операции:", err);
      res.status(500).json({ error: "Ошибка при создании документа" });
    }
  },

  update: async (req, res) => {
    try {
      const data = await OperationsService.update(req.params.id, req.body, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при обновлении операции:", err);
      res.status(500).json({ error: "Ошибка при обновлении документа" });
    }
  },

  accept: async (req, res) => {
    try {
      const data = await OperationsService.accept(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при принятии операции:", err);
      res.status(500).json({ error: "Ошибка при принятии документа" });
    }
  },

  revert: async (req, res) => {
    try {
      const data = await OperationsService.revert(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при возврате операции в черновик:", err);
      res.status(500).json({ error: "Ошибка при возврате документа в черновик" });
    }
  },

  remove: async (req, res) => {
    try {
      const data = await OperationsService.remove(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при удалении операции:", err);
      res.status(500).json({ error: "Ошибка при удалении документа" });
    }
  },
};
