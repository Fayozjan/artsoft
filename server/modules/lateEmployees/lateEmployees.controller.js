import * as lateEmployeesService from "./lateEmployees.service.js";

export async function getLateEmployees(req, res) {
  try {
    const userId = req.user.id;
    const { filters } = req.query;

    if (!filters.date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const data = await lateEmployeesService.getLateEmployeesService({
      userId,
      filters,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error("Ошибка:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
}

// export async function getLateEmployeesByUsers(req, res) {
//   try {
//     const { date, employeeIds } = req.body;

//     if (!date) return res.status(400).json({ error: "Date is required" });
//     if (!employeeIds?.length)
//       return res.status(400).json({ error: "User IDs array is required" });

//     // Вычисляем начало и конец месяца
//     const startOfMonth = new Date(date);
//     startOfMonth.setDate(1);
//     startOfMonth.setHours(0, 0, 0, 0);

//     const endOfMonth = new Date(startOfMonth);
//     endOfMonth.setMonth(endOfMonth.getMonth() + 1);
//     endOfMonth.setDate(0);
//     endOfMonth.setHours(23, 59, 59, 999);

//     const holidays = await getHolidays(date);

//     const facePasses = await getEmployeeFacePassesByMonthRange(
//       startOfMonth,
//       endOfMonth,
//       employeeIds
//     );

//     const processedEvents = processEvents(facePasses.data);
//     const lateEmployees = findLateEmployees(processedEvents, holidays, date);

//     res.status(200).json({
//       success: true,
//       data: { events: processedEvents, lateEmployees },
//       holidays,
//     });
//   } catch (err) {
//     console.error("Ошибка:", err.message);
//     res.status(500).json({ error: "Ошибка при обработке данных" });
//   }
// }
