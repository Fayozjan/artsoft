import { generateAttendanceReport } from "../../utils/attendanceUtils.js";
import {
  getCalendarOverrides,
  getEmployeeFacePassesByMonthRange,
} from "./timesheet.model.js";
import {
  buildCalendarContext,
  serializeOverrides,
} from "../../utils/productionCalendar.utils.js";

import { FacePassesService } from "../facePasses/facePasses.service.js";
import { EmployeeService } from "../employees/employees.service.js";
import {
  buildSessionsIndex,
  buildZeroEventStubs,
  buildScheduleHistoryMap,
} from "./timesheet.helpers.js";
import { TimeOffService } from "../timeOff/timeOff.service.js";
import { timesheetCache } from "../../utils/timesheetCache.js";

function getCurrentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getTimesheet(req, res) {
  const userId = req.user.id;

  try {
    const { page, pageSize, filters } = req.query;

    if (!filters.month)
      return res.status(400).json({ error: "Месяц не выбран" });

    const [year, monthValue] = filters.month.split("-").map(Number);

    // Даты для выборки событий — с запасом в день на обе стороны, т.к. ночная
    // смена на границе месяца может зайти/выйти по факту в соседнем календарном дне
    // (см. Шаг 2 в generateAttendanceReport, который переносит exit на день entry)
    const start_date = new Date(year, monthValue - 1, 0, 0, 0, 0);
    const end_date = new Date(year, monthValue, 1, 23, 59, 59);

    // Строгие границы месяца — для SQL-фильтра "есть события" (must match то, что
    // реально попадёт в finalSessions после фильтрации по yearMonth внутри отчёта)
    const monthStart = new Date(year, monthValue - 1, 1, 0, 0, 0);
    const monthEnd = new Date(year, monthValue, 0, 23, 59, 59);

    filters.start_date = start_date;
    filters.end_date = end_date;

    const isPastMonth = filters.month < getCurrentMonthStr();
    const cacheParams = { page, pageSize, filters };

    if (isPastMonth) {
      const cached = timesheetCache.get(req.tenant.schema, filters.month, cacheParams);
      if (cached) return res.status(200).json(cached);
    }

    // --- производственный календарь ---
    const calendarOverrides = await getCalendarOverrides(filters.month);

    // Фильтр "есть события" теперь считается в SQL (exists по face_passes/time_off) —
    // страница сотрудников уже приходит настоящей, без ручной пагинации 999999-в-памяти
    const employees = await EmployeeService.getAll({
      userId,
      filters: { ...filters, hasEventsFrom: monthStart, hasEventsTo: monthEnd },
      page,
      pageSize,
    });

    const employeeIds = employees.data.map((e) => e.id);
    const employeesById = new Map(employees.data.map((e) => [e.id, e]));

    // Одна выборка истории графика на всех сотрудников страницы — переиспользуется
    // и для employees с событиями, и для заглушек без единого badge-события
    const historyByEmployee = await buildScheduleHistoryMap(employeeIds);

    // --- события: только сырые поля (без deep-include employee на каждую строку) ---
    const events = await FacePassesService.getAllLean({
      employeeIds,
      startDate: start_date,
      endDate: end_date,
      employeesById,
      historyByEmployee,
    });

    const timeOffs = await TimeOffService.getAllLean({
      employeeIds,
      start_date,
      end_date,
    });

    // Сотрудники без единого badge-события целиком выпадают из events (группировка
    // по face_passes) — без этого их company-paid отлучки/отгулы никогда не попадут
    // в generateAttendanceReport, т.к. функция обходит только attendanceData
    const zeroEventStubs = buildZeroEventStubs(events, employees.data, historyByEmployee);
    const attendanceData = [...events, ...zeroEventStubs];

    // weekDays — дни месяца (числа), покрытые выбранной неделей при viewMode=week —
    // сужает итоговую статистику (опоздания/сверхурочные/отгулы/отработано) до недели,
    // сама сетка событий sessions остаётся за весь месяц (нужна для переключения вида)
    const weekDays = filters.weekDays
      ? (Array.isArray(filters.weekDays) ? filters.weekDays : [filters.weekDays]).map(
          Number,
        )
      : null;

    // производственный календарь передаётся в отчёт, чтобы нерабочие дни
    // вычитались из плановых дней/часов (totalScheduledDays / totalScheduledMinutes),
    // а сокращённые уменьшали норму
    let processedEvents = generateAttendanceReport(
      attendanceData,
      timeOffs,
      filters.month,
      weekDays,
      buildCalendarContext(calendarOverrides),
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
          workScheduleName: emp.workSchedule?.name,
          status: emp.status,
          sessions: {},
        });
      } else {
        processedMap.get(key).status = emp.status;
      }
    }

    const sessionsIndex = buildSessionsIndex(processedEvents);

    const responseBody = {
      success: true,
      data: processedEvents,
      sessionsIndex,
      calendar: serializeOverrides(calendarOverrides),
      pagination: employees.pagination,
    };

    if (isPastMonth) {
      timesheetCache.set(req.tenant.schema, filters.month, cacheParams, responseBody);
    }

    res.status(200).json(responseBody);
  } catch (err) {
    console.error("Ошибка в getTimesheet:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
}

// Пересчёт табеля закрытого месяца — сбрасывает кэш, если в старом месяце
// задним числом дописались события/отгулы (например, устройство не успело
// синхронизироваться вовремя). Для текущего месяца не нужен — он не кэшируется.
export async function recalculateTimesheet(req, res) {
  try {
    const { month } = req.body;

    if (!month) return res.status(400).json({ error: "Месяц не выбран" });

    if (month >= getCurrentMonthStr()) {
      return res
        .status(400)
        .json({ error: "Пересчёт доступен только для прошлых месяцев" });
    }

    timesheetCache.invalidateMonth(req.tenant.schema, month);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Ошибка в recalculateTimesheet:", err.message);
    res.status(500).json({ error: "Ошибка при пересчёте табеля" });
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

    const calendarOverrides = await getCalendarOverrides(date);

    const events = await getEmployeeFacePassesByMonthRange({
      startOfMonth,
      endOfMonth,
      employeeIds,
    });

    const processedEvents = processEvents(events.data);

    res.status(200).json({
      success: true,
      data: processedEvents,
      calendar: serializeOverrides(calendarOverrides),
    });
  } catch (err) {
    console.error("Ошибка в getTimesheetByEmployees:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
}
