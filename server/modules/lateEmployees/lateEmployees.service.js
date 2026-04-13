import { TimeOffService } from "../timeOff/timeOff.service.js";

import { generateAttendanceReport } from "../../utils/attendanceUtils.js";

import {
  findLateByBranchAndDay,
  findLateEmployeesByDay,
  findLateEmployeesByMonth,
  getDateRange,
  getMonthRangeFromDate,
} from "./lateEmployees.helpers.js";

import { FacePassesService } from "../facePasses/facePasses.service.js";
import { getHolidaysService } from "../holidays/holidays.service.js";

export async function getLateEmployeesService({ userId, filters }) {
  const { mode, date } = filters;

  if (mode === "day") {
    const { startDate, endDate } = getDateRange(filters.mode, filters.date);

    // --- 1. Опоздавшие за день ---
    const [holidays, timeOffs, dayFacePasses] = await Promise.all([
      getHolidaysService(startDate, endDate),
      TimeOffService.getAll({ userId, filters: { startDate, endDate } }),
      FacePassesService.getAll({
        userId,
        filters: { ...filters, start_date: startDate, end_date: endDate },
      }),
    ]);

    const dayData = generateAttendanceReport(dayFacePasses, timeOffs);

    const lateEmployeesDay = findLateEmployeesByDay(dayData, filters.date);

    if (!lateEmployeesDay.length) return { data: [], success: true };

    const lateEmployeeIds = lateEmployeesDay.map((e) => e.employeeId);

    const { monthStartDate, monthEndDate } = getMonthRangeFromDate(date);

    // --- 2. Данные за месяц только для этих сотрудников ---
    const [monthlyHolidays, monthlyTimeOffs, monthlyFacePasses] =
      await Promise.all([
        getHolidaysService(monthStartDate, monthEndDate),
        TimeOffService.getAll({
          userId,
          filters: { startDate: monthStartDate, endDate: monthEndDate },
        }),

        FacePassesService.getAll({
          userId,
          filters: {
            employeeIds: lateEmployeeIds,
            start_date: monthStartDate,
            end_date: monthEndDate,
          },
        }),
      ]);

    const monthlyData = generateAttendanceReport(
      monthlyFacePasses,
      monthlyTimeOffs,
    );

    const monthlyLateInfo = await findLateEmployeesByMonth(
      monthlyData,
      monthlyHolidays.data,
      monthlyTimeOffs.data,
    );

    // --- 3. Собираем финальный массив сотрудников ---
    const monthlyMap = new Map(
      monthlyLateInfo.map((emp) => [emp.id, emp.monthlyLateCount]),
    );

    return {
      data: lateEmployeesDay.map((emp) => ({
        ...emp,
        monthlyLateCount: monthlyMap.get(emp.id) || 0,
      })),
      success: true,
    };
  }

  if (mode === "month") {
    const { startDate, endDate } = getDateRange("month", date);
    const [holidays, timeOffs, facePasses] = await Promise.all([
      getHolidaysService(startDate, endDate),
      TimeOffService.getAll({ userId, filters: { startDate, endDate } }),
      FacePassesService.getAll({
        userId,
        filters: { ...filters, start_date: startDate, end_date: endDate },
      }),
    ]);

    const monthlyData = generateAttendanceReport(facePasses, timeOffs);

    const lateEmployeesByMonth = findLateEmployeesByMonth(
      monthlyData,
      holidays.data,
      timeOffs.data,
    );

    const lateByBranchAndDay = findLateByBranchAndDay(
      monthlyData,
      holidays.data,
      timeOffs.data,
    );

    return {
      data: {
        lateEmployeesByMonth,
        lateByBranchAndDay,
      },
    };
  }
}
