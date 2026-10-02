import { UnitsService } from "./units.service.js";

export const UnitsController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await UnitsService.getUnits({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении единиц измерения:", err);
      res.status(500).json({ error: "Ошибка при получении единиц измерения" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await UnitsService.getActiveUnits();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных единиц измерения:", err);
      res.status(500).json({ error: "Ошибка при получении единиц измерения" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await UnitsService.getUnitById(req.params.id);
      if (!data) return res.status(404).json({ error: "Единица измерения не найдена" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении единицы измерения:", err);
      res.status(500).json({ error: "Ошибка при получении единицы измерения" });
    }
  },

  create: async (req, res) => {
    try {
      const result = await UnitsService.addUnit(req.body, req.user?.id);
      res.status(201).json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при добавлении единицы измерения:", err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Такое имя уже существует!" });
      res.status(500).json({ error: "Ошибка при добавлении единицы измерения" });
    }
  },

  update: async (req, res) => {
    try {
      const result = await UnitsService.editUnitById(req.params.id, req.body, req.user?.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при обновлении единицы измерения:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Единица измерения не найдена" });
      if (err.code === "P2002")
        return res.status(409).json({ error: "Такое имя уже существует!" });
      res.status(500).json({ error: "Ошибка при обновлении единицы измерения" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await UnitsService.deleteUnitById(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Единица измерения не найдена" });
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении единицы измерения:", err);
      if (err.code === "P2003")
        return res.status(409).json({ error: "Единица измерения используется в товарах" });
      res.status(500).json({ error: "Ошибка при удалении единицы измерения" });
    }
  },
};
