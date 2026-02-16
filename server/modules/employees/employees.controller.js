import { EmployeeService } from "./employees.service.js";

export const EmployeeController = {
  create: async (req, res) => {
    const userId = req.user.id;
    const data = req.body;
    const file = req.file;

    try {
      const result = await EmployeeService.create(userId, data, file);
      res.status(201).json(result);
    } catch (err) {
      console.error("Ошибка при добавлении сотрудника:", err);

      if (err.code === "P2002") {
        return res.status(400).json({
          error: `Сотрудник с таким ПИНФЛ уже существует`,
        });
      }

      res.status(500).json({
        error: err.message || "Ошибка при добавлении сотрудника",
      });
    }
  },

  getAll: async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Не авторизован" });
      }

      const {
        page,
        pageSize,
        branch_id,
        department_id,
        employee_id,
        position_id,
        search,
        status,
      } = req.query;

      const result = await EmployeeService.getAll({
        userId,
        page,
        pageSize,
        filters: {
          branch_id,
          department_id,
          employee_id,
          position_id,
          search,
          status,
        },
      });

      return res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении сотрудников:", err);
      return res.status(500).json({
        error: "Ошибка при получении сотрудников",
        details: err.message,
      });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const employee = await EmployeeService.getById(id);

      if (!employee)
        return res.status(404).json({ error: "Сотрудник не найден" });

      res.json({ success: true, data: employee });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении сотрудника" });
    }
  },

  getActive: async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    try {
      const data = await EmployeeService.getActive({ userId });
      res.json({ success: true, ...data });
    } catch (err) {
      console.error("Error in getActiveEmployees:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  update: async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    try {
      const { id } = req.params;

      const updated = await EmployeeService.update(
        id,
        req.body,
        req.file,
        userId,
      );

      res.json({ success: true, data: updated });
    } catch (err) {
      console.error("Ошибка при обновлении сотрудника:", err);
      res
        .status(500)
        .json({ error: err.message || "Ошибка при обновлении сотрудника" });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await EmployeeService.delete(id);
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error(err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при удалении сотрудника" });
    }
  },
};
