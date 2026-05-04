import * as lateEmployeesService from "./lateEmployees.service.js";

export async function getLateEmployees(req, res) {
  try {
    const userId = req.user.id;
    const { filters } = req.query;

    if (!filters.date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const { page, pageSize } = req.query;
    const data = await lateEmployeesService.getLateEmployeesService({
      userId,
      filters,
      page,
      pageSize,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error("Ошибка:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
}
