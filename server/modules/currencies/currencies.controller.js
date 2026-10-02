import { CurrenciesService } from "./currencies.service.js";

export const CurrenciesController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string" ? JSON.parse(req.query.filters) : req.query.filters || {};

      const result = await CurrenciesService.getCurrencies({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении валют:", err);
      res.status(500).json({ error: "Ошибка при получении валют" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await CurrenciesService.getActiveCurrencies();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных валют:", err);
      res.status(500).json({ error: "Ошибка при получении валют" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await CurrenciesService.getCurrencyById(req.params.id);
      if (!data) return res.status(404).json({ error: "Валюта не найдена" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении валюты:", err);
      res.status(500).json({ error: "Ошибка при получении валюты" });
    }
  },

  getRate: async (req, res) => {
    try {
      const data = await CurrenciesService.getRecommendedRate(req.params.id, req.query.date);
      res.json({ success: true, data });
    } catch (err) {
      if (err.code === "CBU_RATE_UNAVAILABLE")
        return res.status(502).json({ error: "Курс ЦБ недоступен, введите вручную" });
      console.error("Ошибка при получении курса ЦБ:", err);
      res.status(500).json({ error: "Ошибка при получении курса" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await CurrenciesService.addCurrency(req.body, req.user?.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при добавлении валюты:", err);
      if (err.code === "P2002") return res.status(409).json({ error: "Валюта с таким кодом уже существует" });
      res.status(500).json({ error: err.message || "Ошибка при добавлении валюты" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await CurrenciesService.editCurrencyById(req.params.id, req.body, req.user?.id);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при обновлении валюты:", err);
      if (err.code === "P2025") return res.status(404).json({ error: "Валюта не найдена" });
      if (err.code === "P2002") return res.status(409).json({ error: "Валюта с таким кодом уже существует" });
      res.status(500).json({ error: err.message || "Ошибка при обновлении валюты" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await CurrenciesService.deleteCurrencyById(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Валюта не найдена" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении валюты:", err);
      if (err.code === "P2003") return res.status(409).json({ error: "Валюта используется в документах" });
      res.status(500).json({ error: "Ошибка при удалении валюты" });
    }
  },
};
