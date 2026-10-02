import { AssetAssignmentsService } from "./assetAssignments.service.js";

export const AssetAssignmentsController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await AssetAssignmentsService.getAssignments({
        userId: req.user.id,
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении списка имущества:", err);
      res.status(500).json({ error: "Ошибка при получении данных об имуществе" });
    }
  },

  getByEmployee: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await AssetAssignmentsService.getGroupedByEmployee({
        userId: req.user.id,
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении имущества по сотрудникам:", err);
      res.status(500).json({ error: "Ошибка при получении данных об имуществе" });
    }
  },

  getStats: async (req, res) => {
    try {
      const data = await AssetAssignmentsService.getStats(req.user.id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении статистики имущества:", err);
      res.status(500).json({ error: "Ошибка при получении статистики" });
    }
  },

  getSuggestions: async (req, res) => {
    try {
      const data = await AssetAssignmentsService.getSuggestions();
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении подсказок:", err);
      res.status(500).json({ error: "Ошибка при получении подсказок" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await AssetAssignmentsService.getAssignmentById(req.params.id);
      if (!data) return res.status(404).json({ error: "Запись не найдена" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении имущества:", err);
      res.status(500).json({ error: "Ошибка при получении данных об имуществе" });
    }
  },

  create: async (req, res) => {
    const userId = req.user.id;
    try {
      const data = await AssetAssignmentsService.createAssignments(req.body, userId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      if (err.code === "P2003")
        return res.status(400).json({ error: "Сотрудник не найден" });
      console.error("Ошибка при выдаче имущества:", err);
      res.status(500).json({ error: err.message || "Ошибка при выдаче имущества" });
    }
  },

  importExcel: async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Файл не загружен" });

      const result = await AssetAssignmentsService.importFromExcel(
        req.file.buffer,
        req.user.id,
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при импорте имущества:", err);
      res.status(500).json({ error: err.message || "Ошибка при импорте файла" });
    }
  },

  update: async (req, res) => {
    const userId = req.user.id;
    try {
      const data = await AssetAssignmentsService.updateAssignment(
        req.params.id,
        req.body,
        userId,
      );
      if (!data) return res.status(404).json({ error: "Запись не найдена" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (err.code === "ASSIGNED_AFTER_RETURN")
        return res.status(400).json({ error: err.message });
      if (err.code === "P2025")
        return res.status(404).json({ error: "Запись не найдена" });
      console.error("Ошибка при обновлении имущества:", err);
      res.status(500).json({ error: "Ошибка при обновлении данных об имуществе" });
    }
  },

  returnAsset: async (req, res) => {
    const userId = req.user.id;
    try {
      const data = await AssetAssignmentsService.returnAssignment(
        req.params.id,
        req.body,
        userId,
      );
      if (!data) return res.status(404).json({ error: "Запись не найдена" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (err.code === "ASSIGNED_AFTER_RETURN")
        return res.status(400).json({ error: err.message });
      if (err.code === "P2025")
        return res.status(404).json({ error: "Запись не найдена" });
      console.error("Ошибка при возврате имущества:", err);
      res.status(500).json({ error: "Ошибка при возврате имущества" });
    }
  },

  undoReturn: async (req, res) => {
    const userId = req.user.id;
    try {
      const data = await AssetAssignmentsService.undoReturn(req.params.id, userId);
      if (!data) return res.status(404).json({ error: "Запись не найдена" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "Запись не найдена" });
      console.error("Ошибка при отмене возврата:", err);
      res.status(500).json({ error: "Ошибка при отмене возврата" });
    }
  },

  remove: async (req, res) => {
    const userId = req.user.id;
    try {
      const data = await AssetAssignmentsService.deleteAssignment(
        req.params.id,
        userId,
      );
      if (!data) return res.status(404).json({ error: "Запись не найдена" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "Запись не найдена" });
      console.error("Ошибка при удалении имущества:", err);
      res.status(500).json({ error: "Ошибка при удалении имущества" });
    }
  },
};
