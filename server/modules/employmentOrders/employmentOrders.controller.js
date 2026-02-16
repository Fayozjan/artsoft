import { EmploymentOrdersService } from "./employmentOrders.service.js";

export const EmploymentOrdersController = {
  create: async (req, res) => {
    const data = await EmploymentOrdersService.create(req.body);
    res.status(201).json({ success: true, data });
  },

  getAll: async (req, res) => {
    try {
      const result = await EmploymentOrdersService.getAll({
        userId: req.user.id,
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters: req.query.filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении приказов" });
    }
  },

  getById: async (req, res) => {
    const data = await EmploymentOrdersService.getById(req.params.id);
    if (!data) return res.status(404).json({ error: "Приказ не найден" });

    res.json({ success: true, data });
  },

  getByEmployeeId: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "employeeId обязателен" });
      }

      const result = await EmploymentOrdersService.getByEmployeeId({
        userId: req.user.id,
        employeeId: id,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Ошибка при поиске приказов по сотруднику" });
    }
  },

  update: async (req, res) => {
    const data = await EmploymentOrdersService.update(req.params.id, req.body);
    res.json({ success: true, data });
  },

  delete: async (req, res) => {
    try {
      const result = await EmploymentOrdersService.delete(
        req.user.id,
        req.params.id,
      );

      if (result?.status) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
        });
      }

      return res.json({
        success: true,
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message: err.message || "Ошибка при удалении приказа",
      });
    }
  },
};
