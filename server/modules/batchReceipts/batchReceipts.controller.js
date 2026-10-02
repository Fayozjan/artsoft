import { BatchReceiptsService } from "./batchReceipts.service.js";

const VALIDATION_CODES = [
  "NO_ITEMS",
  "BATCH_NUMBER_REQUIRED",
  "RECEIPT_DATE_REQUIRED",
  "DUPLICATE_BATCH_NUMBER",
  "NOT_DRAFT",
  "NOT_ACCEPTED",
  "HAS_STARTED_ITEMS",
];

const DUPLICATE_BATCH_MESSAGE = "Партия с таким номером уже существует";

export const BatchReceiptsController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await BatchReceiptsService.getAll({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении прихода партий:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  getStats: async (req, res) => {
    try {
      const data = await BatchReceiptsService.getStats();
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении статистики прихода партий:", err);
      res.status(500).json({ error: "Ошибка при получении статистики" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await BatchReceiptsService.getById(req.params.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении прихода партии:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  create: async (req, res) => {
    try {
      const data = await BatchReceiptsService.create(req.body, req.user.id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      if (err.code === "DUPLICATE_BATCH_NUMBER")
        return res.status(409).json({ error: err.message, code: err.code, existing: err.existing });
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      if (err.code === "P2002")
        return res.status(400).json({ error: DUPLICATE_BATCH_MESSAGE });
      console.error("Ошибка при создании прихода партии:", err);
      res.status(500).json({ error: "Ошибка при создании документа" });
    }
  },

  update: async (req, res) => {
    try {
      const data = await BatchReceiptsService.update(req.params.id, req.body, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      if (err.code === "P2002")
        return res.status(400).json({ error: DUPLICATE_BATCH_MESSAGE });
      console.error("Ошибка при обновлении прихода партии:", err);
      res.status(500).json({ error: "Ошибка при обновлении документа" });
    }
  },

  appendItems: async (req, res) => {
    try {
      const data = await BatchReceiptsService.appendItems(req.params.id, req.body, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при добавлении позиций в партию:", err);
      res.status(500).json({ error: "Ошибка при добавлении позиций" });
    }
  },

  removeItem: async (req, res) => {
    try {
      const data = await BatchReceiptsService.removeItem(req.params.id, req.params.itemId, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (err.code === "ITEM_NOT_FOUND") return res.status(404).json({ error: err.message });
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при удалении позиции партии:", err);
      res.status(500).json({ error: "Ошибка при удалении позиции" });
    }
  },

  accept: async (req, res) => {
    try {
      const data = await BatchReceiptsService.accept(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при принятии прихода партии:", err);
      res.status(500).json({ error: "Ошибка при принятии документа" });
    }
  },

  revert: async (req, res) => {
    try {
      const data = await BatchReceiptsService.revert(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при возврате прихода партии в черновик:", err);
      res.status(500).json({ error: "Ошибка при возврате документа в черновик" });
    }
  },

  remove: async (req, res) => {
    try {
      const data = await BatchReceiptsService.remove(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Документ не найден" });
      res.status(200).json({ success: true });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при удалении прихода партии:", err);
      res.status(500).json({ error: "Ошибка при удалении документа" });
    }
  },
};
