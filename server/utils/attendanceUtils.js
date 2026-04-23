export function processEvents() {}

// ── Utilities ──────────────────────────────────────────────────────────────────

/** Сдвигает UTC-дату на +5 часов (Ташкент) */
function toUTCPlus5(date) {
  return new Date(new Date(date).getTime() + 5 * 60 * 60 * 1000);
}

/**
 * Парсит дату события (ISO-строка или Date объект) → локальное время UTC+5.
 * Заменяет старую parseCustomDate, которая ожидала "DD.MM.YYYY, HH:MM:SS".
 */
function parseEventDate(dateInput) {
  if (!dateInput) return null;
  const utc = new Date(dateInput);
  if (isNaN(utc)) return null;
  return toUTCPlus5(utc);
}

function formatTime(date) {
  if (!date) return null;
  return [date.getUTCHours(), date.getUTCMinutes()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function dateToYMD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDurationFromSeconds(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function lateStringToMinutes(lateStr) {
  if (!lateStr) return 0;
  const [h, m] = lateStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToLateString(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// ── Schedule helpers ───────────────────────────────────────────────────────────

function getScheduleForDate(date, history = []) {
  const targetYMD = dateToYMD(date);

  const sorted = [...history].sort(
    (a, b) => new Date(a.date_from) - new Date(b.date_from),
  );

  const record = sorted.find((h) => {
    const fromYMD = dateToYMD(toUTCPlus5(new Date(h.date_from)));
    const toYMD = h.date_to ? dateToYMD(toUTCPlus5(new Date(h.date_to))) : null;
    return toYMD
      ? targetYMD >= fromYMD && targetYMD <= toYMD
      : targetYMD >= fromYMD;
  });

  return record?.workSchedule || null;
}

/** Возвращает плановые секунды работы для конкретной даты (с учётом перерыва) */
function getScheduledSecondsForDate(date, workSchedule) {
  const schedule = getScheduleForDate(date, workSchedule);
  if (!schedule) return 0;

  let shift = null;

  if (schedule.type === "fixed" || schedule.type === "remote") {
    const jsDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    shift = schedule.work_days?.find((d) => d.day === jsDay);
  } else if (schedule.type === "shift") {
    shift = schedule.shifts?.[0];
  }

  if (!shift?.start || !shift?.end) return 0;

  const startMins = timeToMinutes(shift.start);
  const endMins = timeToMinutes(shift.end);
  const breakMins = shift.break_minutes || 0;
  const durationMins =
    endMins > startMins ? endMins - startMins : endMins + 24 * 60 - startMins;

  return Math.max(0, durationMins - breakMins) * 60;
}

/**
 * Вычисляет количество минут перерыва по break_start/break_end.
 * Если они не заданы — возвращает fallback (break_minutes).
 */
function resolveBreakMinutes(shift) {
  if (shift?.break_start && shift?.break_end) {
    return Math.max(
      0,
      timeToMinutes(shift.break_end) - timeToMinutes(shift.break_start),
    );
  }
  return shift?.break_minutes || 0;
}

/**
 * Вычисляет пересечение (в минутах) рабочей сессии и плановго перерыва.
 * Оба интервала выражены в минутах от полуночи.
 * Возвращает 0, если пересечения нет.
 *
 * Пример: сессия 09:27–12:02 (567–722) ∩ перерыв 12:00–13:00 (720–780) = 2 мин.
 *
 * @param {number} workStartMins  - Начало сессии, минуты от полуночи
 * @param {number} workEndMins    - Конец сессии, минуты от полуночи
 * @param {number} breakStartMins - Начало перерыва, минуты от полуночи
 * @param {number} breakEndMins   - Конец перерыва, минуты от полуночи
 * @returns {number} Продолжительность пересечения в минутах
 */
export function calcBreakOverlap(
  workStartMins,
  workEndMins,
  breakStartMins,
  breakEndMins,
) {
  const overlapStart = Math.max(workStartMins, breakStartMins);
  const overlapEnd = Math.min(workEndMins, breakEndMins);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Определяет опоздание после перерыва.
 *
 * "Anchor" rule: если сотрудник отсутствовал во время обеденного окна
 * [break_start, break_end], крайний срок возврата = break_end (13:00).
 *
 * Поиск «обеденного выхода»: первый exit-event, при котором поездка
 * [exit, return] пересекается с окном [breakStart, breakEnd]:
 *   - exit < breakEnd   (вышел до окончания обеда)
 *   - return > breakStart (вернулся после начала обеда → пересечение есть)
 *
 * Пример A (баг): выход 11:46, возврат 13:38 → опоздание 38 мин.
 * Пример B (не обед): выход 14:00, возврат 15:00 → 0 мин (exit ≥ breakEnd).
 */
function detectBreakReturnLate(events, breakStart, breakEnd) {
  if (!breakStart || !breakEnd) return { lateMinutes: 0, actualReturn: null };

  const breakStartMins = timeToMinutes(breakStart);
  const breakEndMins = timeToMinutes(breakEnd);

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.direction !== "exit") continue;

    const exitMins =
      e.parsedDate.getUTCHours() * 60 + e.parsedDate.getUTCMinutes();

    // Exit must be before lunch ends; otherwise it's a post-lunch trip
    if (exitMins >= breakEndMins) continue;

    const returnEntry = events
      .slice(i + 1)
      .find((ev) => ev.direction === "entry");
    if (!returnEntry) continue;

    const returnMins =
      returnEntry.parsedDate.getUTCHours() * 60 +
      returnEntry.parsedDate.getUTCMinutes();

    // Trip must overlap with lunch window: return > breakStart
    // (if returned before lunch even started → not a lunch trip, keep searching)
    if (returnMins <= breakStartMins) continue;

    // Found the lunch trip — anchor deadline is breakEnd
    const lateMinutes = Math.max(0, returnMins - breakEndMins);
    const actualReturn = formatTime(returnEntry.parsedDate);
    return { lateMinutes, actualReturn };
  }

  return { lateMinutes: 0, actualReturn: null };
}

// ── Shift determination ────────────────────────────────────────────────────────

/** Определяет смену по времени события через зоны вокруг midpoint-ов между сменами */
function determineShiftForEvent(eventDate, shifts) {
  if (!eventDate || !shifts.length) return null;
  if (shifts.length === 1) return shifts[0];

  const minutes = eventDate.getUTCHours() * 60 + eventDate.getUTCMinutes();
  const TOTAL = 24 * 60;

  const sorted = [...shifts].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start),
  );

  const zones = sorted.map((shift, i) => {
    const prevShift = sorted[(i - 1 + sorted.length) % sorted.length];
    const curr = timeToMinutes(shift.start);
    const prev = timeToMinutes(prevShift.start);
    const gap = (curr - prev + TOTAL) % TOTAL;
    const midpoint = (prev + Math.floor(gap / 2)) % TOTAL;
    return { shift, zoneStart: midpoint };
  });

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

// ── Work duration calculation ──────────────────────────────────────────────────

/**
 * Вычисляет суммарное отработанное время по парам entry/exit.
 * Игнорирует пары с нулевым/отрицательным интервалом.
 * Пропускает повторные exit, если пауза между ними меньше MAX_GAP.
 */
function calculateWorkDuration(events, MAX_GAP) {
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
        // Двойной вход: сдвигаем точку отсчёта если пауза большая
        const gap = (event.parsedDate - currentEntry.parsedDate) / 1000;
        if (gap > MAX_GAP) currentEntry = event;
      }
      return;
    }

    if (event.direction === "exit") {
      if (!isInside || !currentEntry) return;

      const diff = (event.parsedDate - currentEntry.parsedDate) / 1000;
      if (diff <= 0) {
        isInside = false;
        currentEntry = null;
        return;
      }

      // Пропускаем повторный exit если он слишком близко к предыдущему
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

/**
 * Считает количество рабочих дней по графику в диапазоне [fromDate, toDate].
 * Используется для вычисления плановых дней на сервере.
 */
export function countScheduledDays(fromDate, toDate, workSchedule) {
  if (!workSchedule?.length) return 0;

  const from = toUTCPlus5(new Date(fromDate));
  const to = toUTCPlus5(new Date(toDate));

  // Нормализуем до начала дня (только год/месяц/день в UTC-координатах UTC+5)
  const fromDay = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const toDay = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );

  let count = 0;
  for (
    let d = new Date(fromDay);
    d <= toDay;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    // Сдвигаем на +5ч чтобы getUTCDay() вернул правильный день недели в UTC+5
    const dateUTC5 = toUTCPlus5(d);
    if (getScheduledSecondsForDate(dateUTC5, workSchedule) > 0) count++;
  }
  return count;
}

/**
 * Считает суммарные плановые минуты работы по графику в диапазоне [fromDate, toDate].
 * Используется для вычисления нормы часов за месяц.
 */
export function countScheduledMinutes(fromDate, toDate, workSchedule) {
  if (!workSchedule?.length) return 0;

  const from = toUTCPlus5(new Date(fromDate));
  const to = toUTCPlus5(new Date(toDate));

  const fromDay = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const toDay = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );

  let totalSeconds = 0;
  for (
    let d = new Date(fromDay);
    d <= toDay;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const dateUTC5 = toUTCPlus5(d);
    totalSeconds += getScheduledSecondsForDate(dateUTC5, workSchedule);
  }
  return Math.round(totalSeconds / 60);
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function generateAttendanceReport(attendanceData, timeOffs, yearMonth) {
  const MAX_GAP = 15 * 60; // 15 минут

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
        pinfl: data.pinfl,
        workScheduleName: undefined,
        totalWorkedDays: 0,
        totalWorkedHours: "00:00",
        totalLateCount: 0,
        totalLateTime: "00:00",
        totalOvertimeMinutes: 0,
        totalScheduledMinutes: 0,
        sessions: {},
      };
    }

    /** Возвращает все timeoff-записи, покрывающие дату */
    function getTimeOffsForDate(date) {
      const ymd = dateToYMD(date);
      return employeeTimeOffs.filter((to) => {
        const fromYMD = dateToYMD(toUTCPlus5(to.date_from));
        const toYMD = dateToYMD(toUTCPlus5(to.date_to));
        return ymd >= fromYMD && ymd <= toYMD;
      });
    }

    // Парсим и сортируем события: UTC → UTC+5
    const sortedEvents = (data.events || [])
      .filter((e) => e.date)
      .map((e) => ({ ...e, parsedDate: parseEventDate(e.date) }))
      .filter((e) => e.parsedDate)
      .sort((a, b) => a.parsedDate - b.parsedDate);

    const sessionsMap = {};

    // ── Шаг 1: группировка событий по календарному дню ────────────────────────
    const eventsByDay = {};
    sortedEvents.forEach((e) => {
      const dayKey = dateToYMD(e.parsedDate);
      if (!eventsByDay[dayKey]) eventsByDay[dayKey] = [];
      eventsByDay[dayKey].push(e);
    });

    // ── Шаг 2: перенос exit-событий ночной смены в день начала смены ──────────
    Object.keys(eventsByDay)
      .sort()
      .forEach((dayKey) => {
        const dailyEvents = eventsByDay[dayKey];
        if (!dailyEvents?.length) return;

        const scheduleForDay = getScheduleForDate(
          dailyEvents[0].parsedDate,
          data.workSchedule,
        );
        if (scheduleForDay?.type !== "shift") return;

        const firstEntry = dailyEvents.find((e) => e.direction === "entry");
        if (!firstEntry) return;

        const shift = determineShiftForEvent(
          firstEntry.parsedDate,
          scheduleForDay.shifts || [],
        );
        if (!shift) return;

        const isNightShift =
          timeToMinutes(shift.end) < timeToMinutes(shift.start);
        if (!isNightShift) return;

        const nextDate = new Date(dailyEvents[0].parsedDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDayKey = dateToYMD(nextDate);
        if (!eventsByDay[nextDayKey]) return;

        // Сессия должна оставаться открытой на конец дня
        let isOpen = false;
        for (const e of dailyEvents) {
          if (e.direction === "entry") isOpen = true;
          if (e.direction === "exit") isOpen = false;
        }
        if (!isOpen) return;

        const shiftEndMins = timeToMinutes(shift.end);
        const toMove = [];
        const toKeep = [];
        let sessionClosed = false;

        eventsByDay[nextDayKey].forEach((e) => {
          const mins =
            e.parsedDate.getUTCHours() * 60 + e.parsedDate.getUTCMinutes();
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

        const dayTimeOffs = getTimeOffsForDate(date);

        // hour-тип: разрешённое опоздание
        let permittedLateMinutes = 0;
        let companyPaidHourSeconds = 0;
        dayTimeOffs
          .filter((to) => to.type === "hour")
          .forEach((to) => {
            const durationMinutes = Math.round(
              (toUTCPlus5(to.date_to) - toUTCPlus5(to.date_from)) / 60000,
            );
            permittedLateMinutes += durationMinutes;
            if (to.is_company_paid)
              companyPaidHourSeconds += durationMinutes * 60;
          });

        const dayOffRecord = dayTimeOffs.find(
          (to) => to.type === "day_off" || to.type === "vacation",
        );

        let scheduleStart = null;
        let scheduleEnd = null;
        let determinedShift = null;
        let breakMinutes = 0;
        let breakStart = null;
        let breakEnd = null;

        // Допустимые окна из графика (минуты)
        const lateTolerance = scheduleForDay?.late_tolerance_minutes || 0;
        const earlyLeaveTolerance =
          scheduleForDay?.early_leave_tolerance_minutes || 0;
        const lateLeaveTolerance =
          scheduleForDay?.late_leave_tolerance_minutes || 0;

        if (scheduleType === "fixed" || scheduleType === "remote") {
          const jsDay = date.getDay() === 0 ? 7 : date.getDay();
          const workDay = scheduleForDay.work_days?.find(
            (d) => d.day === jsDay,
          );
          if (workDay) {
            scheduleStart = workDay.start;
            scheduleEnd = workDay.end;
            breakStart = workDay.break_start || null;
            breakEnd = workDay.break_end || null;
            breakMinutes = resolveBreakMinutes(workDay);
          }
        } else if (scheduleType === "shift") {
          determinedShift = determineShiftForEvent(
            dailyEvents.find((e) => e.direction === "entry")?.parsedDate,
            scheduleForDay.shifts || [],
          );
          if (determinedShift) {
            scheduleStart = determinedShift.start;
            scheduleEnd = determinedShift.end;
            breakStart = determinedShift.break_start || null;
            breakEnd = determinedShift.break_end || null;
            breakMinutes = resolveBreakMinutes(determinedShift);
          }
        }

        // Lunch anchor fallback: schedules that only have break_minutes (no explicit
        // break_start/break_end) get the standard 12:00–13:00 window as anchor.
        // Applied only for day shifts (schedule start strictly before 12:00).
        if (!breakStart && !breakEnd && breakMinutes > 0 && scheduleStart) {
          if (timeToMinutes(scheduleStart) < 720) {
            breakStart = "12:00";
            breakEnd = "13:00";
          }
        }

        const result = calculateWorkDuration(dailyEvents, MAX_GAP);
        const hasPair = result.lastExitEvent !== null;

        const firstEntryTime = hasPair
          ? result.firstEntryEvent?.parsedDate
          : dailyEvents[0]?.direction === "entry"
            ? dailyEvents[0].parsedDate
            : null;

        const lastExitTime = hasPair
          ? result.lastExitEvent?.parsedDate
          : dailyEvents.at(-1)?.direction === "exit"
            ? dailyEvents.at(-1).parsedDate
            : null;

        // Вычитаем только реальное пересечение сессии с окном перерыва.
        // Если break_start/break_end заданы — считаем точное перекрытие [entry, exit] ∩ [break_start, break_end].
        // Иначе — откатываемся к полному break_minutes (старое поведение).
        let effectiveBreakMins = breakMinutes;
        if (breakStart && breakEnd && firstEntryTime && lastExitTime) {
          const workStartMins =
            firstEntryTime.getUTCHours() * 60 + firstEntryTime.getUTCMinutes();
          const workEndMins =
            lastExitTime.getUTCHours() * 60 + lastExitTime.getUTCMinutes();
          effectiveBreakMins = calcBreakOverlap(
            workStartMins,
            workEndMins,
            timeToMinutes(breakStart),
            timeToMinutes(breakEnd),
          );
        }
        let netSeconds = Math.max(
          0,
          result.totalSeconds - effectiveBreakMins * 60,
        );
        netSeconds += companyPaidHourSeconds;

        // Опоздание
        let late = null;
        if (scheduleStart && result.firstEntryEvent) {
          const entryMins =
            result.firstEntryEvent.parsedDate.getUTCHours() * 60 +
            result.firstEntryEvent.parsedDate.getUTCMinutes();
          const rawDiff = Math.max(0, entryMins - timeToMinutes(scheduleStart));
          late = minutesToLateString(
            Math.max(0, rawDiff - permittedLateMinutes - lateTolerance),
          );
        }

        // Ранний уход / Поздний уход
        let earlyLeave = null;
        let lateLeave = null;
        if (scheduleEnd && result.lastExitEvent) {
          const scheduleStartMins = scheduleStart
            ? timeToMinutes(scheduleStart)
            : 0;
          let endMins = timeToMinutes(scheduleEnd);
          let exitMins =
            result.lastExitEvent.parsedDate.getUTCHours() * 60 +
            result.lastExitEvent.parsedDate.getUTCMinutes();

          if (endMins < scheduleStartMins) endMins += 24 * 60;
          if (exitMins < scheduleStartMins) exitMins += 24 * 60;

          earlyLeave = minutesToLateString(
            Math.max(0, endMins - exitMins - earlyLeaveTolerance),
          );
          lateLeave = minutesToLateString(
            Math.max(0, exitMins - endMins - lateLeaveTolerance),
          );
        }

        // Опоздание после перерыва
        const breakResult = detectBreakReturnLate(
          dailyEvents,
          breakStart,
          breakEnd,
        );
        const breakReturnLate = minutesToLateString(breakResult.lateMinutes);
        const actualBreakReturn = breakResult.actualReturn;

        sessionsMap[dayKey] = {
          firstEntry: formatTime(firstEntryTime),
          lastExit: formatTime(lastExitTime),
          workDuration: formatDurationFromSeconds(netSeconds),
          breakMinutes,
          breakStart,
          breakEnd,
          shiftType: scheduleType,
          scheduleStart,
          scheduleEnd,
          determinedShift: determinedShift?.shift_number || null,
          late,
          earlyLeave,
          lateLeave,
          breakReturnLate,
          actualBreakReturn,
          events: dailyEvents,
          hadAttendance:
            netSeconds > 0 || firstEntryTime !== null || lastExitTime !== null,
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

    // ── Шаг 4: плановые часы за оплачиваемые vacation/day_off ─────────────────
    employeeTimeOffs
      .filter((to) => to.is_company_paid)
      .forEach((to) => {
        const fromDate = toUTCPlus5(to.date_from);
        const toDate = toUTCPlus5(to.date_to);
        const timeOffEntry = {
          id: to.id,
          date_from: to.date_from,
          date_to: to.date_to,
          type: to.type,
          reason: to.reason,
          isCompanyPaid: to.is_company_paid,
        };

        for (
          let d = new Date(fromDate);
          d <= toDate;
          d.setDate(d.getDate() + 1)
        ) {
          const currentDate = new Date(d);
          const dayKey = dateToYMD(currentDate);
          const scheduledSecs = getScheduledSecondsForDate(
            currentDate,
            data.workSchedule,
          );

          if (sessionsMap[dayKey]) {
            // День уже есть: проставляем флаг и плановые часы
            if (!sessionsMap[dayKey].timeOff) {
              sessionsMap[dayKey].timeOff = timeOffEntry;
            }
            sessionsMap[dayKey].workDuration =
              formatDurationFromSeconds(scheduledSecs);
          } else {
            // Нет событий — создаём пустую сессию
            if (scheduledSecs === 0) return; // нерабочий день по графику

            const scheduleForDay = getScheduleForDate(
              currentDate,
              data.workSchedule,
            );
            const scheduleType = scheduleForDay?.type || null;
            let scheduleStart = null;
            let scheduleEnd = null;

            if (scheduleType === "fixed" || scheduleType === "remote") {
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
              workDuration: formatDurationFromSeconds(scheduledSecs),
              breakMinutes: 0,
              shiftType: scheduleType,
              scheduleStart,
              scheduleEnd,
              determinedShift: null,
              late: null,
              earlyLeave: null,
              events: [],
              hadAttendance: false,
              timeOff: timeOffEntry,
            };
          }
        }
      });

    // ── Шаг 5: фильтрация по месяцу ───────────────────────────────────────────
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
    let totalWorkedSeconds = 0;
    let totalOvertimeSeconds = 0;

    Object.values(finalSessions).forEach((s) => {
      const [h, m] = s.workDuration.split(":").map(Number);
      totalWorkedSeconds += h * 3600 + m * 60;

      const lateMinutes = lateStringToMinutes(s.late);
      if (lateMinutes > 0) {
        totalLateCount++;
        totalLateSeconds += lateMinutes * 60;
      }

      const overtimeMinutes = lateStringToMinutes(s.lateLeave || "00:00");
      totalOvertimeSeconds += overtimeMinutes * 60;
    });

    const totalWorkedDays = Object.values(finalSessions).filter(
      (s) => s.hadAttendance || s.workDuration !== "00:00",
    ).length;

    // Плановые минуты за месяц по графику
    let totalScheduledMinutes = 0;
    if (yearMonth && hasWorkSchedule) {
      const [yr, mo] = yearMonth.split("-").map(Number);
      const fromDate = new Date(Date.UTC(yr, mo - 1, 1));
      const toDate = new Date(Date.UTC(yr, mo, 0));
      totalScheduledMinutes = countScheduledMinutes(
        fromDate,
        toDate,
        data.workSchedule,
      );
    }

    return {
      employeeId: data.employeeId.toString(),
      employeeNumber: data.employeeNumber,
      employeeFullName: data.employeeFullName,
      employeePhoto: data.employeePhoto || null,
      branchName: data.branchName,
      departmentName: data.departmentName,
      positionName: data.positionName,
      pinfl: data.pinfl,
      workScheduleName: data.workScheduleName,
      totalWorkedDays,
      totalWorkedHours: formatDurationFromSeconds(totalWorkedSeconds),
      totalLateCount,
      totalLateTime: formatDurationFromSeconds(totalLateSeconds),
      totalOvertimeMinutes: Math.round(totalOvertimeSeconds / 60),
      totalScheduledMinutes,
      sessions: finalSessions,
    };
  });
}
