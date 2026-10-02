import { DepartmentsService } from "./departments.service.js";

export const DepartmentsController = {
  getDepartments: async (req, res) => {
    try {
      const { page, pageSize, filters } = req.query;
      const result = await DepartmentsService.getDepartments({
        userId: req.user.id,
        page: Number(page),
        pageSize: Number(pageSize),
        filters,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: err.message || "Ошибка при получении отделов" });
    }
  },

  getActiveDepartments: async (req, res) => {
    try {
      const result = await DepartmentsService.getActiveDepartments({
        userId: req.user.id,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: err.message || "Ошибка при получении отделов" });
    }
  },

  getDepartment: async (req, res) => {
    try {
      const record = await DepartmentsService.getDepartmentById(req.params.id);
      if (!record) return res.status(404).json({ error: "Отдел не найден" });
      res.json({ success: true, data: record });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: err.message || "Ошибка при получении отдела" });
    }
  },

  addDepartment: async (req, res) => {
    const userId = req.user.id;
    try {
      const newRecord = await DepartmentsService.createDepartment(req.body, userId);
      res.status(201).json({ success: true, data: newRecord });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: err.message || "Ошибка при добавлении отдела" });
    }
  },

  editDepartment: async (req, res) => {
    const userId = req.user.id;
    try {
      const updated = await DepartmentsService.editDepartment(
        req.params.id,
        req.body,
        userId,
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: err.message || "Ошибка при обновлении отдела" });
    }
  },

  getStaffingOverview: async (req, res) => {
    try {
      const { branch_id, department_id } = req.query;
      const result = await DepartmentsService.getStaffingOverview({
        userId: req.user.id,
        branch_id: branch_id ? Number(branch_id) : null,
        department_id: department_id ? Number(department_id) : null,
      });
      res.json({ success: true, data: result.data || result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "Ошибка при получении штатного расписания" });
    }
  },

  deleteDepartment: async (req, res) => {
    const userId = req.user.id;
    try {
      const deleted = await DepartmentsService.deleteDepartment(req.params.id, userId);
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error(err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при удалении отдела" });
    }
  },

  importExcel: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });
    if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
    try {
      const result = await DepartmentsService.importFromExcel(req.file.buffer, userId);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при импорте отделов:", err);
      res.status(500).json({ error: err.message || "Ошибка при импорте" });
    }
  },
};
