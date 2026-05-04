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

    const filterHasEvents = filters.hasEvents === "yes" || filters.hasEvents === "no";

    // --- праздники ---
    const holidays = await getHolidays(filters.month);

    // Если фильтр по событиям — берём всех без пагинации, потом пагинируем вручную
    const employees = await EmployeeService.getAll({
      userId,
      filters,
      page: filterHasEvents ? 1 : page,
      pageSize: filterHasEvents ? 999999 : pageSize,
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
          status: emp.status,
          sessions: {},
        });
      } else {
        processedMap.get(key).status = emp.status;
      }
    }

    // Фильтр по событиям — после агрегации смен
    if (filters.hasEvents === "yes") {
      processedEvents = processedEvents.filter((emp) =>
        Object.values(emp.sessions || {}).some((s) => s.events?.length > 0),
      );
    } else if (filters.hasEvents === "no") {
      processedEvents = processedEvents.filter(
        (emp) => !Object.values(emp.sessions || {}).some((s) => s.events?.length > 0),
      );
    }

    // Ручная пагинация при фильтре по событиям
    let pagination;
    if (filterHasEvents) {
      const currentPage = Math.max(parseInt(page) || 1, 1);
      const size = Math.max(parseInt(pageSize) || 50, 1);
      const totalItems = processedEvents.length;
      pagination = {
        totalItems,
        currentPage,
        pageSize: size,
        totalPages: Math.ceil(totalItems / size),
      };
      processedEvents = processedEvents.slice((currentPage - 1) * size, currentPage * size);
    } else {
      pagination = { ...employees.pagination };
    }

    const sessionsIndex = buildSessionsIndex(processedEvents);

    res.status(200).json({
      success: true,
      data: processedEvents,
      sessionsIndex,
      holidays,
      pagination,
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
