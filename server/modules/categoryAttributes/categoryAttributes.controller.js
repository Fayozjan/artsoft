import { CategoryAttributesService } from "./categoryAttributes.service.js";

export const CategoryAttributesController = {
  getAll: async (req, res) => {
    try {
      if (!req.query.category_id)
        return res.status(400).json({ error: "category_id обязателен" });

      const data = await CategoryAttributesService.getByCategory(req.query.category_id);
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении характеристик категории:", err);
      res.status(500).json({ error: "Ошибка при получении характеристик категории" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await CategoryAttributesService.addCategoryAttribute(req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при привязке характеристики к категории:", err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Характеристика уже привязана к категории" });
      res.status(500).json({ error: err.message || "Ошибка при привязке характеристики к категории" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await CategoryAttributesService.editCategoryAttributeById(req.params.id, req.body, req.user?.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при обновлении привязки характеристики:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Привязка не найдена" });
      res.status(500).json({ error: err.message || "Ошибка при обновлении привязки характеристики" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await CategoryAttributesService.deleteCategoryAttributeById(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Привязка не найдена" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении привязки характеристики:", err);
      res.status(500).json({ error: "Ошибка при удалении привязки характеристики" });
    }
  },
};
