import * as employeesModel from "./employees.model.js";
import {
  addEmployeeService,
  getEmployeesService,
  getActiveEmployeesService,
  EmployeeService,
} from "./employees.service.js";

export const getEmployees = async (req, res) => {
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

    const result = await getEmployeesService({
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
};

export const getActiveEmployees = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  try {
    const data = await getActiveEmployeesService({ userId });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("Error in getActiveEmployees:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addEmployee = async (req, res) => {
  try {
    const result = await addEmployeeService(req);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("Ошибка при добавлении сотрудника:", err);
    res.status(500).json({
      error: err.message || "Ошибка при добавлении сотрудника",
    });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await employeesModel.deleteEmployee(id);
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ error: err.message || "Ошибка при удалении сотрудника" });
  }
};

export const EmployeeController = {
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

  getByid: async (req, res) => {
    try {
      const { id } = req.params;
      const employee = await EmployeeService.getByid(id);

      if (!employee)
        return res.status(404).json({ error: "Сотрудник не найден" });

      res.json({ success: true, data: employee });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении сотрудника" });
    }
  },
};
