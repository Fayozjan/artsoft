import { DateTime } from "luxon";

// 📌 Кеши для ускорения
const dateCache = new Map();
const shiftCache = new Map();

function parseEventTime(input) {
  if (!input) return null;
  if (dateCache.has(input)) return dateCache.get(input);

  let dt;

  // Если уже Luxon DateTime
  if (DateTime.isDateTime(input)) {
    dt = input;
  }
  // Если JS Date
  else if (input instanceof Date) {
    dt = DateTime.fromJSDate(input);
  }
  // Если ISO строка (2025-12-02T08:00:00)
  else if (typeof input === "string" && input.includes("T")) {
    dt = DateTime.fromISO(input);
  }
  // Если строка в формате "dd.MM.yyyy, HH:mm:ss" или "dd.MM.yyyy, HH:mm"
  else if (typeof input === "string") {
    if (input.includes(".")) {
      // пример: "03.12.2025, 15:01:00"
      dt = DateTime.fromFormat(input.trim(), "dd.MM.yyyy, HH:mm:ss");
      if (!dt.isValid) {
        // попробовать без секунд
        dt = DateTime.fromFormat(input.trim(), "dd.MM.yyyy, HH:mm");
      }
    } else {
      // попробовать "yyyy-MM-dd HH:mm:ss"
      dt = DateTime.fromFormat(input.trim(), "yyyy-MM-dd HH:mm:ss");
      if (!dt.isValid) {
        // попытка с ISO fallback
        dt = DateTime.fromISO(input.trim());
      }
    }
  } else {
    dt = DateTime.invalid("unknown format");
  }

  dateCache.set(input, dt);
  return dt;
}

export function processEvents(employees = [], tripsMap = {}) {
  if (!Array.isArray(employees) || employees.length === 0) return [];

  console.log("employees", employees);

  const result = [];

  for (const employeeObj of employees) {
    const employeeId = employeeObj.employee_id;
    const workSchedule = employeeObj.work_schedule || {};
    const rawEvents = (employeeObj.events || []).map((e) => ({
      ...e,
      employee: employeeObj,
      employee_id: employeeId,
      event_type: e.direction === "entry" ? "entry" : "exit",
    }));

    rawEvents.sort(
      (a, b) =>
        parseEventTime(a.date).toMillis() - parseEventTime(b.date).toMillis()
    );

    // создаём сессии
    const sessions = [];
    let currentSession = null;
    let currentEvents = [];

    for (const event of rawEvents) {
      const eventTime = parseEventTime(event.date);
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
        if (event.event_type === "entry" || event.event_type === "start") {
          if (!currentSession) {
            currentSession = createNewSession(eventTime, event);
            currentEvents = [event];
          } else {
            const duration = eventTime.diff(
              currentSession.start,
              "minutes"
            ).minutes;
            if (duration > 8 * 60) {
              sessions.push(
                createSession(
                  currentSession,
                  currentEvents,
                  tripsMap[employeeId] || []
                )
              );
              currentSession = createNewSession(eventTime, event);
              currentEvents = [event];
            } else {
              currentEvents.push(event);
            }
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
  const workSchedule = event.employee?.work_schedule || {};
  if (workSchedule.shift_type === "shift") {
    const eventShift = determineShift(eventTime, event);
    return {
      type: "shift",
      shiftType: eventShift,
      start: getShiftStartTime(eventTime, eventShift, event),
      end: getShiftEndTime(eventTime, eventShift, event),
      date: eventTime.toISODate(),
    };
  } else {
    return {
      type: "normal",
      date: eventTime.toISODate(),
    };
  }
}

// Функции для проверки события выход на закрытии смены
function isSessionEnded(session, eventTime, eventType) {
  if (session.type === "shift" && eventType === "exit") {
    // если событие позже конца смены, считаем что смена завершена
    const ended = eventTime.toMillis() > session.end.toMillis();
    return ended;
  } else {
    return eventTime.toISODate() !== session.date;
  }
}

function addMinutesToDuration(durationStr, minutesToAdd = 0) {
  const [h, m] = durationStr.split(":").map(Number);
  let total = h * 60 + m + minutesToAdd;
  if (total < 0) total = 0;
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createSession(session, events, tripsForUser = []) {
  const currentDate =
    session.type === "normal"
      ? session.date
      : parseEventTime(events[0].date).toISODate();

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

  if (session.type === "normal") {
    const { firstEntry, lastExit, allEvents } = getNormalSessionEvents(events);

    const firstEntryTime = firstEntry ? parseEventTime(firstEntry.date) : null;
    const lastExitTime = lastExit ? parseEventTime(lastExit.date) : null;

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
              events[0].employee?.work_schedule?.break_minutes
            )
          : "00:00",
      events: allEvents.map((e) => ({
        id: e.id,
        date: e.date,
        direction: e.direction,
        door_id: e.door_id,
        door_name: e.door_name,
        determinedShift: determineShift(parseEventTime(e.date), e),
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

  const firstEntryTime = firstEntry ? parseEventTime(firstEntry.date) : null;
  const lastExitTime = lastExit ? parseEventTime(lastExit.date) : null;

  const base = {
    date: currentDate,
    firstEntry: firstEntryTime?.toFormat("HH:mm") || null,
    lastExit: lastExitTime?.toFormat("HH:mm") || null,
    firstEntryPhoto: firstEntry?.event_photo || null,
    lastExitPhoto: lastExit?.event_photo || null,
    shiftType: session.shiftType,
    workDuration:
      firstEntryTime && lastExitTime
        ? calculateWorkDuration(
            firstEntryTime,
            lastExitTime,
            events[0].employee?.work_schedule?.break_minutes
          )
        : "00:00",
    events: events.map((e) => ({
      id: e.id,
      date: e.date,
      direction: e.direction,
      door_id: e.door_id,
      door_name: e.door_name,
      determinedShift: determineShift(parseEventTime(e.date), e),
      event_photo: e.photo || null, // <-- добавляем сюда
    })),
  };

  // Если есть командировка/отгул
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

// Функция для вычисления продолжительности работы в формате HH:mm
function calculateWorkDuration(start, end, break_minutes = 0) {
  if (!start || !end || !start.isValid || !end.isValid) return "00:00";
  if (end < start) return "00:00";

  // Общая продолжительность в минутах
  let durationInMinutes = end.diff(start, "minutes").minutes;

  // Вычитаем перерыв
  if (durationInMinutes >= 300 && break_minutes) {
    durationInMinutes -= break_minutes;
  }

  // Если результат меньше 0 — устанавливаем 0
  if (durationInMinutes < 0) durationInMinutes = 0;

  const hours = Math.floor(durationInMinutes / 60);
  const minutes = Math.round(durationInMinutes % 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

// Функции для нормальной смены (normal)
function getNormalSessionEvents(events) {
  // Фильтруем только входы и выходы
  const entryExitEvents = events.filter(
    (e) => e.event_type === "entry" || e.event_type === "exit"
  );

  // Находим первый вход и последний выход
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

// Возвращаем DateTime для начала смены
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
    // вторая смена часто заканчивается после полуночи — добавляем +1 день
    return t
      ? DateTime.fromISO(`${dateStr}T${t}`).plus({ days: 1 })
      : DateTime.fromISO(`${dateStr}T00:00`).plus({ days: 1 });
  }
}

function determineShift(eventTime, event) {
  // eventTime: Luxon DateTime
  // event: событие с event.employee.work_schedule
  const ws = event.employee?.work_schedule || {};
  const dateStr = eventTime.toISODate();

  // соберём возможные времена (если нет — пропускаем)
  const candidates = [];

  if (ws.first_shift_start) {
    const firstStart = DateTime.fromISO(`${dateStr}T${ws.first_shift_start}`);
    const firstEnd = ws.first_shift_end
      ? DateTime.fromISO(`${dateStr}T${ws.first_shift_end}`)
      : firstStart.plus({ hours: 8 });
    candidates.push({
      shift: "first",
      entryStart: firstStart,
      exitEnd: firstEnd,
    });
  }

  if (ws.second_shift_start) {
    const secondStart = DateTime.fromISO(`${dateStr}T${ws.second_shift_start}`);
    const secondEnd = ws.second_shift_end
      ? DateTime.fromISO(`${dateStr}T${ws.second_shift_end}`).plus({ days: 1 })
      : secondStart.plus({ hours: 12 });
    candidates.push({
      shift: "second",
      entryStart: secondStart,
      exitEnd: secondEnd,
    });
  }

  if (ws.third_shift_start) {
    const thirdStart = DateTime.fromISO(`${dateStr}T${ws.third_shift_start}`);
    const thirdEnd = ws.third_shift_end
      ? DateTime.fromISO(`${dateStr}T${ws.third_shift_end}`).plus({ days: 1 })
      : thirdStart.plus({ hours: 12 });
    candidates.push({
      shift: "third",
      entryStart: thirdStart,
      exitEnd: thirdEnd,
    });
  }

  // Если событие — вход, сравниваем с entryStart; если выход — с exitEnd
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
