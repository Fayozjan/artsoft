import { StockPickingsService } from "./stockPickings.service.js";

const VALIDATION_CODES = [
  "TYPE_REQUIRED",
  "LOCATIONS_REQUIRED",
  "SAME_LOCATION",
  "INVALID_DATE",
  "FUTURE_DATE",
  "CURRENCY_REQUIRED",
  "INVALID_RATE",
  "INVALID_PAYMENT_METHOD",
  "NO_ITEMS",
  "TYPE_NOT_FOUND",
  "PARTNER_REQUIRED",
  "NOT_EDITABLE",
  "NOT_DRAFT",
  "NOT_CONFIRMED",
  "NOT_CANCELLABLE",
  "INSUFFICIENT_STOCK",
  "LOT_REQUIRED",
];

export const StockPickingsController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string" ? JSON.parse(req.query.filters) : req.query.filters || {};

      const result = await StockPickingsService.getAll({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении складских документов:", err);
      res.status(500).json({ error: "Ошибка при получении документов" });
    }
  },

  getOrigins: async (req, res) => {
    try {
      const data = await StockPickingsService.getOrigins();
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении списка оснований:", err);
      res.status(500).json({ error: "Ошибка при получении списка оснований" });
    }
  },

  getStockBalance: async (req, res) => {
    try {
      const data = await StockPickingsService.getStockBalance(req.query.location_id);
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении остатков склада:", err);
      res.status(500).json({ error: "Ошибка при получении остатков склада" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await StockPickingsService.getById(req.params.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении складского документа:", err);
      res.status(500).json({ error: "Ошибка при получении документа" });
    }
  },

  create: async (req, res) => {
    try {
      const data = await StockPickingsService.create(req.body, req.user.id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при создании складского документа:", err);
      res.status(500).json({ error: "Ошибка при создании документа" });
    }
  },

  update: async (req, res) => {
    try {
      const data = await StockPickingsService.update(req.params.id, req.body, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при обновлении складского документа:", err);
      res.status(500).json({ error: "Ошибка при обновлении документа" });
    }
  },

  confirm: async (req, res) => {
    try {
      const data = await StockPickingsService.confirm(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при подтверждении документа:", err);
      res.status(500).json({ error: "Ошибка при подтверждении документа" });
    }
  },

  validate: async (req, res) => {
    try {
      const data = await StockPickingsService.validate(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при проведении документа:", err);
      res.status(500).json({ error: "Ошибка при проведении документа" });
    }
  },

  cancel: async (req, res) => {
    try {
      const data = await StockPickingsService.cancel(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при отмене документа:", err);
      res.status(500).json({ error: "Ошибка при отмене документа" });
    }
  },

  remove: async (req, res) => {
    try {
      const data = await StockPickingsService.remove(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.json({ success: true });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code)) return res.status(400).json({ error: err.message });
      console.error("Ошибка при удалении документа:", err);
      res.status(500).json({ error: "Ошибка при удалении документа" });
    }
  },
};
