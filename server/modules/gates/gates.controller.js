import { GatesService } from "./gates.service.js";

export const GatesController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await GatesService.getGates({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении списка гейтов:", err);
      res.status(500).json({ error: "Ошибка при получении данных о гейтах" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await GatesService.getActiveGates();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных гейтов:", err);
      res.status(500).json({ error: "Ошибка при получении гейтов" });
    }
  },

  getById: async (req, res) => {
    try {
      const gate = await GatesService.getGateById(req.params.id);
      if (!gate) return res.status(404).json({ error: "Гейт не найден" });

      res.status(200).json({ success: true, data: gate });
    } catch (err) {
      console.error("Ошибка при получении гейта по id:", err);
      res.status(500).json({ error: "Ошибка при получении данных о гейте" });
    }
  },

  create: async (req, res) => {
    try {
      const gate = await GatesService.createGate(req.body);
      res.status(201).json({ success: true, result: gate });
    } catch (err) {
      console.error("Ошибка при добавлении гейта:", err);
      if (err.code === "P2002") {
        return res.status(409).json({ error: "Такое имя уже существует!" });
      }
      res.status(500).json({ error: "Ошибка при добавлении гейта" });
    }
  },

  update: async (req, res) => {
    try {
      const gate = await GatesService.updateGate(req.params.id, req.body);
      res.status(200).json({ success: true, result: gate });
    } catch (err) {
      console.error("Ошибка при обновлении гейта:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Гейт не найден" });
      }
      res.status(500).json({ error: "Ошибка при обновлении гейта" });
    }
  },
};
