import { DoorsService } from "./doors.service.js";

export const DoorsController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await DoorsService.getDoors({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении списка дверей:", err);
      res.status(500).json({ error: "Ошибка при получении данных о дверях" });
    }
  },

  getActive: async (req, res) => {
    try {
      const result = await DoorsService.getActiveDoors();
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("Ошибка при получении активных дверей:", err);
      res.status(500).json({ error: "Ошибка при получении дверей" });
    }
  },

  getById: async (req, res) => {
    try {
      const door = await DoorsService.getDoorById(req.params.id);
      if (!door) return res.status(404).json({ error: "Дверь не найдена" });
      res.status(200).json({ success: true, data: door });
    } catch (err) {
      console.error("Ошибка при получении двери по id:", err);
      res.status(500).json({ error: "Ошибка при получении данных о двери" });
    }
  },

  create: async (req, res) => {
    try {
      const door = await DoorsService.createDoor(req.body, req.user?.id);
      res.status(201).json({ success: true, result: door });
    } catch (err) {
      console.error("Ошибка при добавлении двери:", err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Такое имя уже существует!" });
      res.status(500).json({ error: "Ошибка при добавлении двери" });
    }
  },

  update: async (req, res) => {
    const userId = req.user?.id;
    try {
      const door = await DoorsService.updateDoor(req.params.id, req.body, userId);
      res.status(200).json({ success: true, result: door });
    } catch (err) {
      console.error("Ошибка при обновлении двери:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Дверь не найдена" });
      res.status(500).json({ error: "Ошибка при обновлении двери" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await DoorsService.deleteDoor(req.params.id, req.user?.id);
      if (!deleted) return res.status(404).json({ error: "Дверь не найдена" });
      res.status(200).json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении двери:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Дверь не найдена" });
      res.status(500).json({ error: "Ошибка при удалении двери" });
    }
  },

  syncOne: async (req, res) => {
    try {
      const result = await DoorsService.syncDoor(req.params.id, req.tenant?.schema);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при синхронизации двери:", err);
      res.status(500).json({ error: err.message || "Ошибка при синхронизации" });
    }
  },

  syncAll: async (req, res) => {
    try {
      const result = await DoorsService.syncAllDoors(req.tenant?.schema);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Ошибка при синхронизации дверей:", err);
      res.status(500).json({ error: err.message || "Ошибка при синхронизации" });
    }
  },
};
