import * as branchesModel from "./branches.model.js";
import { getActiveBranchesService, BranchService } from "./branches.service.js";

export const getBranches = async (req, res) => {
  const userId = req.user.id;
  try {
    const { page, pageSize, filters } = req.query;

    const result = await BranchService.getBranches({
      userId,
      page,
      pageSize,
      filters,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении филиалов" });
  }
};

export const getActiveBranchesController = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await getActiveBranchesService({
      userId,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении филиалов" });
  }
};

export const getBranchById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await BranchService.getBranchById(id);

    if (!record) return res.status(404).json({ error: "Филиал не найден" });

    res.json({ success: true, data: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении филиала" });
  }
};

export const createBranch = async (req, res) => {
  const userId = req.user.id;
  try {
    const data = req.body;
    const newRecord = await BranchService.createBranch(data, userId);
    res.status(201).json({ success: true, data: newRecord });
  } catch (err) {
    console.error(err);

    // Проверяем, что ошибка — наш дубликат
    if (err.code === "DUPLICATE_NAME") {
      return res.status(409).json({ error: "Такое имя уже существует!" });
    }

    res.status(500).json({ error: "Ошибка при добавлении филиала" });
  }
};

export const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updated = await BranchService.updateBranch(id, data);

    if (!updated) return res.status(404).json({ error: "Филиал не найден" });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);

    if (err.code === "DUPLICATE_NAME") {
      return res.status(409).json({ error: "Такое имя уже существует!" });
    }

    res.status(500).json({ error: "Ошибка при обновлении филиала" });
  }
};

export const deleteBranchById = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await branchesModel.deleteBranchById(id);

    if (!deleted) return res.status(404).json({ error: "Филиал не найден" });

    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при удалении филиала" });
  }
};

export const checkBranchUsage = async (req, res) => {
  try {
    const { id } = req.params;
    const inUse = await branchesModel.isBranchInUse(id);
    res.json({ inUse });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Ошибка при проверке использования филиала" });
  }
};
