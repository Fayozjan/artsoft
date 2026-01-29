import * as doorsModels from "./doors.model.js";
import * as doorsService from "./doors.service.js";

export const getAll = async (req, res) => {
  try {
    const { page, pageSize, filters } = req.query;

    const result = await doorsModels.getDoors(page, pageSize, filters);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении списка дверей:", err);
    res.status(500).json({ error: "Ошибка при получении данных о дверях" });
  }
};

export const getActive = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await doorsModels.getActiveDoors({
      userId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении дверей" });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const door = await doorsModels.getDoorById(id);

    if (!door) {
      return res.status(404).json({ error: "Дверь не найдена" });
    }

    res.status(200).json({ success: true, data: door });
  } catch (err) {
    console.error("Ошибка при получении двери по id:", err);
    res.status(500).json({ error: "Ошибка при получении данных о двери" });
  }
};

export const create = async (req, res) => {
  try {
    const { name, status = true } = req.body;
    const door = await doorsModels.createDoor({ name, status });
    res.status(201).json({ success: true, result: door });
  } catch (err) {
    console.error("Ошибка при добавлении двери:", err);
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Такое имя уже существует!" });
    }
    res.status(500).json({ error: "Ошибка при добавлении двери" });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;

    const door = await doorsService.updateDoor(id, req.body);

    res.status(200).json({ success: true, result: door });
  } catch (err) {
    console.error("Ошибка при обновлении двери:", err);

    if (err.code === "P2025") {
      return res.status(404).json({ error: "Дверь не найдена" });
    }

    res.status(500).json({ error: "Ошибка при обновлении двери" });
  }
};
