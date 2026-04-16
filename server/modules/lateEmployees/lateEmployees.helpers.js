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

const parseHHMM = (str) => {
  if (!str || str === "00:00") return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
};

export const findLateEmployeesByDay = (data, targetDate, includeLunchLate = false) => {
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

    const {
      firstEntry,
      events,
      shiftType,
      scheduleStart,
      late,
      breakReturnLate,
      breakEnd,
      actualBreakReturn,
      timeOff,
    } = session;

    if (!firstEntry || !scheduleStart || shiftType === "flexible") return;

    const lateMinutes = parseHHMM(late);
    const breakReturnLateMinutes = parseHHMM(breakReturnLate);

    if (includeLunchLate) {
      if (lateMinutes <= 0 && breakReturnLateMinutes <= 0) return;
    } else {
      if (lateMinutes <= 0) return;
    }

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
      breakReturnLateMinutes,
      scheduledBreakEnd: breakEnd ?? null,
      actualBreakReturn: actualBreakReturn ?? null,
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

export const findLateEmployeesByMonth = (data, _holidays, _timeOffs, includeLunchLate = false) => {
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
      const {
        firstEntry,
        events,
        shiftType,
        scheduleStart,
        late,
        breakReturnLate,
        breakEnd,
        actualBreakReturn,
        timeOff,
      } = session;

      if (!firstEntry || !scheduleStart || shiftType === "flexible") return;

      const lateMinutes = parseHHMM(late);
      const breakReturnLateMinutes = parseHHMM(breakReturnLate);

      if (includeLunchLate) {
        if (lateMinutes <= 0 && breakReturnLateMinutes <= 0) return;
      } else {
        if (lateMinutes <= 0) return;
      }

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
          monthlyArrivalLateCount: 0,
          monthlyLunchLateCount: 0,
          monthlyLateMinutes: 0,
          monthlyBreakReturnLateMinutes: 0,
          details: [],
        };
      }

      const target = grouped[employeeId];
      if (lateMinutes > 0) target.monthlyArrivalLateCount += 1;
      if (breakReturnLateMinutes > 0) target.monthlyLunchLateCount += 1;
      target.monthlyLateMinutes += lateMinutes;
      target.monthlyBreakReturnLateMinutes += breakReturnLateMinutes;
      target.details.push({
        date: dayKey,
        shiftType,
        scheduledStart: scheduleStart,
        actualStart: firstEntry,
        actualStartPhoto: firstEntryEvent?.photo ?? null,
        lateMinutes,
        breakReturnLateMinutes,
        scheduledBreakEnd: breakEnd ?? null,
        actualBreakReturn: actualBreakReturn ?? null,
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

export const findLateByBranchAndDay = (data, _holidays, _timeOffs, includeLunchLate = false) => {
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
      const {
        firstEntry,
        events,
        shiftType,
        scheduleStart,
        late,
        breakReturnLate,
        breakEnd,
        actualBreakReturn,
        timeOff,
      } = session;

      if (!firstEntry || !scheduleStart || shiftType === "flexible") return;

      const lateMinutes = parseHHMM(late);
      const breakReturnLateMinutes = parseHHMM(breakReturnLate);

      if (includeLunchLate) {
        if (lateMinutes <= 0 && breakReturnLateMinutes <= 0) return;
      } else {
        if (lateMinutes <= 0) return;
      }

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
        breakReturnLateMinutes,
        scheduledBreakEnd: breakEnd ?? null,
        actualBreakReturn: actualBreakReturn ?? null,
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
