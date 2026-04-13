export function processEvents() {}

function parseCustomDate(dateStr) {
  if (!dateStr) return null;
  const [datePart, timePart] = dateStr.split(", ");
  const [day, month, year] = datePart.split(".").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function formatTime(date) {
  if (!date) return null;
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function dateToYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDurationFromSeconds(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
  ].join(":");
}

function lateStringToMinutes(lateStr) {
  if (!lateStr) return 0;
  const [h, m] = lateStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToLateString(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function toUTCPlus5(date) {
  return new Date(new Date(date).getTime() + 5 * 60 * 60 * 1000);
}

function getScheduleForDate(date, history = []) {
  const targetYMD = dateToYMD(date);

  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.date_from) - new Date(b.date_from),
  );

  const record = sortedHistory.find((h) => {
    const from = toUTCPlus5(new Date(h.date_from));

    const to = h.date_to ? toUTCPlus5(new Date(h.date_to)) : null; // ✅

    const fromYMD = dateToYMD(from);
    const toYMD = to ? dateToYMD(to) : null;

    if (toYMD) return targetYMD >= fromYMD && targetYMD <= toYMD;
    return targetYMD >= fromYMD;
  });

  return record?.workSchedule || null;
}

/*
function determineShiftForEvent(eventDate, shifts) {
  if (!eventDate) return null;
  const minutes = eventDate.getHours() * 60 + eventDate.getMinutes();
  const EARLY_TOLERANCE = 60;

  const dayShifts = shifts.filter(
    (s) => timeToMinutes(s.end) >= timeToMinutes(s.start),
  );
  const nightShifts = shifts.filter(
    (s) => timeToMinutes(s.end) < timeToMinutes(s.start),
  );

  const exactDay = dayShifts.find((shift) => {
    const start = timeToMinutes(shift.start);
    const end = timeToMinutes(shift.end);
    return minutes >= start && minutes <= end;
  });
  if (exactDay) return exactDay;

  const earlyDay = dayShifts.find((shift) => {
    const start = timeToMinutes(shift.start);
    return minutes >= start - EARLY_TOLERANCE && minutes < start;
  });
  if (earlyDay) return earlyDay;

  return (
    nightShifts.find((shift) => {
      const start = timeToMinutes(shift.start);
      const end = timeToMinutes(shift.end);
      return minutes >= start || minutes <= end;
    }) || null
  );
}

function determineShiftForEvent(eventDate, shifts) {
  if (!eventDate) return null;
  const minutes = eventDate.getHours() * 60 + eventDate.getMinutes();
  const EARLY_TOLERANCE = 60;

  const dayShifts = shifts.filter(
    (s) => timeToMinutes(s.end) >= timeToMinutes(s.start),
  );
  const nightShifts = shifts.filter(
    (s) => timeToMinutes(s.end) < timeToMinutes(s.start),
  );

  // ✅ Сначала проверяем ранний приход — приоритет выше точного попадания
  const earlyDay = dayShifts.find((shift) => {
    const start = timeToMinutes(shift.start);
    return minutes >= start - EARLY_TOLERANCE && minutes < start;
  });
  if (earlyDay) return earlyDay;

  // Потом точное попадание в дневную смену
  const exactDay = dayShifts.find((shift) => {
    const start = timeToMinutes(shift.start);
    const end = timeToMinutes(shift.end);
    return minutes >= start && minutes <= end;
  });
  if (exactDay) return exactDay;

  // Ночная смена
  return (
    nightShifts.find((shift) => {
      const start = timeToMinutes(shift.start);
      const end = timeToMinutes(shift.end);
      return minutes >= start || minutes <= end;
    }) || null
  );
}*/

// function determineShiftForEvent(eventDate, shifts) {
//   if (!eventDate) return null;
//   const minutes = eventDate.getHours() * 60 + eventDate.getMinutes();
//   const EARLY_TOLERANCE = 90; // минут до начала смены

//   const dayShifts = shifts.filter(
//     (s) => timeToMinutes(s.end) >= timeToMinutes(s.start),
//   );
//   const nightShifts = shifts.filter(
//     (s) => timeToMinutes(s.end) < timeToMinutes(s.start),
//   );

//   // ✅ Ранний приход — проверяем ВСЕ смены (и дневные, и ночные)
//   const earlyCandidate = shifts
//     .map((shift) => {
//       const start = timeToMinutes(shift.start);
//       const diff = start - minutes; // положительное = сколько минут до начала
//       if (diff > 0 && diff <= EARLY_TOLERANCE) {
//         return { shift, diff };
//       }
//       return null;
//     })
//     .filter(Boolean)
//     .sort((a, b) => a.diff - b.diff)[0]; // ближайшая смена

//   if (earlyCandidate) return earlyCandidate.shift;

//   // Точное попадание в дневную смену
//   const exactDay = dayShifts.find((shift) => {
//     const start = timeToMinutes(shift.start);
//     const end = timeToMinutes(shift.end);
//     return minutes >= start && minutes <= end;
//   });
//   if (exactDay) return exactDay;

//   // Ночная смена
//   return (
//     nightShifts.find((shift) => {
//       const start = timeToMinutes(shift.start);
//       const end = timeToMinutes(shift.end);
//       return minutes >= start || minutes <= end;
//     }) || null
//   );
// }

function determineShiftForEvent(eventDate, shifts) {
  if (!eventDate || !shifts.length) return null;
  const minutes = eventDate.getHours() * 60 + eventDate.getMinutes();
  const TOTAL = 24 * 60;

  if (shifts.length === 1) return shifts[0];

  // Сортируем по старту
  const sorted = [...shifts].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start),
  );

  // Для каждой смены находим midpoint с предыдущей
  const zones = sorted.map((shift, i) => {
    const prevShift = sorted[(i - 1 + sorted.length) % sorted.length];
    const curr = timeToMinutes(shift.start);
    const prev = timeToMinutes(prevShift.start);

    // Midpoint по кругу
    let gap = (curr - prev + TOTAL) % TOTAL;
    const midpoint = (prev + Math.floor(gap / 2)) % TOTAL;

    return { shift, zoneStart: midpoint };
  });

  // Находим зону для текущего времени
  // (последняя зона, чей zoneStart <= minutes по кругу)
  for (let i = zones.length - 1; i >= 0; i--) {
    const curr = zones[i].zoneStart;
    const prev = zones[(i - 1 + zones.length) % zones.length].zoneStart;

    const inZone =
      prev <= curr
        ? minutes >= curr || minutes < prev
        : minutes >= curr && minutes < prev;

    if (inZone) return zones[i].shift;
  }

  return sorted[0].shift;
}

function calculateWorkDurationByShift(events, shiftStart, shiftEnd, MAX_GAP) {
  let totalSeconds = 0;
  let isInside = false;
  let currentEntry = null;
  let firstEntryEvent = null;
  let lastExitEvent = null;

  events.forEach((event, i) => {
    if (event.direction === "entry") {
      if (!isInside) {
        currentEntry = event;
        isInside = true;
        if (!firstEntryEvent) firstEntryEvent = event;
      } else {
        const gap = (event.parsedDate - currentEntry.parsedDate) / 1000;
        if (gap > MAX_GAP) currentEntry = event;
      }
    }

    if (event.direction === "exit") {
      if (!isInside || !currentEntry) return;

      let diff = (event.parsedDate - currentEntry.parsedDate) / 1000;
      if (diff <= 0) {
        isInside = false;
        currentEntry = null;
        return;
      }

      if (i > 0 && events[i - 1].direction === "exit") {
        const gap = (event.parsedDate - events[i - 1].parsedDate) / 1000;
        if (gap <= MAX_GAP) return;
      }

      totalSeconds += diff;
      lastExitEvent = event;
      isInside = false;
      currentEntry = null;
    }
  });

  return { totalSeconds, firstEntryEvent, lastExitEvent };
}

function getScheduledSecondsForDate(date, workSchedule) {
  const schedule = getScheduleForDate(date, workSchedule);
  if (!schedule) return 0;

  if (schedule.type === "fixed") {
    const jsDay = date.getDay() === 0 ? 7 : date.getDay();
    const workDay = schedule.work_days?.find((d) => d.day === jsDay);
    if (!workDay || !workDay.start || !workDay.end) return 0;

    const startMins = timeToMinutes(workDay.start);
    const endMins = timeToMinutes(workDay.end);
    const breakMins = workDay.break_minutes || 0;
    const durationMins =
      endMins > startMins ? endMins - startMins : endMins + 24 * 60 - startMins;

    return Math.max(0, durationMins - breakMins) * 60;
  }

  if (schedule.type === "shift") {
    const shift = schedule.shifts?.[0];
    if (!shift || !shift.start || !shift.end) return 0;

    const startMins = timeToMinutes(shift.start);
    const endMins = timeToMinutes(shift.end);
    const breakMins = shift.break_minutes || 0;
    const durationMins =
      endMins > startMins ? endMins - startMins : endMins + 24 * 60 - startMins;

    return Math.max(0, durationMins - breakMins) * 60;
  }

  return 0;
}

export function generateAttendanceReport(attendanceData, timeOffs, yearMonth) {
  const MAX_GAP_BETWEEN_EVENTS = 15 * 60;

  console.log("attendanceData", attendanceData);
  console.log("timeOffs", timeOffs);
  console.log("yearMonth", yearMonth);
  console.log("events", attendanceData[0]?.events);
  console.log("workSchedule", attendanceData[0]?.workSchedule);

  // Индексируем отгулы по employee_id
  const timeOffsByEmployee = {};
  (timeOffs?.data || []).forEach((to) => {
    const eid = to.employee_id.toString();
    if (!timeOffsByEmployee[eid]) timeOffsByEmployee[eid] = [];
    timeOffsByEmployee[eid].push(to);
  });

  return attendanceData.map((data) => {
    const employeeTimeOffs =
      timeOffsByEmployee[data.employeeId.toString()] || [];

    const hasWorkSchedule =
      Array.isArray(data.workSchedule) && data.workSchedule.length > 0;

    if (!hasWorkSchedule) {
      return {
        employeeId: data.employeeId.toString(),
        employeeNumber: data.employeeNumber,
        employeeFullName: data.employeeFullName,
        employeePhoto: data.employeePhoto || null,
        branchName: data.branchName,
        departmentName: data.departmentName,
        positionName: data.positionName,
        workScheduleName: undefined,
        totalWorkedDays: 0,
        totalWorkedHours: "00:00",
        totalLateCount: 0,
        totalLateTime: "00:00",
        sessions: {},
      };
    }

    /** Смещает UTC-дату на +5 часов (локальное время Ташкента) */
    function toUTCPlus5(date) {
      return new Date(new Date(date).getTime() + 5 * 60 * 60 * 1000);
    }

    /** Возвращает все timeoff-записи, покрывающие указанную дату (с учётом UTC+5) */
    function getTimeOffsForDate(date) {
      const ymd = dateToYMD(date);
      return employeeTimeOffs.filter((to) => {
        const fromYMD = dateToYMD(toUTCPlus5(to.date_from));
        const toYMD = dateToYMD(toUTCPlus5(to.date_to));
        return ymd >= fromYMD && ymd <= toYMD;
      });
    }

    const sortedEvents = (data.events || [])
      .filter((e) => e.date)
      .map((e) => ({ ...e, parsedDate: parseCustomDate(e.date) }))
      .sort((a, b) => a.parsedDate - b.parsedDate);

    const sessionsMap = {};
    let totalSecondsWorked = 0;

    // ── Шаг 1: группировка по календарному дню ────────────────────────────────
    const eventsByDay = {};
    sortedEvents.forEach((e) => {
      const dayKey = dateToYMD(e.parsedDate);
      if (!eventsByDay[dayKey]) eventsByDay[dayKey] = [];
      eventsByDay[dayKey].push(e);
    });

    // ── Шаг 2: перенос событий ночной смены в «свой» день ────────────────────
    const sortedDayKeys = Object.keys(eventsByDay).sort();

    sortedDayKeys.forEach((dayKey) => {
      const dailyEvents = eventsByDay[dayKey];
      if (!dailyEvents || dailyEvents.length === 0) return;

      const date = dailyEvents[0].parsedDate;
      const scheduleForDay = getScheduleForDate(date, data.workSchedule);
      if (scheduleForDay?.type !== "shift") return;

      const firstEntry = dailyEvents.find((e) => e.direction === "entry");
      if (!firstEntry) return;

      const shift = determineShiftForEvent(
        firstEntry.parsedDate,
        scheduleForDay.shifts || [],
      );
      if (!shift) return;

      const shiftStartMins = timeToMinutes(shift.start);
      const shiftEndMins = timeToMinutes(shift.end);
      const isNightShift = shiftEndMins < shiftStartMins;
      if (!isNightShift) return;

      const nextDate = new Date(dailyEvents[0].parsedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDayKey = dateToYMD(nextDate);

      if (!eventsByDay[nextDayKey]) return;

      let tempInside = false;
      for (const e of dailyEvents) {
        if (e.direction === "entry") tempInside = true;
        if (e.direction === "exit") tempInside = false;
      }
      if (!tempInside) return;

      const toMove = [];
      const toKeep = [];
      let sessionClosed = false;

      eventsByDay[nextDayKey].forEach((e) => {
        const mins = e.parsedDate.getHours() * 60 + e.parsedDate.getMinutes();
        if (!sessionClosed && mins <= shiftEndMins) {
          toMove.push(e);
          if (e.direction === "exit") sessionClosed = true;
        } else {
          toKeep.push(e);
        }
      });

      if (toMove.length > 0) {
        eventsByDay[dayKey] = [...dailyEvents, ...toMove].sort(
          (a, b) => a.parsedDate - b.parsedDate,
        );

        if (toKeep.length === 0) {
          delete eventsByDay[nextDayKey];
        } else {
          eventsByDay[nextDayKey] = toKeep;
        }
      }
    });

    // ── Шаг 3: обработка каждого дня ──────────────────────────────────────────
    Object.keys(eventsByDay)
      .sort()
      .forEach((dayKey) => {
        const dailyEvents = eventsByDay[dayKey];
        const date = dailyEvents[0].parsedDate;
        const scheduleForDay = getScheduleForDate(date, data.workSchedule);
        const scheduleType = scheduleForDay?.type || null;

        // Timeoff для этого дня
        const dayTimeOffs = getTimeOffsForDate(date);

        // hour-type отгулы: разрешённое опоздание
        const hourTimeOffs = dayTimeOffs.filter((to) => to.type === "hour");
        let permittedLateMinutes = 0;
        let companyPaidHourSeconds = 0;

        hourTimeOffs.forEach((to) => {
          const fromD = toUTCPlus5(to.date_from);
          const toD = toUTCPlus5(to.date_to);
          const durationMinutes = Math.round((toD - fromD) / 60000);
          permittedLateMinutes += durationMinutes;
          if (to.is_company_paid) {
            companyPaidHourSeconds += durationMinutes * 60;
          }
        });

        // vacation / day_off флаг
        const dayOffRecord = dayTimeOffs.find(
          (to) => to.type === "day_off" || to.type === "vacation",
        );

        let scheduleStart = null;
        let scheduleEnd = null;
        let determinedShift = null;
        let breakMinutes = 0;

        if (scheduleType === "fixed") {
          const jsDay = date.getDay() === 0 ? 7 : date.getDay();
          const workDay = scheduleForDay.work_days?.find(
            (d) => d.day === jsDay,
          );
          if (workDay) {
            scheduleStart = workDay.start;
            scheduleEnd = workDay.end;
            breakMinutes = workDay.break_minutes || 0;
          }
        }

        if (scheduleType === "shift") {
          determinedShift = determineShiftForEvent(
            dailyEvents.find((e) => e.direction === "entry")?.parsedDate,
            scheduleForDay.shifts || [],
          );
          if (determinedShift) {
            scheduleStart = determinedShift.start;
            scheduleEnd = determinedShift.end;
            breakMinutes = determinedShift.break_minutes || 0;
          }
        }

        if (scheduleType === "flexible") {
          scheduleStart = null;
          scheduleEnd = null;
        }

        const result = calculateWorkDurationByShift(
          dailyEvents,
          scheduleStart,
          scheduleEnd,
          MAX_GAP_BETWEEN_EVENTS,
        );

        const firstEvent = dailyEvents[0];
        const lastEvent = dailyEvents[dailyEvents.length - 1];

        const hasPair = result.lastExitEvent !== null;

        const firstEntry = hasPair
          ? result.firstEntryEvent?.parsedDate
          : firstEvent?.direction === "entry"
            ? firstEvent.parsedDate
            : null;

        const lastExit = hasPair
          ? result.lastExitEvent?.parsedDate
          : lastEvent?.direction === "exit"
            ? lastEvent.parsedDate
            : null;

        const breakSeconds = breakMinutes * 60;
        let netSeconds = Math.max(0, result.totalSeconds - breakSeconds);

        // Добавляем часы из оплачиваемых hour-отгулов
        netSeconds += companyPaidHourSeconds;
        totalSecondsWorked += netSeconds;

        // ── Опоздание ──────────────────────────────────────────────────────────
        let late = null;
        if (scheduleStart && result.firstEntryEvent) {
          const startMinutes = timeToMinutes(scheduleStart);
          const entryMinutes =
            result.firstEntryEvent.parsedDate.getHours() * 60 +
            result.firstEntryEvent.parsedDate.getMinutes();
          const rawDiff = Math.max(0, entryMinutes - startMinutes);

          // Вычитаем разрешённое время опоздания (hour-тип)
          const adjustedDiff = Math.max(0, rawDiff - permittedLateMinutes);
          late = minutesToLateString(adjustedDiff);
        }

        // ── Ранний уход ────────────────────────────────────────────────────────
        let earlyLeave = null;
        if (scheduleEnd && result.lastExitEvent) {
          let endMinutes = timeToMinutes(scheduleEnd);
          const scheduleStartMinutes = scheduleStart
            ? timeToMinutes(scheduleStart)
            : 0;
          const exitMinutes =
            result.lastExitEvent.parsedDate.getHours() * 60 +
            result.lastExitEvent.parsedDate.getMinutes();

          if (endMinutes < scheduleStartMinutes) endMinutes += 24 * 60;
          let actualExit = exitMinutes;
          if (exitMinutes < scheduleStartMinutes) actualExit += 24 * 60;

          const diff = Math.max(0, endMinutes - actualExit);
          earlyLeave = minutesToLateString(diff);
        }

        sessionsMap[dayKey] = {
          firstEntry: firstEntry ? formatTime(firstEntry) : null,
          lastExit: lastExit ? formatTime(lastExit) : null,
          workDuration:
            netSeconds > 0 ? formatDurationFromSeconds(netSeconds) : "00:00",
          breakMinutes,
          shiftType: scheduleType,
          scheduleStart,
          scheduleEnd,
          determinedShift: determinedShift?.shift_number || null,
          late,
          earlyLeave,
          events: dailyEvents,
          hadAttendance: dailyEvents.length > 0,
          // ── Флаг отгула/отпуска ──────────────────────────────────────────────
          timeOff: dayOffRecord
            ? {
                id: dayOffRecord.id,
                type: dayOffRecord.type,
                reason: dayOffRecord.reason,
                isCompanyPaid: dayOffRecord.is_company_paid,
              }
            : null,
        };
      });

    // ── Шаг 4: начисление часов за оплачиваемые vacation/day_off ──────────────
    // Обрабатываем дни, которых нет в sessionsMap (нет событий прохода)
    employeeTimeOffs
      .filter((to) => to.is_company_paid)
      .forEach((to) => {
        const fromDate = toUTCPlus5(to.date_from);
        const toDate = toUTCPlus5(to.date_to);

        for (
          let d = new Date(fromDate);
          d <= toDate;
          d.setDate(d.getDate() + 1)
        ) {
          const currentDate = new Date(d);
          const dayKey = dateToYMD(currentDate);

          if (sessionsMap[dayKey]) {
            // День уже есть в сессиях — только добавляем флаг, если ещё не стоит
            if (!sessionsMap[dayKey].timeOff) {
              sessionsMap[dayKey].timeOff = {
                id: to.id,
                date_from: to.date_from,
                date_to: to.date_to,
                type: to.type,
                reason: to.reason,
                isCompanyPaid: to.is_company_paid,
              };
            }
            // Добавляем плановые часы как отработанные
            const scheduledSecs = getScheduledSecondsForDate(
              currentDate,
              data.workSchedule,
            );
            sessionsMap[dayKey].workDuration =
              formatDurationFromSeconds(scheduledSecs);
            totalSecondsWorked += scheduledSecs;
          } else {
            // Создаём новую сессию без событий
            const scheduledSecs = getScheduledSecondsForDate(
              currentDate,
              data.workSchedule,
            );
            if (scheduledSecs > 0) {
              totalSecondsWorked += scheduledSecs;
            }

            const scheduleForDay = getScheduleForDate(
              currentDate,
              data.workSchedule,
            );
            const scheduleType = scheduleForDay?.type || null;

            let scheduleStart = null;
            let scheduleEnd = null;

            if (scheduleType === "fixed") {
              const jsDay =
                currentDate.getDay() === 0 ? 7 : currentDate.getDay();
              const workDay = scheduleForDay?.work_days?.find(
                (wd) => wd.day === jsDay,
              );

              if (!workDay) return;
              scheduleStart = workDay.start;
              scheduleEnd = workDay.end;
            }

            sessionsMap[dayKey] = {
              firstEntry: null,
              lastExit: null,
              workDuration:
                scheduledSecs > 0
                  ? formatDurationFromSeconds(scheduledSecs)
                  : "00:00",
              breakMinutes: 0,
              shiftType: scheduleType,
              scheduleStart,
              scheduleEnd,
              determinedShift: null,
              late: null,
              earlyLeave: null,
              events: [],
              hadAttendance: false,
              timeOff: {
                id: to.id,
                date_from: to.date_from,
                date_to: to.date_to,
                type: to.type,
                reason: to.reason,
                isCompanyPaid: to.is_company_paid,
              },
            };
          }
        }
      });

    // ── Шаг 5: фильтрация по месяцу (если передан) ────────────────────────────
    const finalSessions = yearMonth
      ? Object.fromEntries(
          Object.entries(sessionsMap).filter(([key]) =>
            key.startsWith(yearMonth),
          ),
        )
      : sessionsMap;

    // ── Шаг 6: итоговая статистика ────────────────────────────────────────────
    let totalLateCount = 0;
    let totalLateSeconds = 0;
    let filteredSecondsWorked = 0;

    Object.values(finalSessions).forEach((s) => {
      const [h, m] = s.workDuration.split(":").map(Number);
      filteredSecondsWorked += h * 3600 + m * 60;

      const lateMinutes = lateStringToMinutes(s.late);
      if (lateMinutes > 0) {
        totalLateCount++;
        totalLateSeconds += lateMinutes * 60;
      }
    });

    const workedDaysCount = Object.values(finalSessions).filter(
      (s) => s.hadAttendance || s.workDuration !== "00:00",
    ).length;

    return {
      employeeId: data.employeeId.toString(),
      employeeNumber: data.employeeNumber,
      employeeFullName: data.employeeFullName,
      employeePhoto: data.employeePhoto || null,
      branchName: data.branchName,
      departmentName: data.departmentName,
      positionName: data.positionName,
      workScheduleName: data.workScheduleName,
      totalWorkedDays: workedDaysCount,
      totalWorkedHours: formatDurationFromSeconds(filteredSecondsWorked),
      totalLateCount,
      totalLateTime: formatDurationFromSeconds(totalLateSeconds),
      sessions: finalSessions,
    };
  });
}
