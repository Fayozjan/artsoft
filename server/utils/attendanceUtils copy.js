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

function getScheduleForDate(date, history = []) {
  const targetYMD = dateToYMD(date);

  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.date_from) - new Date(b.date_from),
  );

  const record = sortedHistory.find((h) => {
    const from = new Date(h.date_from);
    const to = h.date_to ? new Date(h.date_to) : null;
    const fromYMD = dateToYMD(from);
    const toYMD = to ? dateToYMD(to) : null;

    if (toYMD) return targetYMD >= fromYMD && targetYMD <= toYMD;
    return targetYMD >= fromYMD;
  });

  return record?.workSchedule || null;
}

function determineShiftForEvent(eventDate, shifts) {
  if (!eventDate) return null;
  const minutes = eventDate.getHours() * 60 + eventDate.getMinutes();
  const EARLY_TOLERANCE = 60; // допуск раннего прихода (минут до начала смены)

  const dayShifts = shifts.filter(
    (s) => timeToMinutes(s.end) >= timeToMinutes(s.start),
  );
  const nightShifts = shifts.filter(
    (s) => timeToMinutes(s.end) < timeToMinutes(s.start),
  );

  // 1. Точное попадание в дневную смену
  const exactDay = dayShifts.find((shift) => {
    const start = timeToMinutes(shift.start);
    const end = timeToMinutes(shift.end);
    return minutes >= start && minutes <= end;
  });
  if (exactDay) return exactDay;

  // 2. Ранний приход на дневную смену (в пределах EARLY_TOLERANCE до начала)
  const earlyDay = dayShifts.find((shift) => {
    const start = timeToMinutes(shift.start);
    return minutes >= start - EARLY_TOLERANCE && minutes < start;
  });
  if (earlyDay) return earlyDay;

  // 3. Ночная смена (основное окно >= start или хвост <= end)
  return (
    nightShifts.find((shift) => {
      const start = timeToMinutes(shift.start);
      const end = timeToMinutes(shift.end);
      return minutes >= start || minutes <= end;
    }) || null
  );
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

export function generateAttendanceReport(attendanceData, timeOffs) {
  const MAX_GAP_BETWEEN_EVENTS = 15 * 60;

  return attendanceData.map((data) => {
    const sortedEvents = (data.events || [])
      .filter((e) => e.date)
      .map((e) => ({ ...e, parsedDate: parseCustomDate(e.date) }))
      .sort((a, b) => a.parsedDate - b.parsedDate);

    const sessionsMap = {};
    let totalSecondsWorked = 0;

    // ── Шаг 1: группировка по календарному дню ────────────────────────────────
    const eventsByDay = {};
    sortedEvents.forEach((e) => {
      const dayKey = e.parsedDate.getDate().toString();
      if (!eventsByDay[dayKey]) eventsByDay[dayKey] = [];
      eventsByDay[dayKey].push(e);
    });

    // ── Шаг 2: перенос событий ночной смены в «свой» день ────────────────────
    const sortedDayKeys = Object.keys(eventsByDay).sort(
      (a, b) => Number(a) - Number(b),
    );

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

      const nextDayKey = (Number(dayKey) + 1).toString();
      if (!eventsByDay[nextDayKey]) return;

      // Переносим только если текущий день заканчивается с открытой сессией
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
      .sort((a, b) => Number(a) - Number(b))
      .forEach((dayKey) => {
        const dailyEvents = eventsByDay[dayKey];
        const date = dailyEvents[0].parsedDate;
        const scheduleForDay = getScheduleForDate(date, data.workSchedule);
        const scheduleType = scheduleForDay?.type || null;

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

        // Вычитаем перерыв из фактически отработанного времени
        const breakSeconds = breakMinutes * 60;
        const netSeconds = Math.max(0, result.totalSeconds - breakSeconds);

        totalSecondsWorked += netSeconds;

        // Опоздание и ранний уход
        let late = null;
        let earlyLeave = null;

        if (scheduleStart && result.firstEntryEvent) {
          const startMinutes = timeToMinutes(scheduleStart);
          const entryMinutes =
            result.firstEntryEvent.parsedDate.getHours() * 60 +
            result.firstEntryEvent.parsedDate.getMinutes();
          const diff = Math.max(0, entryMinutes - startMinutes);
          late = `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
        }

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
          earlyLeave = `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
        }

        sessionsMap[dayKey] = {
          firstEntry: result.firstEntryEvent
            ? formatTime(result.firstEntryEvent.parsedDate)
            : null,
          lastExit: result.lastExitEvent
            ? formatTime(result.lastExitEvent.parsedDate)
            : null,
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
        };
      });

    const workedDaysCount = Object.values(sessionsMap).filter(
      (s) => s.workDuration !== "00:00",
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
      totalWorkedHours: formatDurationFromSeconds(totalSecondsWorked),
      sessions: sessionsMap,
    };
  });
}
