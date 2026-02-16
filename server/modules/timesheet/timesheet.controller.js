import { eachDayOfInterval, format } from "date-fns";

import { generateAttendanceReport } from "../../utils/attendanceUtils.js";
import {
  getHolidays,
  getEmployeeFacePassesByMonthRange,
} from "./timesheet.model.js";

import * as facePassesService from "../facePasses/facePasses.service.js";
import { EmployeeService } from "../employees/employees.service.js";
import { buildSessionsIndex } from "./timesheet.helpers.js";

function filterSessionsByMonth(data, selectedMonth) {
  return data.map((entry) => {
    const filteredSessions = {};

    for (const date in entry.sessions_by_date) {
      if (date.startsWith(selectedMonth)) {
        filteredSessions[date] = entry.sessions_by_date[date];
      }
    }

    return {
      ...entry,
      sessions_by_date: filteredSessions,
    };
  });
}

function formatResultForTelegram(data, baseDate) {
  // выделяем строку даты в формате YYYY-MM-DD
  const filterDate = baseDate.toISOString().split("T")[0];

  return data
    .map((user) => {
      const sessionsForDate = user.sessions_by_date[filterDate];
      if (!sessionsForDate || sessionsForDate.length === 0) {
        return null; // Пропускаем
      }

      const session = sessionsForDate[0];

      return {
        user_id: user.user_id,
        name: `${user.user_info.surname || ""} ${user.user_info.name || ""} ${
          user.user_info.patronymic || ""
        }`,
        position: user.user_info.position_name,
        department: user.user_info.department_name,
        entry: session.firstEntry,
        exit: session.lastExit,
        workDuration: session.workDuration,
        date: filterDate,
      };
    })
    .filter(Boolean);
}

async function getEmployeeTripsMap(startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT 
      employee_id, 
      CASE 
        WHEN type = 'day' 
          THEN to_char((date_from AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD')
        ELSE 
          to_char(date_from AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI:SS')
      END AS date_from,
      CASE 
        WHEN type = 'day' 
          THEN to_char((date_to AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD')
        ELSE 
          to_char(date_to AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI:SS')
      END AS date_to,
      is_company_paid,
      reason,
      permission_number,
      credited_hours,
      type
    FROM leave_permissions
    WHERE date_from <= $2 AND date_to >= $1
  `,
    [startDate, endDate],
  );

  const tripsMap = {};
  for (const trip of rows) {
    if (!tripsMap[trip.user_id]) tripsMap[trip.user_id] = [];
    tripsMap[trip.user_id].push(trip);
  }
  return tripsMap;
}

function getAdjustedTimes(dateFrom, dateTo, creditedHours = null) {
  const hasTimeFrom = typeof dateFrom === "string" && dateFrom.includes(":");
  const hasTimeTo = typeof dateTo === "string" && dateTo.includes(":");

  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  const firstEntry = hasTimeFrom ? format(start, "HH:mm") : null;
  const lastExit = hasTimeTo ? format(end, "HH:mm") : null;

  let workDuration = null;

  if (typeof creditedHours === "number" && creditedHours > 0) {
    workDuration = `${String(creditedHours).padStart(2, "0")}:00`;
  } else if (hasTimeFrom && hasTimeTo) {
    const diffMs = end - start;
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    workDuration = `${String(hours).padStart(2, "0")}:${String(
      minutes,
    ).padStart(2, "0")}`;
  }

  if (creditedHours !== null && !hasTimeFrom && !hasTimeTo) {
    return {
      firstEntry: null,
      lastExit: null,
      workDuration,
      date_from: format(start, "yyyy-MM-dd"),
      time_range: null,
    };
  }

  return {
    firstEntry,
    lastExit,
    workDuration,
    date_from: hasTimeFrom
      ? format(start, "yyyy-MM-dd HH:mm:ss")
      : format(start, "yyyy-MM-dd"),
    date_to: hasTimeTo
      ? format(end, "yyyy-MM-dd HH:mm:ss")
      : format(end, "yyyy-MM-dd"),
    time_range:
      creditedHours !== null
        ? null
        : hasTimeFrom && hasTimeTo
          ? `${firstEntry} - ${lastExit}`
          : null,
  };
}

function injectPermissionsIntoSessions(result, tripsMap, startDate, endDate) {
  const days = eachDayOfInterval({ start: startDate, end: endDate }).map((d) =>
    format(d, "yyyy-MM-dd"),
  );

  for (const user of result) {
    const userTrips = tripsMap[user.user_id] || [];

    for (const trip of userTrips) {
      if (!trip.is_company_paid) continue;

      const tripStart = trip.date_from.slice(0, 10);
      const tripEnd = trip.date_to.slice(0, 10);

      for (const day of days) {
        if (day >= tripStart && day <= tripEnd) {
          if (!user.sessions_by_date[day]) {
            const {
              firstEntry,
              lastExit,
              workDuration,
              date_from,
              date_to,
              time_range,
            } = getAdjustedTimes(
              trip.date_from,
              trip.date_to,
              trip.credited_hours,
            );

            // Если передан credited_hours и дата без времени → оставляем только дату
            const noTimeInDates =
              !trip.date_from.includes(":") && !trip.date_to.includes(":");

            user.sessions_by_date[day] = [
              {
                hasPermission: true,
                firstEntry,
                lastExit,
                workDuration,
                events: [
                  {
                    leave_request: {
                      reason: trip.reason,
                      permission_number: trip.permission_number,
                      date_from: noTimeInDates
                        ? trip.date_from.slice(0, 10)
                        : date_from,
                      date_to: noTimeInDates
                        ? trip.date_to.slice(0, 10)
                        : date_to,
                      time_range,
                      company_paid: trip.is_company_paid ? "Да" : "Нет",
                      type: trip.type,
                      credited_hours: trip.credited_hours ?? 0,
                    },
                  },
                ],
              },
            ];
          }
        }
      }
    }
  }

  return result;
}

export async function getTimesheet(req, res) {
  const userId = req.user.id;

  try {
    const { page, pageSize, filters } = req.query;

    if (!filters.month)
      return res.status(400).json({ error: "Месяц не выбран" });

    const [year, monthValue] = filters.month.split("-").map(Number);

    // Формируем даты начала и конца месяца
    const start_date = new Date(year, monthValue - 1, 1, 0, 0, 0);
    const end_date = new Date(year, monthValue, 0, 23, 59, 59);

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
    const events = await facePassesService.getAllFacePasses({
      userId,
      filters: {
        ...filters,
        employeeIds: employees.data.map((e) => e.id),
      },
    });

    let processedEvents = generateAttendanceReport(events);

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
          branchName: emp?.branch?.name,
          departmentName: emp?.department?.name,
          positionName: emp?.position?.name,
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

export async function getTimesheetOld(req, res) {
  const userId = req.user.id;

  try {
    const { page, pageSize, filters } = req.query;

    if (!filters.month)
      return res.status(400).json({ error: "Месяц не выбран" });

    const [year, monthValue] = filters.month.split("-").map(Number);

    // Формируем даты начала и конца месяца
    const start_date = new Date(year, monthValue - 1, 1, 0, 0, 0);
    const end_date = new Date(year, monthValue, 0, 23, 59, 59);

    filters.start_date = start_date;
    filters.end_date = end_date;

    // --- праздники ---
    const holidays = await getHolidays(filters.month);

    // --- события ---
    const events = await facePassesService.getAllFacePasses({
      userId,
      filters,
    });

    // console.log(JSON.stringify(events, null, 2));

    const processedEvents = processEvents(events);

    // --- подмешиваем отпуска/командировки ---
    /*
    const extendedResult = injectPermissionsIntoSessions(
      processedEvents,
      {},
      start_date,
      end_date
    );

    const filteredResult = filterSessionsByMonth(extendedResult, month);

    */

    res.status(200).json({
      success: true,
      data: processedEvents,
      holidays,
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
