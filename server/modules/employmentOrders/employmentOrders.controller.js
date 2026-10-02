import { EmploymentOrdersService } from "./employmentOrders.service.js";

export const EmploymentOrdersController = {
  create: async (req, res) => {
    try {
      const data = await EmploymentOrdersService.create(req.body, req.user.id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      if (err.code === "EMPLOYEE_HAS_ASSETS") {
        return res
          .status(409)
          .json({ success: false, message: err.message, error: err.message });
      }
      console.error("Ошибка при создании приказа:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Ошибка при создании приказа",
      });
    }
  },

  bulkCreate: async (req, res) => {
    try {
      const result = await EmploymentOrdersService.bulkCreate(
        req.body,
        req.user.id,
      );
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при массовом создании приказов:", err);
      res.status(400).json({
        success: false,
        message: err.message || "Ошибка при массовом создании приказов",
        error: err.message,
      });
    }
  },

  getAll: async (req, res) => {
    try {
      const { page, pageSize, search, type, branch_id, department_id, position_id, date_from, date_to, sort_by, sort_order } = req.query;
      const result = await EmploymentOrdersService.getAll({
        userId: req.user.id,
        page,
        pageSize,
        filters: { search, type, branch_id, department_id, position_id, date_from, date_to, sort_by, sort_order },
      });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении приказов" });
    }
  },

  getStats: async (req, res) => {
    try {
      const stats = await EmploymentOrdersService.getStats(req.user.id);
      res.json({ success: true, stats });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении статистики приказов" });
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
    try {
      const data = await EmploymentOrdersService.update(
        req.params.id,
        req.body,
        req.user.id,
      );
      res.json({ success: true, data });
    } catch (err) {
      if (err.code === "EMPLOYEE_HAS_ASSETS") {
        return res
          .status(409)
          .json({ success: false, message: err.message, error: err.message });
      }
      console.error("Ошибка при обновлении приказа:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Ошибка при обновлении приказа",
      });
    }
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
