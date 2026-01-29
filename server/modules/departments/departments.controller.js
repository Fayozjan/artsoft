import * as departmentsModel from "./departments.model.js";
import { getActiveDepartmentsService } from "./departments.service.js";

export const getDepartments = async (req, res) => {
  const userId = req.user.id;
  const { page, pageSize, filters } = req.query;

  try {
    const result = await departmentsModel.getDepartments({
      userId,
      page,
      pageSize,
      filters,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err.message || "Ошибка при получении отделов" });
  }
};

export const getActiveDepartments = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await getActiveDepartmentsService({
      userId,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err.message || "Ошибка при получении отделов" });
  }
};

export const getDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await departmentsModel.getDepartmentById(id);
    if (!record) return res.status(404).json({ error: "Отдел не найден" });

    res.json({ success: true, data: record });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err.message || "Ошибка при получении отдела" });
  }
};

export const addDepartment = async (req, res) => {
  try {
    const data = req.body;
    const newRecord = await departmentsModel.createDepartment(data);
    res.status(201).json({ success: true, data: newRecord });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err.message || "Ошибка при добавлении отдела" });
  }
};

export const editDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updated = await departmentsModel.editDepartment(id, data);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: err.message || "Ошибка при обновлении отдела" });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await departmentsModel.deleteDepartment(id);
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ error: err.message || "Ошибка при удалении отдела" });
  }
};
