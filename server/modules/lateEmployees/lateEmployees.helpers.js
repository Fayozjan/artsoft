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

/** Произвольный период: с начала дня date_from по конец дня date_to */
export function getPeriodRange(dateFrom, dateTo) {
  const from = DateTime.fromISO(String(dateFrom), { zone: "Asia/Tashkent" });
  const to = DateTime.fromISO(String(dateTo), { zone: "Asia/Tashkent" });

  if (!from.isValid || !to.isValid) throw new Error("Invalid date");
  if (to < from) throw new Error("date_to раньше date_from");

  return {
    startDate: from.startOf("day").toJSDate(),
    endDate: to.endOf("day").toJSDate(),
  };
}

/** Список "yyyy-MM", которые пересекает период — для сумм штрафов из payroll */
export function getMonthsInRange(dateFrom, dateTo) {
  const from = DateTime.fromISO(String(dateFrom), { zone: "Asia/Tashkent" });
  const to = DateTime.fromISO(String(dateTo), { zone: "Asia/Tashkent" });

  if (!from.isValid || !to.isValid) throw new Error("Invalid date");

  const months = [];
  let cursor = from.startOf("month");
  const last = to.startOf("month");
  while (cursor <= last) {
    months.push(cursor.toFormat("yyyy-MM"));
    cursor = cursor.plus({ months: 1 });
  }
  return months;
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

/**
 * "YYYY-MM" в таймзоне Ташкента. Ключи сессий строятся в UTC+5, поэтому брать
 * месяц через Date#getMonth() нельзя: на сервере в UTC начало месяца
 * (2026-08-01T00:00+05 = 2026-07-31T19:00Z) отдаст предыдущий месяц.
 */
export function getYearMonth(date) {
  const dt =
    typeof date === "string"
      ? DateTime.fromISO(date, { zone: "Asia/Tashkent" })
      : DateTime.fromJSDate(date, { zone: "Asia/Tashkent" });

  if (!dt.isValid) throw new Error("Invalid date");

  return dt.toFormat("yyyy-MM");
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

// range = { from: "YYYY-MM-DD", to: "YYYY-MM-DD" } — режим «за период»: сессии
// могут выходить за границы выборки на стыке суток, поэтому отсекаем по ключу дня
const isOutOfRange = (dayKey, range) =>
  range && (dayKey < range.from || dayKey > range.to);

// totalWorkedDays из отчёта считается по всем сессиям сотрудника (в режиме
// «за период» отчёт не режется по месяцу), поэтому для периода отработанные
// дни пересчитываем по сессиям внутри выбранного диапазона
const countAttendedDaysInRange = (sessions, range) =>
  Object.entries(sessions || {}).filter(
    ([dayKey, s]) =>
      !isOutOfRange(dayKey, range) &&
      (s?.hadAttendance || (s?.workDuration && s.workDuration !== "00:00")),
  ).length;

export const findLateEmployeesByMonth = (
  data,
  _calendar,
  _timeOffs,
  includeLunchLate = false,
  range = null,
) => {
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
      totalScheduledDays,
      totalWorkedDays,
    } = employee;

    if (!sessions) return;

    Object.entries(sessions).forEach(([dayKey, session]) => {
      if (isOutOfRange(dayKey, range)) return;

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
          // Плановые дни по графику и дни с отметкой — знаменатель для опозданий
          monthlyWorkDays: totalScheduledDays || 0,
          monthlyAttendedDays: range
            ? countAttendedDaysInRange(sessions, range)
            : totalWorkedDays || 0,
          // Фото с последнего опоздания — запасной аватар, если нет фото в анкете
          lastLatePhoto: null,
          monthlyArrivalLateCount: 0,
          monthlyLunchLateCount: 0,
          monthlyLateMinutes: 0,
          monthlyBreakReturnLateMinutes: 0,
          details: [],
        };
      }

      const target = grouped[employeeId];
      // Дни идут по возрастанию — последнее присвоение = самое свежее фото
      if (firstEntryEvent?.photo) target.lastLatePhoto = firstEntryEvent.photo;
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

export const findLateByBranchAndDay = (
  data,
  _calendar,
  _timeOffs,
  includeLunchLate = false,
  range = null,
) => {
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
      if (isOutOfRange(dayKey, range)) return;

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
