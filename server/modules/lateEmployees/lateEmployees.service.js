import { getTimeOffsAllService } from "../timeOff/timeOff.service.js";

import { generateAttendanceReport } from "../../utils/attendanceUtils.js";

import {
  findLateEmployeesByDay,
  findLateEmployeesByMonth,
  getDateRange,
  getMonthRangeFromDate,
} from "./lateEmployees.helpers.js";

import { getAllFacePasses } from "../facePasses/facePasses.service.js";
import { getHolidaysService } from "../holidays/holidays.service.js";

export async function getLateEmployeesService({ userId, filters }) {
  const { mode, date } = filters;

  if (mode === "day") {
    const { startDate, endDate } = getDateRange(filters.mode, filters.date);

    // --- 1. Опоздавшие за день ---
    const [holidays, timeOffs, dayFacePasses] = await Promise.all([
      getHolidaysService(startDate, endDate),
      getTimeOffsAllService({ userId, filters: { startDate, endDate } }),
      getAllFacePasses({
        userId,
        filters: { ...filters, start_date: startDate, end_date: endDate },
      }),
    ]);

    const dayData = generateAttendanceReport(dayFacePasses);

    const lateEmployeesDay = await findLateEmployeesByDay(
      dayData,
      filters.date,
      holidays.data,
      timeOffs.data
    );

    if (!lateEmployeesDay.length) return { data: [], success: true };

    const lateEmployeeIds = lateEmployeesDay.map((e) => e.employeeId);
    const { monthStartDate, monthEndDate } = getMonthRangeFromDate(date);

    // --- 2. Данные за месяц только для этих сотрудников ---
    const [monthlyHolidays, monthlyTimeOffs, monthlyFacePasses] =
      await Promise.all([
        getHolidaysService(monthStartDate, monthEndDate),
        getTimeOffsAllService({
          userId,
          filters: { startDate: monthStartDate, endDate: monthEndDate },
        }),

        getAllFacePasses({
          userId,
          filters: {
            employeeIds: lateEmployeeIds,
            start_date: monthStartDate,
            end_date: monthEndDate,
          },
        }),
      ]);

    const monthlyData = generateAttendanceReport(monthlyFacePasses);

    const monthlyLateInfo = await findLateEmployeesByMonth(
      monthlyData,
      monthlyHolidays.data,
      monthlyTimeOffs.data
    );

    // --- 3. Собираем финальный массив сотрудников ---
    const monthlyMap = new Map(
      monthlyLateInfo.map((emp) => [emp.id, emp.monthlyLateCount])
    );

    return {
      data: lateEmployeesDay.map((emp) => ({
        ...emp,
        monthlyLateCount: monthlyMap.get(emp.id) || 0,
      })),
      success: true,
    };
  } else {
    const { startDate, endDate } = getDateRange("month", date);
    const [holidays, timeOffs, facePasses] = await Promise.all([
      getHolidaysService(startDate, endDate),
      getTimeOffsAllService({ userId, filters: { startDate, endDate } }),
      getAllFacePasses({
        userId,
        filters: { ...filters, start_date: startDate, end_date: endDate },
      }),
    ]);

    const monthlyData = generateAttendanceReport(facePasses);

    const monthlyLateEmployees = await findLateEmployeesByMonth(
      monthlyData,
      holidays.data,
      timeOffs.data
    );

    return { data: monthlyLateEmployees, success: true };
  }
}
