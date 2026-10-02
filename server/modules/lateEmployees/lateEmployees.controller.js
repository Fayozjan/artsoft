import * as lateEmployeesService from "./lateEmployees.service.js";

export async function getLateEmployees(req, res) {
  try {
    const userId = req.user.id;
    const { filters } = req.query;

    if (filters.mode === "period") {
      if (!filters.date_from || !filters.date_to) {
        return res
          .status(400)
          .json({ error: "date_from and date_to are required" });
      }
      if (filters.date_to < filters.date_from) {
        return res.status(400).json({ error: "date_to earlier than date_from" });
      }
    } else if (!filters.date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const { page, pageSize } = req.query;
    const startedAt = Date.now();
    const data = await lateEmployeesService.getLateEmployeesService({
      userId,
      filters,
      page,
      pageSize,
    });

    // Месячный режим тянет все проходы за месяц — логируем время и объём,
    // иначе тормоза/обрывы выглядят как «нет данных» без следов в логах
    const durationMs = Date.now() - startedAt;
    const dateLog =
      filters.mode === "period"
        ? `${filters.date_from}..${filters.date_to}`
        : filters.date;
    if (filters.mode === "month" || filters.mode === "period" || durationMs > 5000) {
      console.info(
        `[lateEmployees] mode=${filters.mode} date=${dateLog} ` +
          `userId=${userId} ${durationMs}ms items=${data?.pagination?.totalItems ?? 0}`,
      );
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("[lateEmployees] failed", {
      userId: req.user?.id,
      mode: req.query?.filters?.mode,
      date: req.query?.filters?.date,
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message || "Ошибка при обработке данных" });
  }
}
