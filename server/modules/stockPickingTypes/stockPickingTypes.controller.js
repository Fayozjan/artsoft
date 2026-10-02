import { StockPickingTypesService, PICKING_TYPE_CODES } from "./stockPickingTypes.service.js";

const VALIDATION_CODES = ["NAME_REQUIRED", "INVALID_CODE", "PREFIX_REQUIRED"];

export const StockPickingTypesController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string" ? JSON.parse(req.query.filters) : req.query.filters || {};

      const result = await StockPickingTypesService.getAll({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении типов документов:", err);
      res.status(500).json({ error: "Ошибка при получении типов документов" });
    }
  },

  getActive: async (req, res) => {
    try {
      const data = await StockPickingTypesService.getActive();
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении активных типов документов:", err);
      res.status(500).json({ error: "Ошибка при получении типов документов" });
    }
  },

  getCodes: async (req, res) => {
    res.json({ success: true, data: PICKING_TYPE_CODES });
  },

  getById: async (req, res) => {
    try {
      const data = await StockPickingTypesService.getById(req.params.id);
      if (!data) return res.status(404).json({ error: "Тип документа не найден" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении типа документа:", err);
      res.status(500).json({ error: "Ошибка при получении типа документа" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await StockPickingTypesService.create(req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при добавлении типа документа:", err);
      res.status(500).json({ error: err.message || "Ошибка при добавлении типа документа" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await StockPickingTypesService.update(req.params.id, req.body, req.user?.id);
      if (!result) return res.status(404).json({ error: "Тип документа не найден" });
      res.json({ success: true, result });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при обновлении типа документа:", err);
      res.status(500).json({ error: err.message || "Ошибка при обновлении типа документа" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await StockPickingTypesService.remove(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Тип документа не найден" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      if (err.code === "P2003")
        return res.status(409).json({ error: "Тип документа используется — есть документы этого типа" });
      console.error("Ошибка при удалении типа документа:", err);
      res.status(500).json({ error: "Ошибка при удалении типа документа" });
    }
  },
};
