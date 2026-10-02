import { PositionsService } from "./positions.service.js";

export const PositionsController = {
  getPositions: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await PositionsService.getPositions({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении должностей:", err);
      res.status(500).json({ error: "Ошибка при получении должностей" });
    }
  },

  getActivePositions: async (req, res) => {
    try {
      const result = await PositionsService.getActivePositions();
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении активных должностей:", err);
      res
        .status(500)
        .json({ error: "Ошибка при получении активных должностей" });
    }
  },

  getPositionById: async (req, res) => {
    try {
      const data = await PositionsService.getPositionById(req.params.id);
      if (!data) return res.status(404).json({ error: "Должность не найдена" });
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении должности:", err);
      res.status(500).json({ error: "Ошибка при получении должности" });
    }
  },

  addPosition: async (req, res) => {
    const userId = req.user.id;
    try {
      const newPosition = await PositionsService.addPosition(req.body, userId);
      res.status(201).json({ success: true, result: newPosition });
    } catch (err) {
      console.error(err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Такое имя уже существует!" });
      res.status(500).json({ error: "Ошибка при добавлении должности" });
    }
  },

  editPositionById: async (req, res) => {
    const userId = req.user.id;
    try {
      const { status, ...rest } = req.body;
      let statusBool =
        typeof status === "string"
          ? status.toLowerCase() === "true"
          : Boolean(status);
      const updated = await PositionsService.editPositionById(req.params.id, {
        ...rest,
        status: statusBool,
      }, userId);
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error("Ошибка при обновлении должности:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Должность не найдена" });
      res.status(500).json({ error: "Ошибка при обновлении должности" });
    }
  },

  importExcel: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });
    if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
    try {
      const result = await PositionsService.importFromExcel(req.file.buffer, userId);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при импорте должностей:", err);
      res.status(500).json({ error: err.message || "Ошибка при импорте" });
    }
  },
};
