import { DateTime } from "luxon";

// Кеши для ускорения (ключи — сериализованные строки)
const dateCache = new Map();
const shiftCache = new Map();

function parseEventTime(input) {
  if (!input) return null;

  // используем строковое представление ключа в кеше (чтобы не хранить объекты по ссылке)
  let key;
  if (DateTime.isDateTime(input)) {
    key = input.toISO();
  } else if (input instanceof Date) {
    key = input.toISOString();
  } else {
    key = String(input);
  }

  if (dateCache.has(key)) return dateCache.get(key);

  let dt;

  if (DateTime.isDateTime(input)) {
    dt = input;
  } else if (input instanceof Date) {
    dt = DateTime.fromJSDate(input);
  } else if (typeof input === "string" && input.includes("T")) {
    dt = DateTime.fromISO(input);
  } else if (typeof input === "string") {
    if (input.includes(".")) {
      dt = DateTime.fromFormat(input.trim(), "dd.MM.yyyy, HH:mm:ss");
      if (!dt.isValid) {
        dt = DateTime.fromFormat(input.trim(), "dd.MM.yyyy, HH:mm");
      }
    } else {
      dt = DateTime.fromFormat(input.trim(), "yyyy-MM-dd HH:mm:ss");
      if (!dt.isValid) {
        dt = DateTime.fromISO(input.trim());
      }
    }
  } else {
    dt = DateTime.invalid("unknown format");
  }

  dateCache.set(key, dt);
  return dt;
}

export function processEvents(employees = [], tripsMap = {}) {
  if (!Array.isArray(employees) || employees.length === 0) return [];

  const result = [];

  for (const employeeObj of employees) {
    const employeeId = employeeObj.employee_id;
    const workSchedule = employeeObj.work_schedule || {};

    // Пре-парсим даты событий и отфильтруем невалидные
    const rawEvents = (employeeObj.events || [])
      .map((e) => {
        const parsed = parseEventTime(e.date);
        return {
          ...e,
          _parsedDate: parsed,
          employee: employeeObj,
          employee_id: employeeId,
          event_type:
            e.direction === "entry"
              ? "entry"
              : e.direction === "start"
              ? "start"
              : "exit",
        };
      })
      .filter((e) => e._parsedDate && e._parsedDate.isValid);

    // Сортируем по времени (без риска NaN)
    rawEvents.sort(
      (a, b) => a._parsedDate.toMillis() - b._parsedDate.toMillis()
    );

    // создаём сессии
    const sessions = [];
    let currentSession = null;
    let currentEvents = [];

    for (const event of rawEvents) {
      const eventTime = event._parsedDate;
      if (!eventTime || !eventTime.isValid) continue;

      if (
        workSchedule.shift_type === "normal" ||
        workSchedule.shift_type === "flexible"
      ) {
        if (!currentSession || eventTime.toISODate() !== currentSession.date) {
          if (currentEvents.length > 0) {
            sessions.push(
              createSession(
                currentSession,
                currentEvents,
                tripsMap[employeeId] || []
              )
            );
          }
          currentSession = createNewSession(eventTime, event);
          currentEvents = [event];
        } else {
          currentEvents.push(event);
        }
        continue;
      }

      if (workSchedule.shift_type === "shift") {
        if (event.event_type === "entry") {
          if (
            !currentSession ||
            eventTime.toISODate() !== currentSession.date
          ) {
            if (currentEvents.length > 0) {
              sessions.push(
                createSession(
                  currentSession,
                  currentEvents,
                  tripsMap[employeeId] || []
                )
              );
            }

            currentSession = createNewSession(eventTime, event);
            currentEvents = [event];
          } else {
            currentEvents.push(event);
          }

          continue;
        }

        if (event.event_type === "exit") {
          if (!currentSession) continue;
          currentEvents.push(event);
          if (isSessionEnded(currentSession, eventTime, event.event_type)) {
            sessions.push(
              createSession(
                currentSession,
                currentEvents,
                tripsMap[employeeId] || []
              )
            );
            currentSession = null;
            currentEvents = [];
          }
          continue;
        }
      }
    }

    if (currentEvents.length > 0) {
      sessions.push(
        createSession(currentSession, currentEvents, tripsMap[employeeId] || [])
      );
    }

    const sessionsByDay = {};
    for (const s of sessions) {
      const day = Number(s.date.split("-")[2]);
      sessionsByDay[day] = {
        firstEntry: s.firstEntry,
        lastExit: s.lastExit,
        workDuration: s.workDuration,
        shiftType: s.shiftType,
        hasPermission:
          s.havePermission ?? s.events.some((e) => e.leave_request),
        events: s.events,
      };
    }

    let totalWorkedMinutes = 0;
    const totalWorkedDays = Object.keys(sessionsByDay).length;

    Object.values(sessionsByDay).forEach((s) => {
      if (s.workDuration) {
        const [h, m] = s.workDuration.split(":").map(Number);
        totalWorkedMinutes += h * 60 + m;
      }
    });

    const totalWorkedHours = `${String(
      Math.floor(totalWorkedMinutes / 60)
    ).padStart(2, "0")}:${String(totalWorkedMinutes % 60).padStart(2, "0")}`;

    result.push({
      employee_id: String(employeeId),
      employee_full_name: employeeObj.employee_full_name,
      employee_photo: employeeObj.employee_photo,
      branch_name: employeeObj.branch_name,
      department_name: employeeObj.department_name,
      position_name: employeeObj.position_name,
      work_schedule_name: workSchedule.name || null,
      work_schedule: workSchedule || null,
      totalWorkedDays,
      totalWorkedHours,
      sessions: sessionsByDay,
    });
  }

  return result;
}

// Функция для создания новой смены
function createNewSession(eventTime, event) {
  if (event.employee?.work_schedule?.shift_type === "shift") {
    return {
      type: "shift",
      date: eventTime.toISODate(),
      shiftType: getCachedShift(event),
      start: getShiftStartTime(eventTime, getCachedShift(event), event),
      end: getShiftEndTime(eventTime, getCachedShift(event), event),
    };
  } else {
    return {
      type: "normal",
      date: eventTime.toISODate(),
    };
  }
}

function isSessionEnded(session, eventTime, eventType) {
  if (session.type === "shift" && eventType === "exit") {
    return eventTime > session.end;
  }
  return eventTime.toISODate() !== session.date;
}

function addMinutesToDuration(durationStr, minutesToAdd = 0) {
  const [h = 0, m = 0] = (durationStr || "00:00").split(":").map(Number);
  let total = h * 60 + m + minutesToAdd;
  if (total < 0) total = 0;
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getCachedShift(event) {
  const key = `${event.employee_id}_${event.date}`;
  if (!shiftCache.has(key)) {
    shiftCache.set(key, determineShift(event._parsedDate, event));
  }
  return shiftCache.get(key);
}

function createSession(session, events, tripsForUser = []) {
  const currentDate =
    session && session.type === "normal"
      ? session.date
      : events[0]?._parsedDate
      ? events[0]._parsedDate.toISODate()
      : null;

  // Ищем командировку/отгул для этого дня
  const leaveRequest = tripsForUser.find((trip) => {
    const leaveStart = parseEventTime(trip.date_from);
    const leaveEnd = parseEventTime(trip.date_to);
    if (!leaveStart || !leaveEnd || !leaveStart.isValid || !leaveEnd.isValid)
      return false;
    return (
      currentDate >= leaveStart.toISODate() &&
      currentDate <= leaveEnd.toISODate()
    );
  });

  if (session && session.type === "normal") {
    const { firstEntry, lastExit, allEvents } = getNormalSessionEvents(events);

    const firstEntryTime = firstEntry ? firstEntry._parsedDate : null;
    const lastExitTime = lastExit ? lastExit._parsedDate : null;

    const base = {
      date: session.date,
      firstEntry: firstEntryTime?.toFormat("HH:mm") || null,
      lastExit: lastExitTime?.toFormat("HH:mm") || null,
      firstEntryPhoto: firstEntry?.event_photo || null,
      lastExitPhoto: lastExit?.event_photo || null,
      shiftType: "normal",
      workDuration:
        firstEntryTime && lastExitTime
          ? calculateWorkDuration(
              firstEntryTime,
              lastExitTime,
              events[0]?.employee?.work_schedule?.break_minutes
            )
          : "00:00",
      events: allEvents.map((e) => ({
        id: e.id,
        date: e.date,
        direction: e.direction,
        door_id: e.door_id,
        door_name: e.door_name,
        determinedShift: getCachedShift(e),
        event_photo: e.photo || null,
      })),
    };

    if (leaveRequest && leaveRequest.is_company_paid) {
      const leaveStart = parseEventTime(leaveRequest.date_from);
      const leaveEnd = parseEventTime(leaveRequest.date_to);

      let minutesToAdd = 0;

      if (leaveStart.hasSame(leaveEnd, "day")) {
        minutesToAdd = leaveEnd.diff(leaveStart, "minutes").minutes;
      } else {
        if (currentDate === leaveStart.toISODate()) {
          minutesToAdd = 24 * 60 - (leaveStart.hour * 60 + leaveStart.minute);
        } else if (currentDate === leaveEnd.toISODate()) {
          minutesToAdd = leaveEnd.hour * 60 + leaveEnd.minute;
        }
      }

      base.workDuration = addMinutesToDuration(
        base.workDuration,
        Math.round(minutesToAdd)
      );

      base.events.push({
        leave_request: {
          date_from: leaveStart.toFormat("dd.MM.yyyy HH:mm"),
          date_to: leaveEnd.toFormat("dd.MM.yyyy HH:mm"),
          description: leaveRequest.reason,
          permission_number: leaveRequest.permission_number,
          company_paid: leaveRequest.is_company_paid,
        },
      });
    }

    return base;
  }

  // Логика для смен (shift)
  const firstEntry = events.find(
    (e) => e.event_type === "entry" || e.event_type === "start"
  );
  const lastExit = [...events].reverse().find((e) => e.event_type === "exit");

  const firstEntryTime = firstEntry ? firstEntry._parsedDate : null;
  const lastExitTime = lastExit ? lastExit._parsedDate : null;

  const base = {
    date: currentDate,
    firstEntry: firstEntryTime?.toFormat("HH:mm") || null,
    lastExit: lastExitTime?.toFormat("HH:mm") || null,
    firstEntryPhoto: firstEntry?.event_photo || null,
    lastExitPhoto: lastExit?.event_photo || null,
    shiftType: session?.shiftType || "unknown",
    workDuration:
      firstEntryTime && lastExitTime
        ? calculateWorkDuration(
            firstEntryTime,
            lastExitTime,
            events[0]?.employee?.work_schedule?.break_minutes
          )
        : "00:00",
    events: events.map((e) => ({
      id: e.id,
      date: e.date,
      direction: e.direction,
      door_id: e.door_id,
      door_name: e.door_name,
      determinedShift: getCachedShift(e),
      event_photo: e.photo || null,
    })),
  };

  if (leaveRequest && leaveRequest.is_company_paid) {
    const leaveStart = parseEventTime(leaveRequest.date_from);
    const leaveEnd = parseEventTime(leaveRequest.date_to);

    let minutesToAdd = 0;

    if (leaveStart.hasSame(leaveEnd, "day")) {
      minutesToAdd = leaveEnd.diff(leaveStart, "minutes").minutes;
    } else {
      if (currentDate === leaveStart.toISODate()) {
        minutesToAdd = 24 * 60 - (leaveStart.hour * 60 + leaveStart.minute);
      } else if (currentDate === leaveEnd.toISODate()) {
        minutesToAdd = leaveEnd.hour * 60 + leaveEnd.minute;
      }
    }

    base.havePermission = true;
    base.workDuration = addMinutesToDuration(
      base.workDuration,
      Math.round(minutesToAdd)
    );
    base.events.push({
      leave_request: {
        date_from: leaveStart.toISODate(),
        date_to: leaveEnd.toISODate(),
        description: leaveRequest.reason,
        permission_number: leaveRequest.permission_number,
        company_paid: leaveRequest.is_company_paid,
      },
    });
  }

  return base;
}

function calculateWorkDuration(start, end, break_minutes = 0) {
  if (!start || !end || !start.isValid || !end.isValid) return "00:00";

  // используем миллиsekунды для сравнения
  if (end.toMillis() < start.toMillis()) return "00:00";

  // Общая продолжительность в минутах
  let durationInMinutes = end.diff(start, "minutes").minutes;

  // Вычитаем перерыв
  if (durationInMinutes >= 300 && break_minutes) {
    durationInMinutes -= break_minutes;
  }

  if (durationInMinutes < 0) durationInMinutes = 0;

  const hours = Math.floor(durationInMinutes / 60);
  const minutes = Math.round(durationInMinutes % 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

function getNormalSessionEvents(events) {
  const entryExitEvents = events.filter(
    (e) => e.event_type === "entry" || e.event_type === "exit"
  );
  const firstEntry = entryExitEvents.find((e) => e.event_type === "entry");
  const lastExit = [...entryExitEvents]
    .reverse()
    .find((e) => e.event_type === "exit");
  return {
    firstEntry,
    lastExit,
    allEvents: events,
  };
}

function getShiftStartTime(eventTime, shiftType, event) {
  if (!event) throw new Error("Event is required");
  const dateStr = eventTime.toISODate(); // YYYY-MM-DD
  const ws = event.employee?.work_schedule || {};
  if (shiftType === "first") {
    const t = ws.first_shift_start;
    return t
      ? DateTime.fromISO(`${dateStr}T${t}`)
      : DateTime.fromISO(`${dateStr}T00:00`);
  } else {
    const t = ws.second_shift_start;
    return t
      ? DateTime.fromISO(`${dateStr}T${t}`)
      : DateTime.fromISO(`${dateStr}T00:00`);
  }
}

function getShiftEndTime(eventTime, shiftType, event) {
  if (!event) throw new Error("Event is required");
  const dateStr = eventTime.toISODate();
  const ws = event.employee?.work_schedule || {};
  if (shiftType === "first") {
    const t = ws.first_shift_end;
    return t
      ? DateTime.fromISO(`${dateStr}T${t}`)
      : DateTime.fromISO(`${dateStr}T00:00`);
  } else {
    const t = ws.second_shift_end;
    if (!t) {
      // если нет явного времени — считаем 8 часов сменой и не переносим на следующий день
      return DateTime.fromISO(`${dateStr}T00:00`).plus({ hours: 8 });
    }
    const candidate = DateTime.fromISO(`${dateStr}T${t}`);
    // если время конца раньше времени старта, предполагаем переход через полночь
    const start = ws.second_shift_start
      ? DateTime.fromISO(`${dateStr}T${ws.second_shift_start}`)
      : null;
    if (start && candidate.toMillis() <= start.toMillis()) {
      return candidate.plus({ days: 1 });
    }
    return candidate;
  }
}

function determineShift(eventTime, event) {
  const ws = event.employee?.work_schedule || {};
  const dateStr = eventTime.toISODate();
  const candidates = [];

  if (ws.first_shift_start) {
    const firstStart = DateTime.fromISO(`${dateStr}T${ws.first_shift_start}`);
    const firstEnd = ws.first_shift_end
      ? DateTime.fromISO(`${dateStr}T${ws.first_shift_end}`)
      : firstStart.plus({ hours: 8 });
    // если end раньше start — переносим на следующий день
    const firstEndAdj =
      firstEnd.toMillis() < firstStart.toMillis()
        ? firstEnd.plus({ days: 1 })
        : firstEnd;
    candidates.push({
      shift: "first",
      entryStart: firstStart,
      exitEnd: firstEndAdj,
    });
  }

  if (ws.second_shift_start) {
    const secondStart = DateTime.fromISO(`${dateStr}T${ws.second_shift_start}`);
    let secondEnd = ws.second_shift_end
      ? DateTime.fromISO(`${dateStr}T${ws.second_shift_end}`)
      : secondStart.plus({ hours: 8 });
    if (secondEnd.toMillis() <= secondStart.toMillis())
      secondEnd = secondEnd.plus({ days: 1 });
    candidates.push({
      shift: "second",
      entryStart: secondStart,
      exitEnd: secondEnd,
    });
  }

  if (ws.third_shift_start) {
    const thirdStart = DateTime.fromISO(`${dateStr}T${ws.third_shift_start}`);
    let thirdEnd = ws.third_shift_end
      ? DateTime.fromISO(`${dateStr}T${ws.third_shift_end}`)
      : thirdStart.plus({ hours: 8 });
    if (thirdEnd.toMillis() <= thirdStart.toMillis())
      thirdEnd = thirdEnd.plus({ days: 1 });
    candidates.push({
      shift: "third",
      entryStart: thirdStart,
      exitEnd: thirdEnd,
    });
  }

  const compareIsEntry =
    event.event_type === "entry" || event.event_type === "start";

  const diffs = candidates.map((c) => {
    const target = compareIsEntry ? c.entryStart : c.exitEnd;
    return {
      shift: c.shift,
      diff: Math.abs(eventTime.diff(target, "minutes").minutes),
    };
  });

  diffs.sort((a, b) => a.diff - b.diff);
  return diffs[0]?.shift || "unknown";
}
