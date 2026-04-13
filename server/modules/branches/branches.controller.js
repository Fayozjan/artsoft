import { BranchService } from "./branches.service.js";

export const BranchController = {
  list: async (req, res) => {
    const userId = req.user.id;
    try {
      const { page, pageSize, filters } = req.query;

      const result = await BranchService.list({
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
  },

  listActive: async (req, res) => {
    const userId = req.user.id;

    try {
      const result = await BranchService.listActive({ userId });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении филиалов" });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const record = await BranchService.getById(id);

      if (!record) return res.status(404).json({ error: "Филиал не найден" });

      res.json({ success: true, data: record });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении филиала" });
    }
  },

  create: async (req, res) => {
    const userId = req.user.id;
    try {
      const data = req.body;
      const newRecord = await BranchService.create(data, userId);
      res.status(201).json({ success: true, data: newRecord });
    } catch (err) {
      console.error(err);

      // Проверяем, что ошибка — наш дубликат
      if (err.code === "DUPLICATE_NAME") {
        return res.status(409).json({ error: "Такое имя уже существует!" });
      }

      res.status(500).json({ error: "Ошибка при добавлении филиала" });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const updated = await BranchService.update(id, data);

      if (!updated) return res.status(404).json({ error: "Филиал не найден" });

      res.json({ success: true, data: updated });
    } catch (err) {
      console.error(err);

      if (err.code === "DUPLICATE_NAME") {
        return res.status(409).json({ error: "Такое имя уже существует!" });
      }

      res.status(500).json({ error: "Ошибка при обновлении филиала" });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await BranchService.remove(id);

      if (!deleted) return res.status(404).json({ error: "Филиал не найден" });

      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при удалении филиала" });
    }
  },

  isInUse: async (req, res) => {
    try {
      const { id } = req.params;
      const inUse = await BranchService.isInUse(id);
      res.json({ inUse });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Ошибка при проверке использования филиала" });
    }
  },
};
