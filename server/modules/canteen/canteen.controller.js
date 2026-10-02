import { CanteenService } from "./canteen.service.js";

const parseFilters = (req) =>
  typeof req.query.filters === "string"
    ? JSON.parse(req.query.filters)
    : req.query.filters || {};

const fail = (res, err, message) => {
  console.error(message + ":", err);
  const status = err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? message : err.message });
};

export const CanteenController = {
  getAllowances: async (req, res) => {
    try {
      const result = await CanteenService.getAllowances({
        userId: req.user.id,
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters: parseFilters(req),
      });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при получении норм столовой");
    }
  },

  getAllowanceStats: async (req, res) => {
    try {
      const data = await CanteenService.getAllowanceStats({
        userId: req.user.id,
      });
      res.json({ success: true, data });
    } catch (err) {
      fail(res, err, "Ошибка при получении статистики столовой");
    }
  },

  getAllowanceById: async (req, res) => {
    try {
      const data = await CanteenService.getAllowanceById(req.params.id);
      if (!data) return res.status(404).json({ error: "Норма не найдена" });
      res.json({ success: true, data });
    } catch (err) {
      fail(res, err, "Ошибка при получении нормы");
    }
  },

  assignAllowances: async (req, res) => {
    try {
      const data = await CanteenService.assignAllowances(req.body, req.user.id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      fail(res, err, "Ошибка при назначении нормы");
    }
  },

  updateAllowance: async (req, res) => {
    try {
      const data = await CanteenService.updateAllowance(
        req.params.id,
        req.body,
        req.user.id,
      );
      res.json({ success: true, data });
    } catch (err) {
      fail(res, err, "Ошибка при обновлении нормы");
    }
  },

  deleteAllowance: async (req, res) => {
    try {
      await CanteenService.deleteAllowance(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (err) {
      fail(res, err, "Ошибка при удалении нормы");
    }
  },

  getDisplayState: async (req, res) => {
    try {
      const data = await CanteenService.getDisplayState({
        userId: req.user.id,
        deviceId: req.query.device_id,
        limit: req.query.limit,
      });
      res.json({ success: true, data });
    } catch (err) {
      fail(res, err, "Ошибка при получении состояния экрана");
    }
  },

  getMeals: async (req, res) => {
    try {
      const result = await CanteenService.getMeals({
        userId: req.user.id,
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters: parseFilters(req),
      });
      res.json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при получении журнала столовой");
    }
  },

  deleteMeal: async (req, res) => {
    try {
      const data = await CanteenService.deleteMeal(req.params.id, req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      fail(res, err, "Ошибка при удалении прохода столовой");
    }
  },

  bulkDeleteMeals: async (req, res) => {
    try {
      const result = await CanteenService.bulkDeleteMeals(
        req.body?.ids,
        req.user.id,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при массовом удалении проходов столовой");
    }
  },

  getReport: async (req, res) => {
    try {
      const result = await CanteenService.getReport({
        userId: req.user.id,
        filters: parseFilters(req),
      });
      res.json({ success: true, ...result });
    } catch (err) {
      fail(res, err, "Ошибка при формировании отчёта столовой");
    }
  },

  getDevices: async (req, res) => {
    try {
      const data = await CanteenService.getDevices();
      res.json({ success: true, data });
    } catch (err) {
      fail(res, err, "Ошибка при получении терминалов столовой");
    }
  },
};
