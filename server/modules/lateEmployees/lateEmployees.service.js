import { TimeOffService } from "../timeOff/timeOff.service.js";

import {
  generateAttendanceReport,
  countScheduledDays,
} from "../../utils/attendanceUtils.js";

import {
  findLateByBranchAndDay,
  findLateEmployeesByDay,
  findLateEmployeesByMonth,
  getDateRange,
  getMonthRangeFromDate,
  getMonthsInRange,
  getPeriodRange,
  getYearMonth,
} from "./lateEmployees.helpers.js";

import { FacePassesService } from "../facePasses/facePasses.service.js";
import { EmployeeService } from "../employees/employees.service.js";
import { getDaysInRange as getCalendarDaysInRange } from "../productionCalendar/productionCalendar.model.js";
import { buildCalendarContext } from "../../utils/productionCalendar.utils.js";
import { prismaContext } from "../../utils/prismaContext.js";

// Разрешает branch_ids/department_ids/position_ids/employee_ids (как в TimesheetFilter)
// в конкретный список employeeIds — та же схема, что и getMonthTimesheet в timesheet.service.js
async function resolveFilterEmployeeIds({ userId, filters }) {
  const { branch_ids, department_ids, position_ids, employee_ids } = filters;
  const hasFilter = [branch_ids, department_ids, position_ids, employee_ids].some(
    (arr) => Array.isArray(arr) && arr.length > 0,
  );
  if (!hasFilter) return null;

  const employees = await EmployeeService.getAll({
    userId,
    filters: { branch_ids, department_ids, position_ids, employee_ids },
    page: 1,
    pageSize: 999999,
  });
  return employees.data.map((e) => e.id);
}

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

/**
 * Штраф за произвольный период. В payroll сумма считается помесячно, поэтому
 * для каждого месяца периода берём его сумму и распределяем пропорционально
 * минутам опозданий, попавшим в период.
 */
async function fetchPeriodLateMoney(employees, months) {
  const totals = new Map();
  if (!employees.length) return totals;

  const empIds = employees.map((e) => e.employeeId);

  for (const ym of months) {
    const [year, month] = ym.split("-").map(Number);
    const { moneyMap, minutesMap } = await fetchPayrollLateData(empIds, year, month);
    if (!moneyMap.size) continue;

    employees.forEach((emp) => {
      const id = String(emp.employeeId);
      const monthMoney = moneyMap.get(id) ?? 0;
      const monthMinutes = minutesMap.get(id) ?? 0;
      if (monthMoney <= 0 || monthMinutes <= 0) return;

      const periodMinutes = emp.details.reduce(
        (sum, d) => (String(d.date).startsWith(ym) ? sum + (d.lateMinutes || 0) : sum),
        0,
      );
      if (periodMinutes <= 0) return;

      totals.set(
        id,
        (totals.get(id) || 0) + Math.round((periodMinutes / monthMinutes) * monthMoney),
      );
    });
  }

  return totals;
}

// Виджеты на странице должны показывать итоги за весь период, а не за
// текущую страницу — считаем их до пагинации и отдаём отдельным блоком
function buildLateSummary(list) {
  return list.reduce(
    (acc, e) => {
      acc.lateEmployeesCount += 1;
      acc.totalLateMinutes += e.lateMinutes || e.monthlyLateMinutes || 0;
      acc.totalArrivalLateCount += e.monthlyArrivalLateCount || 0;
      acc.totalLunchLateCount += e.monthlyLunchLateCount || 0;
      acc.totalBreakReturnMinutes += e.monthlyBreakReturnLateMinutes || 0;
      acc.totalLateMoney += Number(e.monthlyLateMoney) || 0;
      return acc;
    },
    {
      lateEmployeesCount: 0,
      totalLateMinutes: 0,
      totalArrivalLateCount: 0,
      totalLunchLateCount: 0,
      totalBreakReturnMinutes: 0,
      totalLateMoney: 0,
    },
  );
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

function getLateNumericPriority(emp, s) {
  if (String(emp.employeeId) === s) return 1;
  if (String(emp.employeeNumber || "") === s) return 2;
  if ((emp.pinfl || "").includes(s)) return 3;
  return 4;
}

function applySearchSortPaginate(list, { search, sort_by, sort_order, pageNum, pageSizeNum }) {
  let result = list;
  const isNumeric = search && /^\d+$/.test(search.trim());

  if (search) {
    const s = search.trim();
    const sLower = s.toLowerCase();
    result = result.filter(
      (e) =>
        e.employeeFullName?.toLowerCase().includes(sLower) ||
        String(e.employeeNumber || "").includes(s) ||
        (isNumeric && (String(e.employeeId) === s || (e.pinfl || "").includes(s))),
    );
  }

  if (isNumeric) {
    const s = search.trim();
    result = [...result].sort((a, b) => getLateNumericPriority(a, s) - getLateNumericPriority(b, s));
  } else {
    const sortField = SORT_FIELD_MAP[sort_by] || "employeeFullName";
    const sortDir = sort_order === "desc" ? -1 : 1;
    result = [...result].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      if (typeof aVal === "number" && typeof bVal === "number")
        return (aVal - bVal) * sortDir;
      return String(aVal).localeCompare(String(bVal)) * sortDir;
    });
  }

  const totalItems = result.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSizeNum));
  const paginated = result.slice((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum);

  return { paginated, totalItems, totalPages };
}

export async function getLateEmployeesService({ userId, filters, page, pageSize }) {
  // pageSize=all — выгрузка в Excel, отдаём весь список без пагинации
  const isAllPages = pageSize === "all";
  const pageNum = isAllPages ? 1 : parseInt(page) || 1;
  const pageSizeNum = isAllPages ? Number.MAX_SAFE_INTEGER : parseInt(pageSize) || 50;
  const { mode, date } = filters;
  const includeLunchLate = filters.include_lunch_late === "true" || filters.include_lunch_late === true;
  const filterEmployeeIds = await resolveFilterEmployeeIds({ userId, filters });

  if (filterEmployeeIds && filterEmployeeIds.length === 0) {
    const emptySummary = buildLateSummary([]);
    return mode === "month" || mode === "period"
      ? {
          data: { lateEmployeesByMonth: [], lateByBranchAndDay: [] },
          summary: emptySummary,
          pagination: { totalItems: 0, totalPages: 1, currentPage: pageNum },
        }
      : {
          data: [],
          summary: emptySummary,
          pagination: { totalItems: 0, totalPages: 1, currentPage: pageNum },
          success: true,
        };
  }

  if (mode === "day") {
    const { startDate, endDate } = getDateRange(filters.mode, filters.date);

    const [timeOffs, dayFacePasses] = await Promise.all([
      TimeOffService.getAll({ userId, filters: { date_from: startDate, date_to: endDate } }),
      FacePassesService.getAll({
        userId,
        filters: {
          ...filters,
          start_date: startDate,
          end_date: endDate,
          ...(filterEmployeeIds ? { employeeIds: filterEmployeeIds } : {}),
        },
      }),
    ]);

    const dayData = generateAttendanceReport(dayFacePasses, timeOffs);
    const lateEmployeesDay = findLateEmployeesByDay(dayData, filters.date, includeLunchLate);

    if (!lateEmployeesDay.length)
      return {
        data: [],
        summary: buildLateSummary([]),
        pagination: { totalItems: 0, totalPages: 1, currentPage: pageNum },
        success: true,
      };

    const lateEmployeeIds = lateEmployeesDay.map((e) => e.employeeId);
    const { monthStartDate, monthEndDate } = getMonthRangeFromDate(date);

    const [monthlyCalendar, monthlyTimeOffs, monthlyFacePasses] = await Promise.all([
      getCalendarDaysInRange(monthStartDate, monthEndDate),
      TimeOffService.getAll({
        userId,
        filters: { date_from: monthStartDate, date_to: monthEndDate },
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
      getYearMonth(date),
      null,
      buildCalendarContext(monthlyCalendar),
    );
    const monthlyLateInfo = await findLateEmployeesByMonth(
      monthlyData,
      monthlyCalendar,
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

    const [payrollYear, payrollMonth] = getYearMonth(date).split("-").map(Number);
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
      summary: buildLateSummary(merged),
      pagination: { totalItems, totalPages, currentPage: pageNum },
      success: true,
    };
  }

  if (mode === "month") {
    const { startDate, endDate } = getDateRange("month", date);
    const [calendarOverrides, timeOffs, facePasses] = await Promise.all([
      getCalendarDaysInRange(startDate, endDate),
      TimeOffService.getAll({ userId, filters: { date_from: startDate, date_to: endDate } }),
      FacePassesService.getAll({
        userId,
        filters: {
          ...filters,
          start_date: startDate,
          end_date: endDate,
          ...(filterEmployeeIds ? { employeeIds: filterEmployeeIds } : {}),
        },
      }),
    ]);

    // yearMonth нужен, чтобы отчёт посчитал плановые дни по графику
    // (totalScheduledDays) — без него они всегда 0; нерабочие дни
    // производственного календаря вычитаются из них
    const yearMonth = getYearMonth(date);
    const monthlyData = generateAttendanceReport(
      facePasses,
      timeOffs,
      yearMonth,
      null,
      buildCalendarContext(calendarOverrides),
    );

    const lateEmployeesByMonth = findLateEmployeesByMonth(
      monthlyData,
      calendarOverrides,
      timeOffs.data,
      includeLunchLate,
    );

    const lateByBranchAndDay = findLateByBranchAndDay(
      monthlyData,
      calendarOverrides,
      timeOffs.data,
      includeLunchLate,
    );

    const [payrollYear, payrollMonth] = yearMonth.split("-").map(Number);
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
      summary: buildLateSummary(lateEmployeesByMonth),
      pagination: { totalItems, totalPages, currentPage: pageNum },
    };
  }

  if (mode === "period") {
    const dateFrom = filters.date_from;
    const dateTo = filters.date_to;
    const { startDate, endDate } = getPeriodRange(dateFrom, dateTo);

    const [calendarOverrides, timeOffs, facePasses] = await Promise.all([
      getCalendarDaysInRange(startDate, endDate),
      TimeOffService.getAll({ userId, filters: { date_from: startDate, date_to: endDate } }),
      FacePassesService.getAll({
        userId,
        filters: {
          ...filters,
          start_date: startDate,
          end_date: endDate,
          ...(filterEmployeeIds ? { employeeIds: filterEmployeeIds } : {}),
        },
      }),
    ]);

    // yearMonth не передаём: период может пересекать несколько месяцев —
    // сессии режутся по границам периода в самих find*-хелперах
    const periodData = generateAttendanceReport(facePasses, timeOffs);
    const range = { from: dateFrom, to: dateTo };

    const lateEmployeesByMonth = findLateEmployeesByMonth(
      periodData,
      calendarOverrides,
      timeOffs.data,
      includeLunchLate,
      range,
    );

    const lateByBranchAndDay = findLateByBranchAndDay(
      periodData,
      calendarOverrides,
      timeOffs.data,
      includeLunchLate,
      range,
    );

    // totalScheduledDays из отчёта считается только по месяцу, поэтому плановые
    // дни за период добираем прямо из графика сотрудника (за вычетом нерабочих
    // дней производственного календаря)
    const scheduleMap = new Map(
      (facePasses || []).map((e) => [String(e.employeeId), e.workSchedule]),
    );
    const calendarCtx = buildCalendarContext(calendarOverrides);
    lateEmployeesByMonth.forEach((emp) => {
      emp.monthlyWorkDays = countScheduledDays(
        startDate,
        endDate,
        scheduleMap.get(String(emp.employeeId)),
        calendarCtx,
      );
    });

    const moneyByEmployee = await fetchPeriodLateMoney(
      lateEmployeesByMonth,
      getMonthsInRange(dateFrom, dateTo),
    );
    lateEmployeesByMonth.forEach((emp) => {
      emp.monthlyLateMoney = moneyByEmployee.get(String(emp.employeeId)) ?? 0;
    });

    const { paginated, totalItems, totalPages } = applySearchSortPaginate(
      lateEmployeesByMonth,
      {
        search: filters.search,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
        pageNum,
        pageSizeNum,
      },
    );

    return {
      data: {
        lateEmployeesByMonth: paginated,
        lateByBranchAndDay,
      },
      summary: buildLateSummary(lateEmployeesByMonth),
      pagination: { totalItems, totalPages, currentPage: pageNum },
    };
  }
}
