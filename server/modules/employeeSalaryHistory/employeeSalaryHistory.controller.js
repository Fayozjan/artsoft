import { EmployeeSalaryHistoryService } from "./employeeSalaryHistory.service.js";

export const EmployeeSalaryHistoryController = {
  getEmployeesWithSalary: async (req, res) => {
    const result = await EmployeeSalaryHistoryService.getEmployeesWithSalary(
      req.query,
    );
    return result.success
      ? res.json(result)
      : res.status(500).json(result);
  },

  getByEmployee: async (req, res) => {
    const { employee_id } = req.query;
    const result = await EmployeeSalaryHistoryService.getByEmployee(employee_id);
    return result.success
      ? res.json(result)
      : res.status(400).json(result);
  },

  create: async (req, res) => {
    const userId = req.user?.id;
    const result = await EmployeeSalaryHistoryService.create(userId, req.body);
    return result.success
      ? res.status(201).json(result)
      : res.status(400).json(result);
  },

  update: async (req, res) => {
    const { id } = req.params;
    const result = await EmployeeSalaryHistoryService.update(id, req.body);
    if (result.success) return res.json(result);
    const status = result.message === "Запись не найдена" ? 404 : 400;
    return res.status(status).json(result);
  },

  deleteById: async (req, res) => {
    const { id } = req.params;
    const result = await EmployeeSalaryHistoryService.deleteById(id);
    if (result.success) return res.json(result);
    const status = result.message === "Запись не найдена" ? 404 : 400;
    return res.status(status).json(result);
  },
};
