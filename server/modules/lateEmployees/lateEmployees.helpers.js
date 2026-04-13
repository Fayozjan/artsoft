import { DateTime } from "luxon";

export function getDateRange(mode, date) {
  const dt =
    typeof date === "string"
      ? DateTime.fromISO(date, { zone: "Asia/Tashkent" })
      : DateTime.fromJSDate(date, { zone: "Asia/Tashkent" });

  if (!dt.isValid) throw new Error("Invalid date");

  let startDate, endDate;

  if (mode === "month") {
    startDate = dt.startOf("month").toJSDate();
    endDate = dt.endOf("month").toJSDate();
  } else {
    // "day"
    startDate = dt.startOf("day").toJSDate();
    endDate = dt.endOf("day").toJSDate();
  }

  return { startDate, endDate };
}

export function getMonthRangeFromDate(date) {
  const dt =
    typeof date === "string"
      ? DateTime.fromISO(date, { zone: "Asia/Tashkent" })
      : DateTime.fromJSDate(date, { zone: "Asia/Tashkent" });

  if (!dt.isValid) throw new Error("Invalid date");

  return {
    monthStartDate: dt.startOf("month").toJSDate(),
    monthEndDate: dt.endOf("month").toJSDate(),
  };
}

export const findLateEmployeesByDay = (data, targetDate) => {
  if (!targetDate) throw new Error("targetDate обязателен");

  const lateEmployees = [];

  data.forEach((employee) => {
    const {
      employeeId,
      employeeNumber,
      employeeFullName,
      employeePhoto,
      branchName,
      departmentName,
      positionName,
      workScheduleName,
      sessions,
    } = employee;

    if (!sessions) return;

    const session = sessions[targetDate];
    if (!session) return;

    const { firstEntry, events, shiftType, scheduleStart, late, timeOff } =
      session;

    if (!firstEntry || !scheduleStart || shiftType === "flexible") return;
    if (!late || late === "00:00") return;

    const [h, m] = late.split(":").map(Number);
    const lateMinutes = h * 60 + m;

    if (lateMinutes <= 0) return;

    const firstEntryEvent =
      events?.find((e) => e.direction === "entry") ?? null;

    lateEmployees.push({
      employeeId,
      employeeNumber,
      employeeFullName,
      employeePhoto,
      branchName,
      departmentName,
      positionName,
      workScheduleName,
      date: targetDate,
      shiftType,
      scheduledStart: scheduleStart,
      actualStart: firstEntry,
      actualStartPhoto: firstEntryEvent?.photo ?? null,
      lateMinutes,
      timeOff: timeOff
        ? {
            id: timeOff.id,
            type: timeOff.type,
            reason: timeOff.reason,
            isCompanyPaid: timeOff.isCompanyPaid,
            dateFrom: timeOff.date_from,
            dateTo: timeOff.date_to,
          }
        : null,
    });
  });

  return lateEmployees;
};

export const findLateEmployeesByMonth = (data) => {
  const grouped = {};

  data.forEach((employee) => {
    const {
      employeeId,
      employeeNumber,
      employeeFullName,
      employeePhoto,
      branchName,
      departmentName,
      positionName,
      workScheduleName,
      sessions,
    } = employee;

    if (!sessions) return;

    Object.entries(sessions).forEach(([dayKey, session]) => {
      const { firstEntry, events, shiftType, scheduleStart, late, timeOff } =
        session;

      if (!firstEntry || !scheduleStart || shiftType === "flexible") return;
      if (!late || late === "00:00") return;

      const [h, m] = late.split(":").map(Number);
      const lateMinutes = h * 60 + m;

      if (lateMinutes <= 0) return;

      const firstEntryEvent =
        events?.find((e) => e.direction === "entry") ?? null;

      if (!grouped[employeeId]) {
        grouped[employeeId] = {
          employeeId,
          employeeNumber,
          employeeFullName,
          employeePhoto,
          branchName,
          departmentName,
          positionName,
          workScheduleName,
          monthlyLateCount: 0,
          monthlyLateMinutes: 0,
          details: [],
        };
      }

      const target = grouped[employeeId];
      target.monthlyLateCount += 1;
      target.monthlyLateMinutes += lateMinutes;
      target.details.push({
        date: dayKey,
        shiftType,
        scheduledStart: scheduleStart,
        actualStart: firstEntry,
        actualStartPhoto: firstEntryEvent?.photo ?? null,
        lateMinutes,
        timeOff: timeOff
          ? {
              id: timeOff.id,
              type: timeOff.type,
              reason: timeOff.reason,
              isCompanyPaid: timeOff.isCompanyPaid,
              dateFrom: timeOff.date_from,
              dateTo: timeOff.date_to,
            }
          : null,
      });
    });
  });

  return Object.values(grouped);
};

export const findLateByBranchAndDay = (data) => {
  const branchData = {};

  data.forEach((employee) => {
    const {
      employeeId,
      employeeNumber,
      employeeFullName,
      employeePhoto,
      branchName,
      departmentName,
      positionName,
      workScheduleName,
      sessions,
    } = employee;

    if (!sessions) return;

    Object.entries(sessions).forEach(([dayKey, session]) => {
      const { firstEntry, events, shiftType, scheduleStart, late, timeOff } =
        session;

      if (!firstEntry || !scheduleStart || shiftType === "flexible") return;
      if (!late || late === "00:00") return;

      const [h, m] = late.split(":").map(Number);
      const lateMinutes = h * 60 + m;

      if (lateMinutes <= 0) return;

      const firstEntryEvent =
        events?.find((e) => e.direction === "entry") ?? null;

      if (!branchData[branchName]) branchData[branchName] = {};
      if (!branchData[branchName][dayKey]) {
        branchData[branchName][dayKey] = { count: 0, employees: [] };
      }

      branchData[branchName][dayKey].count += 1;
      branchData[branchName][dayKey].employees.push({
        employeeId,
        employeeNumber,
        employeeFullName,
        employeePhoto,
        departmentName,
        positionName,
        workScheduleName,
        shiftType,
        scheduledStart: scheduleStart,
        actualStart: firstEntry,
        actualStartPhoto: firstEntryEvent?.photo ?? null,
        lateMinutes,
        timeOff: timeOff
          ? {
              id: timeOff.id,
              type: timeOff.type,
              reason: timeOff.reason,
              isCompanyPaid: timeOff.isCompanyPaid,
              dateFrom: timeOff.date_from,
              dateTo: timeOff.date_to,
            }
          : null,
      });
    });
  });

  return Object.entries(branchData).map(([branchName, days]) => ({
    branchName,
    days: Object.entries(days).map(([date, info]) => ({
      date,
      lateCount: info.count,
      employees: info.employees,
    })),
  }));
};
