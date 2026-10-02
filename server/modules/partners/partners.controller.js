import { PartnersService } from "./partners.service.js";

export const PartnersController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await PartnersService.getPartners({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении партнёров:", err);
      res.status(500).json({ error: "Ошибка при получении партнёров" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await PartnersService.getActivePartners();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных партнёров:", err);
      res.status(500).json({ error: "Ошибка при получении партнёров" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await PartnersService.getPartnerById(req.params.id);
      if (!data) return res.status(404).json({ error: "Партнёр не найден" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении партнёра:", err);
      res.status(500).json({ error: "Ошибка при получении партнёра" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await PartnersService.addPartner(req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при добавлении партнёра:", err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Партнёр с таким налоговым номером уже существует!" });
      res.status(500).json({ error: "Ошибка при добавлении партнёра" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await PartnersService.editPartnerById(req.params.id, req.body, req.user?.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при обновлении партнёра:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Партнёр не найден" });
      if (err.code === "P2002")
        return res.status(409).json({ error: "Партнёр с таким налоговым номером уже существует!" });
      res.status(500).json({ error: "Ошибка при обновлении партнёра" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await PartnersService.deletePartnerById(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Партнёр не найден" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении партнёра:", err);
      if (err.code === "P2003")
        return res.status(409).json({ error: "Партнёр используется в документах" });
      res.status(500).json({ error: "Ошибка при удалении партнёра" });
    }
  },
};
