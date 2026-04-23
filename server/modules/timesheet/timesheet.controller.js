import { generateAttendanceReport } from "../../utils/attendanceUtils.js";
import {
  getHolidays,
  getEmployeeFacePassesByMonthRange,
} from "./timesheet.model.js";

import { FacePassesService } from "../facePasses/facePasses.service.js";
import { EmployeeService } from "../employees/employees.service.js";
import { buildSessionsIndex } from "./timesheet.helpers.js";
import { TimeOffService } from "../timeOff/timeOff.service.js";

export async function getTimesheet(req, res) {
  const userId = req.user.id;

  try {
    const { page, pageSize, filters } = req.query;

    if (!filters.month)
      return res.status(400).json({ error: "Месяц не выбран" });

    const [year, monthValue] = filters.month.split("-").map(Number);

    // Формируем даты начала и конца месяца
    const start_date = new Date(year, monthValue - 1, 0, 0, 0, 0);
    const end_date = new Date(year, monthValue, 1, 23, 59, 59);

    filters.start_date = start_date;
    filters.end_date = end_date;

    // --- праздники ---
    const holidays = await getHolidays(filters.month);

    // Получаем список сотрудников по размеру страницы
    const employees = await EmployeeService.getAll({
      userId,
      filters,
      page,
      pageSize,
    });

    // --- события ---
    const events = await FacePassesService.getAll({
      userId,
      filters: {
        ...filters,
        employeeIds: employees.data.map((e) => e.id),
      },
    });

    const timeOffs = await TimeOffService.getAll({
      userId,
      filters: {
        ...filters,
        employeeIds: employees.data.map((e) => e.id),
      },
    });

    let processedEvents = generateAttendanceReport(
      events,
      timeOffs,
      filters.month,
    );

    const processedMap = new Map(
      processedEvents.map((e) => [String(e.employeeId), e]),
    );

    for (const emp of employees.data) {
      const key = String(emp.id);

      if (!processedMap.has(key)) {
        processedEvents.push({
          employeeId: key,
          employeeFullName: `${[emp.last_name, emp.first_name, emp.middle_name]
            .filter(Boolean)
            .join(" ")} (${key})`,
          employeePhoto: emp.photo || null,
          branchName: emp?.branch?.name,
          departmentName: emp?.department?.name,
          positionName: emp?.position?.name,
          pinfl: emp?.pinfl,
          workScheduleName: emp.work_schedule?.name,
          sessions: {},
        });
      }
    }

    const sessionsIndex = buildSessionsIndex(processedEvents);

    res.status(200).json({
      success: true,
      data: processedEvents,
      sessionsIndex,
      holidays,
      pagination: { ...employees?.pagination },
    });
  } catch (err) {
    console.error("Ошибка в getTimesheet:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
}

export async function getTimesheetByEmployees(req, res) {
  try {
    const { date, employeeIds } = req.body;

    if (!date) return res.status(400).json({ error: "Date is required" });
    if (!employeeIds?.length)
      return res.status(400).json({ error: "Employee IDs array is required" });

    const baseDate = new Date(date);
    const startOfMonth = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const holidays = await getHolidays(date);

    const events = await getEmployeeFacePassesByMonthRange({
      startOfMonth,
      endOfMonth,
      employeeIds,
    });

    const processedEvents = processEvents(events.data);

    res.status(200).json({
      success: true,
      data: processedEvents,
      holidays,
    });
  } catch (err) {
    console.error("Ошибка в getTimesheetByEmployees:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
}
