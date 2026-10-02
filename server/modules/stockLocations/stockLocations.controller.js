import { StockLocationsService, LOCATION_TYPES } from "./stockLocations.service.js";

export const StockLocationsController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await StockLocationsService.getStockLocations({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении локаций:", err);
      res.status(500).json({ error: "Ошибка при получении локаций" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await StockLocationsService.getActiveStockLocations();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных локаций:", err);
      res.status(500).json({ error: "Ошибка при получении локаций" });
    }
  },

  getTypes: async (req, res) => {
    res.json({ success: true, data: LOCATION_TYPES });
  },

  getById: async (req, res) => {
    try {
      const data = await StockLocationsService.getStockLocationById(req.params.id);
      if (!data) return res.status(404).json({ error: "Локация не найдена" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении локации:", err);
      res.status(500).json({ error: "Ошибка при получении локации" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await StockLocationsService.addStockLocation(req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при добавлении локации:", err);
      res.status(500).json({ error: err.message || "Ошибка при добавлении локации" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await StockLocationsService.editStockLocationById(req.params.id, req.body, req.user?.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при обновлении локации:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Локация не найдена" });
      res.status(500).json({ error: err.message || "Ошибка при обновлении локации" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await StockLocationsService.deleteStockLocationById(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Локация не найдена" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении локации:", err);
      if (err.code === "P2003")
        return res.status(409).json({ error: "Локация используется" });
      res.status(500).json({ error: "Ошибка при удалении локации" });
    }
  },
};
