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
  const includeLunchLate = filters.include_lunch_late === "true" || filters.include_lunch_late === true;

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

    const lateEmployeesDay = findLateEmployeesByDay(dayData, filters.date, includeLunchLate);

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
      includeLunchLate,
    );

    // --- 3. Собираем финальный массив сотрудников ---
    const monthlyMap = new Map(
      monthlyLateInfo.map((emp) => [
        emp.employeeId,
        {
          monthlyArrivalLateCount: emp.monthlyArrivalLateCount,
          monthlyLunchLateCount: emp.monthlyLunchLateCount,
          monthlyLateMinutes: emp.monthlyLateMinutes,
          monthlyBreakReturnLateMinutes: emp.monthlyBreakReturnLateMinutes,
        },
      ]),
    );

    return {
      data: lateEmployeesDay.map((emp) => ({
        ...emp,
        monthlyArrivalLateCount:
          monthlyMap.get(emp.employeeId)?.monthlyArrivalLateCount || 0,
        monthlyLunchLateCount:
          monthlyMap.get(emp.employeeId)?.monthlyLunchLateCount || 0,
        monthlyLateMinutes:
          monthlyMap.get(emp.employeeId)?.monthlyLateMinutes || 0,
        monthlyBreakReturnLateMinutes:
          monthlyMap.get(emp.employeeId)?.monthlyBreakReturnLateMinutes || 0,
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
      includeLunchLate,
    );

    const lateByBranchAndDay = findLateByBranchAndDay(
      monthlyData,
      holidays.data,
      timeOffs.data,
      includeLunchLate,
    );

    return {
      data: {
        lateEmployeesByMonth,
        lateByBranchAndDay,
      },
    };
  }
}
