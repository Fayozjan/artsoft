import { AttributesService } from "./attributes.service.js";

export const AttributesController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await AttributesService.getAttributes({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении характеристик:", err);
      res.status(500).json({ error: "Ошибка при получении характеристик" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await AttributesService.getActiveAttributes();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных характеристик:", err);
      res.status(500).json({ error: "Ошибка при получении характеристик" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await AttributesService.getAttributeById(req.params.id);
      if (!data) return res.status(404).json({ error: "Характеристика не найдена" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении характеристики:", err);
      res.status(500).json({ error: "Ошибка при получении характеристики" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await AttributesService.addAttribute(req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при добавлении характеристики:", err);
      res.status(500).json({ error: err.message || "Ошибка при добавлении характеристики" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await AttributesService.editAttributeById(req.params.id, req.body, req.user?.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при обновлении характеристики:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Характеристика не найдена" });
      res.status(500).json({ error: err.message || "Ошибка при обновлении характеристики" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await AttributesService.deleteAttributeById(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Характеристика не найдена" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении характеристики:", err);
      if (err.code === "P2003")
        return res.status(409).json({ error: "Характеристика используется товарами или категориями" });
      res.status(500).json({ error: "Ошибка при удалении характеристики" });
    }
  },

  getValues: async (req, res) => {
    try {
      const data = await AttributesService.getAttributeValues(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении значений характеристики:", err);
      res.status(500).json({ error: "Ошибка при получении значений характеристики" });
    }
  },

  createValue: async (req, res) => {
    try {
      const result = await AttributesService.addAttributeValue(req.params.id, req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при добавлении значения характеристики:", err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Такое значение уже существует" });
      res.status(500).json({ error: err.message || "Ошибка при добавлении значения характеристики" });
    }
  },

  updateValue: async (req, res) => {
    try {
      const result = await AttributesService.editAttributeValue(req.params.valueId, req.body, req.user?.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при обновлении значения характеристики:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Значение не найдено" });
      if (err.code === "P2002")
        return res.status(409).json({ error: "Такое значение уже существует" });
      res.status(500).json({ error: err.message || "Ошибка при обновлении значения характеристики" });
    }
  },

  removeValue: async (req, res) => {
    try {
      const deleted = await AttributesService.deleteAttributeValue(req.params.valueId, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Значение не найдено" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении значения характеристики:", err);
      if (err.code === "P2003")
        return res.status(409).json({ error: "Значение используется товарами" });
      res.status(500).json({ error: "Ошибка при удалении значения характеристики" });
    }
  },
};
