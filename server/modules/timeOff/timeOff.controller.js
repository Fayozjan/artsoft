import * as timeOffService from "./timeOff.service.js";

export const getTimeOffs = async (req, res) => {
  const userId = req.user.id;

  try {
    const { page, pageSize, filters } = req.query;

    const result = await timeOffService.getTimeOffs({
      userId,
      page,
      pageSize,
      filters,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении time off:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getTimeOffsAll = async (req, res) => {
  try {
    const result = await timeOffService.getTimeOffsAllService({
      userId: req.user.id,
      filters: {
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        branch_id: req.query.branch_id,
        department_id: req.query.department_id,
        employee_id: req.query.employee_id,
      },
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Ошибка при получении всех time off:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getTimeOffById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await timeOffService.getTimeOffByIdService(id);

    if (!record) return res.status(404).json({ error: "Time off не найден" });

    res.json({ success: true, data: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при получении time off" });
  }
};

export const createTimeOff = async (req, res) => {
  console.log("req.user?.id", req.user?.id);
  try {
    const result = await timeOffService.createTimeOff(req.body, req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("createTimeOff error:", err);
    res.status(400).json({ error: err.message });
  }
};

export const updateTimeOff = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updated = await timeOffService.updateTimeOffService(id, data);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);

    if (err.code === "P2025") {
      return res
        .status(404)
        .json({ error: "Time off не найден для обновления" });
    }

    res.status(500).json({ error: "Ошибка при обновлении time off" });
  }
};

export const deleteTimeOff = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await timeOffService.deleteTimeOffService(id);

    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);

    if (err.message === "Time off не найден для удаления") {
      return res.status(404).json({ error: err.message });
    }

    res.status(500).json({ error: "Ошибка при удалении time off" });
  }
};
