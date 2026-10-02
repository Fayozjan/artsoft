import { ProductionReportService } from "./productionReport.service.js";

const parseFilters = (req) =>
  typeof req.query.filters === "string"
    ? JSON.parse(req.query.filters)
    : req.query.filters || {};

const fail = (res, err, message) => {
  console.error(message + ":", err);
  const status = err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? message : err.message });
};

export const ProductionReportController = {
  getByBatch: async (req, res) => {
    try {
      const result = await ProductionReportService.getByBatch({
        userId: req.user.id,
        filters: parseFilters(req),
      });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при формировании отчёта по партиям");
    }
  },

  getByEmployee: async (req, res) => {
    try {
      const result = await ProductionReportService.getByEmployee({
        userId: req.user.id,
        filters: parseFilters(req),
      });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при формировании отчёта по сотрудникам");
    }
  },

  getByOperation: async (req, res) => {
    try {
      const result = await ProductionReportService.getByOperation({
        userId: req.user.id,
        filters: parseFilters(req),
      });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при формировании отчёта по операциям");
    }
  },

  getByOrder: async (req, res) => {
    try {
      const result = await ProductionReportService.getByOrder({
        userId: req.user.id,
        filters: parseFilters(req),
      });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при формировании отчёта по заказам");
    }
  },

  getMonitoring: async (req, res) => {
    try {
      const result = await ProductionReportService.getMonitoring({
        userId: req.user.id,
        filters: parseFilters(req),
      });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при формировании мониторинга производства");
    }
  },

  getStickers: async (req, res) => {
    try {
      const result = await ProductionReportService.getStickers({
        userId: req.user.id,
        filters: parseFilters(req),
        page: req.query.page,
        pageSize: req.query.pageSize,
      });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при формировании отчёта по стикерам");
    }
  },

  getStickerItemAttributes: async (req, res) => {
    try {
      const data = await ProductionReportService.getStickerItemAttributes();
      res.status(200).json({ success: true, data });
    } catch (err) {
      fail(res, err, "Ошибка при получении значений фильтра позиций");
    }
  },

  // Изменение цены одного или нескольких принятых стикеров: { ids: [...], rate }
  updateStickerRates: async (req, res) => {
    try {
      const data = await ProductionReportService.updateStickerRates({
        userId: req.user.id,
        ids: req.body?.ids,
        rate: req.body?.rate,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      // Отказ в праве — 400 с текстом, как у остальных проверок доступа производства:
      // 403 клиент трактует как протухший токен и пытается его обновить
      if (err.code === "REPORT_EDIT_FORBIDDEN" || err.code === "OPERATION_FORBIDDEN") {
        return res.status(400).json({ error: err.message });
      }
      fail(res, err, "Ошибка при изменении цены");
    }
  },

  getStickerChronology: async (req, res) => {
    try {
      const data = await ProductionReportService.getStickerChronology({
        userId: req.user.id,
        stickerId: req.params.id,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      fail(res, err, "Ошибка при получении хронологии стикера");
    }
  },
};
