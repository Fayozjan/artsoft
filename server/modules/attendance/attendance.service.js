import { DateTime } from "luxon";

import { UserModel } from "../users/users.model.js";
import { generateAttendanceReport } from "../../utils/attendanceUtils.js";
import { EmployeeService } from "../employees/employees.service.js";
import { splitEmployeesByTodayStatus } from "./attendance.helpers.js";
import { findLateEmployeesByDay } from "../lateEmployees/lateEmployees.helpers.js";
import { FacePassesService } from "../facePasses/facePasses.service.js";
import { getHolidaysService } from "../holidays/holidays.service.js";
import { TimeOffService } from "../timeOff/timeOff.service.js";
import { BranchService } from "../branches/branches.service.js";
import { DepartmentsService } from "../departments/departments.service.js";

export async function getAttendanceService({ userId, filters }) {
  const user = await UserModel.getById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");

  const dt = DateTime.fromISO(filters.date, { zone: "Asia/Tashkent" });
  const dayKey = dt.toFormat("yyyy-MM-dd");

  const start_date = dt.minus({ days: 1 }).startOf("day").toJSDate();
  const end_date = dt.endOf("day").toJSDate();

  filters.start_date = start_date;
  filters.end_date = end_date;

  const [faceEvents, employees, holidays, timeOffs, branches, departments] =
    await Promise.all([
      FacePassesService.getAll({ userId, filters }),
      EmployeeService.getActive({ userId, filters }),
      getHolidaysService(start_date, end_date),
      TimeOffService.getAll({ userId, filters: { start_date, end_date } }),
      BranchService.listActive({ userId }),
      DepartmentsService.getActiveDepartments({ userId }),
    ]);

  let attendanceEvents = generateAttendanceReport(faceEvents);

  attendanceEvents = attendanceEvents.map((item) => ({
    ...item,
    sessions: item.sessions?.[dayKey]
      ? { [dayKey]: item.sessions[dayKey] }
      : {},
  }));

  const attendanceMap = new Map(
    attendanceEvents.map((e) => [String(e.employeeId), e]),
  );

  for (const emp of employees.data) {
    const key = String(emp.id);

    if (!attendanceMap.has(key)) {
      attendanceEvents.push({
        ...emp,
        employeeId: emp.id,
      });
    }
  }

  const { present, absent, inside, left } =
    splitEmployeesByTodayStatus(attendanceEvents);

  const presentIds = new Set(present.map((item) => item.id));
  const filteredAttendanceEvents = attendanceEvents.filter((item) =>
    presentIds.has(item.id),
  );

  const late = await findLateEmployeesByDay(
    filteredAttendanceEvents,
    filters.date,
  );

  return {
    data: {
      employees: employees.data,
      branches: branches.data,
      departments: departments.data,
      present: present,
      absent: absent,
      late: late,
      inside: inside,
      left: left,
    },
  };
}

export async function getAttendanceServiceByEmployeeId({
  userId,
  employeeId,
  filters = {},
}) {
  const user = await UserModel.getById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");

  const dt = filters.date
    ? DateTime.fromISO(filters.date, { zone: "Asia/Tashkent" })
    : DateTime.now().setZone("Asia/Tashkent");

  const dayKey = dt.toFormat("yyyy-MM-dd");

  // Границы дня и месяца
  const dayStart = dt.minus({ days: 1 }).startOf("day").toJSDate();
  const dayEnd = dt.endOf("day").toJSDate();
  const monthStart = dt
    .startOf("month")
    .minus({ days: 1 })
    .startOf("day")
    .toJSDate();
  const monthEnd = dt.endOf("month").endOf("day").toJSDate();

  const employeeFilters = { ...filters, employeeId };

  const [
    dayFaceEvents,
    monthFaceEvents,
    employee,
    holidays,
    dayTimeOffs,
    monthTimeOffs,
  ] = await Promise.all([
    FacePassesService.getAll({
      userId,
      filters: { ...employeeFilters, start_date: dayStart, end_date: dayEnd },
    }),
    FacePassesService.getAll({
      userId,
      filters: {
        ...employeeFilters,
        start_date: monthStart,
        end_date: monthEnd,
      },
    }),
    EmployeeService.getById(employeeId),
    getHolidaysService(monthStart, monthEnd),
    TimeOffService.getAll({
      userId,
      filters: { start_date: dayStart, end_date: dayEnd },
    }),
    TimeOffService.getAll({
      userId,
      filters: { start_date: monthStart, end_date: monthEnd },
    }),
  ]);

  if (!employee) throw new Error("Сотрудник не найден");

  // --- Инициализация дефолтных значений ---
  let daySessions = {};
  let dayLate = null;

  let monthStats = {
    totalDays: 0,
    lateDays: 0,
    lateDetails: [],
    sessions: {},
  };

  // ─── Обработка данных за ДЕНЬ ─────────────────────────────────────
  // Если событий нет, не вызываем генерацию отчета и проверку опозданий
  if (dayFaceEvents && dayFaceEvents.length > 0) {
    const dayAttendanceEvents = generateAttendanceReport(dayFaceEvents);

    console.log("dayAttendanceEvents", dayAttendanceEvents);

    const dayEvent = dayAttendanceEvents.find(
      (e) => String(e.employeeId) === String(employeeId),
    );

    if (dayEvent && dayEvent.sessions?.[dayKey]) {
      daySessions = { [dayKey]: dayEvent.sessions[dayKey] };

      // Проверка на опоздание только если есть сессии
      const [lateResult] = await findLateEmployeesByDay(
        [{ ...dayEvent, sessions: daySessions }],
        dayKey,
        holidays.data,
        dayTimeOffs.data,
      );
      dayLate = lateResult;
    }
  }

  // ─── Обработка данных за МЕСЯЦ ────────────────────────────────────
  if (monthFaceEvents && monthFaceEvents.length > 0) {
    const monthAttendanceEvents = generateAttendanceReport(monthFaceEvents);

    console.log("monthAttendanceEvents", monthAttendanceEvents[0].sessions);

    const monthEvent = monthAttendanceEvents.find(
      (e) => String(e.employeeId) === String(employeeId),
    );

    if (monthEvent && monthEvent.sessions) {
      const monthDays = Object.keys(monthEvent.sessions);

      // Убираем .then(), так как findLateEmployeesByDay возвращает массив, а не Promise
      const monthLateChecks = monthDays.map((date) => {
        const result = findLateEmployeesByDay(
          [{ ...monthEvent, sessions: { [date]: monthEvent.sessions[date] } }],
          date,
          holidays.data,
          monthTimeOffs.data,
        );

        // Результат функции - массив, берем первый элемент или null
        return result && result[0] ? result[0] : null;
      });

      monthStats = {
        totalDays: monthDays.length,
        lateDays: monthLateChecks.filter(Boolean).length,
        lateDetails: monthLateChecks.filter(Boolean),
        sessions: monthEvent.sessions,
      };
    }
  }

  // Возвращаем структуру в любом случае
  return {
    data: {
      employee,
      today: {
        date: dayKey,
        sessions: daySessions,
        isLate: !!dayLate,
        lateInfo: dayLate ?? null,
        // Доп. поля для фронта, если daySessions пуст
        status:
          dayFaceEvents.length === 0 ? "absent" : dayLate ? "late" : "present",
      },
      month: {
        from: dt.startOf("month").toFormat("yyyy-MM-dd"),
        to: dt.endOf("month").toFormat("yyyy-MM-dd"),
        ...monthStats,
      },
    },
  };
}
