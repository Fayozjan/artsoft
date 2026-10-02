import { PartnerCategoriesService } from "./partnerCategories.service.js";

export const PartnerCategoriesController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await PartnerCategoriesService.getPartnerCategories({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении категорий партнёров:", err);
      res.status(500).json({ error: "Ошибка при получении категорий партнёров" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await PartnerCategoriesService.getActivePartnerCategories();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных категорий партнёров:", err);
      res.status(500).json({ error: "Ошибка при получении категорий партнёров" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await PartnerCategoriesService.getPartnerCategoryById(req.params.id);
      if (!data) return res.status(404).json({ error: "Категория не найдена" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении категории партнёра:", err);
      res.status(500).json({ error: "Ошибка при получении категории партнёра" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await PartnerCategoriesService.addPartnerCategory(req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при добавлении категории партнёра:", err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Такое имя уже существует!" });
      res.status(500).json({ error: "Ошибка при добавлении категории партнёра" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await PartnerCategoriesService.editPartnerCategoryById(req.params.id, req.body, req.user?.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при обновлении категории партнёра:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Категория не найдена" });
      res.status(500).json({ error: "Ошибка при обновлении категории партнёра" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await PartnerCategoriesService.deletePartnerCategoryById(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Категория не найдена" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении категории партнёра:", err);
      if (err.code === "P2003")
        return res.status(409).json({ error: "Категория используется партнёрами" });
      res.status(500).json({ error: "Ошибка при удалении категории партнёра" });
    }
  },
};
