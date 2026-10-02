import { WorkStickersService } from "./workStickers.service.js";

const VALIDATION_CODES = [
  "BATCH_ITEM_REQUIRED",
  "OPERATION_TYPE_REQUIRED",
  "PLANNED_QUANTITY_REQUIRED",
  "BATCH_ITEM_NOT_FOUND",
  "OPERATION_TYPE_NOT_FOUND",
  "EXCEEDS_ITEM_QUANTITY",
  "STICKER_NOT_FOUND",
  "ALREADY_DONE",
  "EMPLOYEE_REQUIRED",
  "EMPLOYEE_NOT_ALLOWED",
  "ACTUAL_QUANTITY_REQUIRED",
  "INVALID_DEFECT_QUANTITY",
  "INVALID_REWORK_QUANTITY",
  "INVALID_INCOMPLETE_QUANTITY",
  "INCOMPLETE_NOT_ALLOWED",
  "QUANTITY_REMAINDER",
  "WORKERS_INVALID",
  "STICKER_IS_SHARE",
  "QUANTITY_EXCEEDS_MAX",
  "NOT_DELETABLE",
  "STICKER_NOT_DONE",
  "NO_NEXT_OPERATION",
  "ALREADY_ADVANCED",
  "SPLITS_REQUIRED",
  "INVALID_SPLIT_QUANTITY",
  "INVALID_SPLIT_KIND",
  "SPLIT_SUM_MISMATCH",
  "COUNT_TOO_LARGE",
  "OPERATION_FORBIDDEN",
  "MERGE_MIN_TWO",
  "MERGE_OPERATION_MISMATCH",
  "MERGE_NOT_ALLOWED",
  "MERGE_BATCH_MISMATCH",
  "MERGE_SIZE_MISMATCH",
  "MERGE_EMPTY",
  "NO_REWORK_OPERATION",
  "NO_INCOMPLETE_OPERATION",
  "AWAITING_MERGE",
];

export const WorkStickersController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await WorkStickersService.getAll({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
        userId: req.user.id,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении стикеров:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  getById: async (req, res) => {
    try {
      const data = await WorkStickersService.getById(req.params.id);
      if (!data) return res.status(404).json({ error: "Стикер не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении стикера:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  getByCode: async (req, res) => {
    try {
      const data = await WorkStickersService.getByCode(req.params.code);
      if (!data) return res.status(404).json({ error: "Стикер не найден" });
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при поиске стикера:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  getItemRemaining: async (req, res) => {
    try {
      const data = await WorkStickersService.getItemRemaining(
        req.params.itemId,
        req.query.operation_type_id,
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при получении остатка позиции:", err);
      res.status(500).json({ error: "Ошибка при получении данных" });
    }
  },

  create: async (req, res) => {
    try {
      const data = await WorkStickersService.create(req.body, req.user.id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при печати стикеров:", err);
      res.status(500).json({ error: "Ошибка при создании стикеров" });
    }
  },

  scan: async (req, res) => {
    try {
      const data = await WorkStickersService.scan(req.params.code, req.body, req.user.id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при приёме работы:", err);
      res.status(500).json({ error: "Ошибка при сохранении" });
    }
  },

  advance: async (req, res) => {
    try {
      const data = await WorkStickersService.advance(req.params.code, req.body, req.user.id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при распределении стикера по маршруту:", err);
      res.status(500).json({ error: "Ошибка при сохранении" });
    }
  },

  merge: async (req, res) => {
    try {
      const data = await WorkStickersService.merge(req.body, req.user.id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при объединении стикеров:", err);
      res.status(500).json({ error: "Ошибка при сохранении" });
    }
  },

  setAwaitingMerge: async (req, res) => {
    try {
      const data = await WorkStickersService.setAwaitingMerge(req.params.code, req.body.value, req.user.id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при отметке объединения:", err);
      res.status(500).json({ error: "Ошибка при сохранении" });
    }
  },

  revert: async (req, res) => {
    try {
      const data = await WorkStickersService.revert(req.params.code, req.user.id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при возврате стикера:", err);
      res.status(500).json({ error: "Ошибка при сохранении" });
    }
  },

  remove: async (req, res) => {
    try {
      const data = await WorkStickersService.remove(req.params.id, req.user.id);
      if (!data) return res.status(404).json({ error: "Стикер не найден" });
      res.status(200).json({ success: true });
    } catch (err) {
      if (VALIDATION_CODES.includes(err.code))
        return res.status(400).json({ error: err.message });
      console.error("Ошибка при удалении стикера:", err);
      res.status(500).json({ error: "Ошибка при удалении" });
    }
  },
};
