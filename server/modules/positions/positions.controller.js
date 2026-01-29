import * as positionsModels from "./positions.model.js";

export const getPositions = async (req, res) => {
  try {
    const { page, pageSize, filters } = req.query;

    const result = await positionsModels.getPositions({
      page,
      pageSize,
      filters,
    });

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении должностей:", err);
    res.status(500).json({ error: "Ошибка при получении должностей" });
  }
};

export const getActivePositions = async (req, res) => {
  try {
    const result = await positionsModels.getActivePositions();

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении должностей:", err);
    res.status(500).json({ error: "Ошибка при получении должностей" });
  }
};

export const getPositionById = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await positionsModels.getPositionById(id);

    if (!data) {
      return res.status(404).json({ error: "Должность не найдена" });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("Ошибка при получении должности:", err);
    res.status(500).json({ error: "Ошибка при получении должности" });
  }
};

export const addPosition = async (req, res) => {
  try {
    const { name, status } = req.body;
    const newPosition = await positionsModels.addPosition({ name, status });

    res.status(201).json({ success: true, result: newPosition });
  } catch (err) {
    console.error(err);
    if (err.code === "P2002") {
      // Prisma ошибка уникального поля
      return res.status(409).json({ error: "Такое имя уже существует!" });
    }
    res.status(500).json({ error: "Ошибка при добавлении должности" });
  }
};

export const editPositionById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    let statusBool;

    if (typeof status === "string") {
      statusBool = status.toLowerCase() === "true";
    } else {
      statusBool = Boolean(status);
    }

    const updated = await positionsModels.editPositionById(id, {
      name,
      status: statusBool,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Ошибка при обновлении должности:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Должность не найдена" });
    }
    res.status(500).json({ error: "Ошибка при обновлении должности" });
  }
};
