import { StockReportService } from "./stockReport.service.js";

const parseFilters = (req) =>
  typeof req.query.filters === "string" ? JSON.parse(req.query.filters) : req.query.filters || {};

export const StockReportController = {
  getBalances: async (req, res) => {
    try {
      const result = await StockReportService.getBalances({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters: parseFilters(req),
      });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении остатков склада:", err);
      res.status(500).json({ error: "Ошибка при получении остатков склада" });
    }
  },

  getMovements: async (req, res) => {
    try {
      const result = await StockReportService.getMovements({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters: parseFilters(req),
      });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении движений склада:", err);
      res.status(500).json({ error: "Ошибка при получении движений склада" });
    }
  },

  getBalanceLots: async (req, res) => {
    try {
      const data = await StockReportService.getBalanceLots({
        product_id: req.query.product_id,
        location_id: req.query.location_id,
      });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении партий остатка:", err);
      res.status(500).json({ error: "Ошибка при получении партий остатка" });
    }
  },

  getTurnover: async (req, res) => {
    try {
      const result = await StockReportService.getTurnover({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters: parseFilters(req),
      });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении оборотной ведомости:", err);
      res.status(500).json({ error: "Ошибка при получении оборотной ведомости" });
    }
  },

  getTurnoverLots: async (req, res) => {
    try {
      const data = await StockReportService.getTurnoverLots({
        location_id: req.query.location_id,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        product_id: req.query.product_id,
      });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении партий оборота:", err);
      res.status(500).json({ error: "Ошибка при получении партий оборота" });
    }
  },
};
