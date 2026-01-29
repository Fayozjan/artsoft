import {
  addWorkSchedule,
  getAllWorkSchedules,
  getWorkScheduleById,
  updateWorkSchedule,
  deleteWorkSchedule,
} from "../models/workScheduleModel.js";

// Контроллер для добавления рабочего графика
export const createWorkSchedule = async (req, res) => {
  try {
    const newSchedule = await addWorkSchedule(req.body);
    res.status(201).json({ success: true, schedule: newSchedule });
  } catch (error) {
    console.error("Ошибка при добавлении графика:", error);
    res.status(500).json({ success: false, error: "Ошибка сервера" });
  }
};

// Контроллер для получения всех графиков работы
export const getAllSchedules = async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page, 10) : null;
    const pageSize = req.query.pageSize
      ? parseInt(req.query.pageSize, 10)
      : null;

    let schedules, pagination;

    if (pageSize) {
      // Если размер страницы передан — передаем пагинацию
      ({ schedules, pagination } = await getAllWorkSchedules(
        page || 1,
        pageSize
      ));
    } else {
      // Если размер страницы не передан — просто возвращаем все
      ({ schedules } = await getAllWorkSchedules());
    }

    res
      .status(200)
      .json({ success: true, schedules, ...(pagination && { pagination }) });
  } catch (error) {
    console.error("Ошибка при получении графиков:", error);
    res.status(500).json({ success: false, error: "Ошибка сервера" });
  }
};

// Контроллер для получения одного графика по ID
export const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await getWorkScheduleById(id);

    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, error: "График не найден" });
    }

    res.status(200).json({ success: true, schedule });
  } catch (error) {
    console.error("Ошибка при получении графика:", error);
    res.status(500).json({ success: false, error: "Ошибка сервера" });
  }
};

// Контроллер для обновления графика по ID
export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedSchedule = await updateWorkSchedule(id, req.body);

    if (!updatedSchedule) {
      return res
        .status(404)
        .json({ success: false, error: "График не найден" });
    }

    res.status(200).json({ success: true, schedule: updatedSchedule });
  } catch (error) {
    console.error("Ошибка при обновлении графика:", error);
    res.status(500).json({ success: false, error: "Ошибка сервера" });
  }
};

// Контроллер для удаления графика по ID
export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSchedule = await deleteWorkSchedule(id);

    if (!deletedSchedule) {
      return res
        .status(404)
        .json({ success: false, error: "График не найден" });
    }

    res.status(200).json({ success: true, schedule: deletedSchedule });
  } catch (error) {
    console.error("Ошибка при удалении графика:", error);
    res.status(500).json({ success: false, error: "Ошибка сервера" });
  }
};
