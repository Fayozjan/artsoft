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
import { prismaContext } from "../../utils/prismaContext.js";

async function fetchPayrollLateData(employeeIds, year, month) {
  if (!employeeIds?.length) return { moneyMap: new Map(), minutesMap: new Map() };
  const prisma = prismaContext.get();
  const sheet = await prisma.payroll_sheets.findFirst({
    where: { year, month },
    select: { id: true },
  });
  if (!sheet) return { moneyMap: new Map(), minutesMap: new Map() };
  const items = await prisma.payroll_sheet_items.findMany({
    where: { sheet_id: sheet.id, employee_id: { in: employeeIds.map(Number) } },
    select: { employee_id: true, late_amount: true, late_minutes: true },
  });
  return {
    moneyMap: new Map(items.map((i) => [String(i.employee_id), Number(i.late_amount || 0)])),
    minutesMap: new Map(items.map((i) => [String(i.employee_id), Number(i.late_minutes || 0)])),
  };
}

const SORT_FIELD_MAP = {
  last_name: "employeeFullName",
  employee_number: "employeeNumber",
  late_minutes: "lateMinutes",
  branch: "branchName",
  department: "departmentName",
  position: "positionName",
  monthly_arrival_late_count: "monthlyArrivalLateCount",
  monthly_late_minutes: "monthlyLateMinutes",
  monthly_late_money: "monthlyLateMoney",
};

function applySearchSortPaginate(list, { search, sort_by, sort_order, pageNum, pageSizeNum }) {
  let result = list;

  if (search) {
    const s = search.toLowerCase();
    result = result.filter(
      (e) =>
        e.employeeFullName?.toLowerCase().includes(s) ||
        String(e.employeeNumber || "").includes(s),
    );
  }

  const sortField = SORT_FIELD_MAP[sort_by] || "employeeFullName";
  const sortDir = sort_order === "desc" ? -1 : 1;
  result = [...result].sort((a, b) => {
    const aVal = a[sortField] ?? "";
    const bVal = b[sortField] ?? "";
    if (typeof aVal === "number" && typeof bVal === "number")
      return (aVal - bVal) * sortDir;
    return String(aVal).localeCompare(String(bVal)) * sortDir;
  });

  const totalItems = result.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSizeNum));
  const paginated = result.slice((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum);

  return { paginated, totalItems, totalPages };
}

export async function getLateEmployeesService({ userId, filters, page, pageSize }) {
  const pageNum = parseInt(page) || 1;
  const pageSizeNum = parseInt(pageSize) || 50;
  const { mode, date } = filters;
  const includeLunchLate = filters.include_lunch_late === "true" || filters.include_lunch_late === true;

  if (mode === "day") {
    const { startDate, endDate } = getDateRange(filters.mode, filters.date);

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

    if (!lateEmployeesDay.length) return { data: [], pagination: { totalItems: 0, totalPages: 1, currentPage: pageNum }, success: true };

    const lateEmployeeIds = lateEmployeesDay.map((e) => e.employeeId);
    const { monthStartDate, monthEndDate } = getMonthRangeFromDate(date);

    const [monthlyHolidays, monthlyTimeOffs, monthlyFacePasses] = await Promise.all([
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

    const monthlyData = generateAttendanceReport(monthlyFacePasses, monthlyTimeOffs);
    const monthlyLateInfo = await findLateEmployeesByMonth(
      monthlyData,
      monthlyHolidays.data,
      monthlyTimeOffs.data,
      includeLunchLate,
    );

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

    const payrollYear = monthStartDate.getFullYear();
    const payrollMonth = monthStartDate.getMonth() + 1;
    const { moneyMap, minutesMap } = await fetchPayrollLateData(lateEmployeeIds, payrollYear, payrollMonth);

    const merged = lateEmployeesDay.map((emp) => {
      const empId = String(emp.employeeId);
      const monthly = monthlyMap.get(emp.employeeId);
      const monthlyLateMoney = moneyMap.get(empId) ?? 0;
      const monthlyLateMinutesPR = minutesMap.get(empId) ?? 0;
      const dailyLateMoney =
        monthlyLateMinutesPR > 0 && monthlyLateMoney > 0
          ? Math.round((emp.lateMinutes / monthlyLateMinutesPR) * monthlyLateMoney)
          : 0;
      return {
        ...emp,
        monthlyArrivalLateCount: monthly?.monthlyArrivalLateCount || 0,
        monthlyLunchLateCount: monthly?.monthlyLunchLateCount || 0,
        monthlyLateMinutes: monthly?.monthlyLateMinutes || 0,
        monthlyBreakReturnLateMinutes: monthly?.monthlyBreakReturnLateMinutes || 0,
        monthlyLateMoney,
        dailyLateMoney,
      };
    });

    const { paginated, totalItems, totalPages } = applySearchSortPaginate(merged, {
      search: filters.search,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
      pageNum,
      pageSizeNum,
    });

    return {
      data: paginated,
      pagination: { totalItems, totalPages, currentPage: pageNum },
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

    const payrollYear = startDate.getFullYear();
    const payrollMonth = startDate.getMonth() + 1;
    const empIds = lateEmployeesByMonth.map((e) => e.employeeId);
    const { moneyMap } = await fetchPayrollLateData(empIds, payrollYear, payrollMonth);
    lateEmployeesByMonth.forEach((emp) => {
      emp.monthlyLateMoney = moneyMap.get(String(emp.employeeId)) ?? 0;
    });

    const { paginated, totalItems, totalPages } = applySearchSortPaginate(lateEmployeesByMonth, {
      search: filters.search,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
      pageNum,
      pageSizeNum,
    });

    return {
      data: {
        lateEmployeesByMonth: paginated,
        lateByBranchAndDay,
      },
      pagination: { totalItems, totalPages, currentPage: pageNum },
    };
  }
}
