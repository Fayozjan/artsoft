import { DateTime } from "luxon";

// 📌 Кеши для ускорения
const dateCache = new Map();
const shiftCache = new Map();

function parseEventTime(str) {
  if (!dateCache.has(str)) {
    dateCache.set(str, DateTime.fromFormat(str, "yyyy-MM-dd HH:mm:ss"));
  }
  return dateCache.get(str);
}

function getCachedShift(event) {
  const key = `${event.employee_id}_${event.event_time_string}`;
  if (!shiftCache.has(key)) {
    shiftCache.set(
      key,
      determineShift(parseEventTime(event.event_time_string), event)
    );
  }
  return shiftCache.get(key);
}

export function processEvents(events, tripsMap = {}) {
  if (!events.length) return [];

  const groupedByEmployee = {};

  for (const event of events) {
    if (!groupedByEmployee[event.employee_id])
      groupedByEmployee[event.employee_id] = [];
    groupedByEmployee[event.employee_id].push(event);
  }

  const result = [];

  for (const employeeId in groupedByEmployee) {
    const userEvents = groupedByEmployee[employeeId];

    userEvents.sort(
      (a, b) =>
        parseEventTime(a.event_time_string).toMillis() -
        parseEventTime(b.event_time_string).toMillis()
    );

    const sessions = [];
    let currentSession = null;
    let currentEvents = [];

    for (const event of userEvents) {
      const eventTime = parseEventTime(event.event_time_string);
      if (!eventTime.isValid) continue;

      if (event.shift_type === "normal") {
        if (!currentSession || eventTime.toISODate() !== currentSession.date) {
          if (currentEvents.length > 0) {
            sessions.push(
              createSession(
                currentSession,
                currentEvents,
                tripsMap?.[employeeId] || []
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

      if (event.shift_type === "shift") {
        if (event.event_type === "entry") {
          if (!currentSession) {
            currentSession = createNewSession(eventTime, event);
            currentEvents = [event];
          } else {
            const duration = eventTime.diff(
              currentSession.start,
              "minutes"
            ).minutes;
            if (duration > 8 * 60) {
              sessions.push(createSession(currentSession, currentEvents));
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
            sessions.push(createSession(currentSession, currentEvents));
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

    const employeeInfo = {
      position_name: userEvents[0]?.position_name ?? null,
      branch_name: userEvents[0]?.branch_name ?? null,
      department_name: userEvents[0]?.department_name ?? null,
      department_id: userEvents[0]?.department_id ?? null,
      name: userEvents[0]?.name ?? null,
      surname: userEvents[0]?.surname ?? null,
      patronymic: userEvents[0]?.patronymic ?? null,
      employee_number: userEvents[0]?.employee_number ?? null,
    };

    const groupedResult = {
      employee_id: employeeId,
      employee_info: employeeInfo,
      sessions_by_date: {},
    };

    const temp = {};
    for (const session of sessions) {
      if (!temp[session.date]) temp[session.date] = [];
      temp[session.date].push(session);
    }

    for (const date in temp) {
      const daySessions = temp[date];

      if (daySessions.length > 1) {
        const allEvents = daySessions.flatMap((s) => s.events);
        allEvents.sort(
          (a, b) =>
            parseEventTime(a.event_time_string).toMillis() -
            parseEventTime(b.event_time_string).toMillis()
        );

        const firstEntry = allEvents.find((e) => e.event_type === "entry");
        const lastExit = findLastEvent(allEvents, "exit");

        const firstTime = firstEntry
          ? parseEventTime(firstEntry.event_time_string)
          : null;
        const lastTime = lastExit
          ? parseEventTime(lastExit.event_time_string)
          : null;

        groupedResult.sessions_by_date[date] = [
          {
            firstEntry: firstTime?.toFormat("HH:mm") || null,
            lastExit: lastTime?.toFormat("HH:mm") || null,
            shiftType: "combined",
            workDuration:
              firstTime && lastTime
                ? calculateWorkDuration(
                    firstTime,
                    lastTime,
                    allEvents[0].break_minutes
                  )
                : "00:00",
            hasPermission: allEvents.some((e) => e.leave_request) ?? false,
            events: allEvents.map((e) => ({
              ...e,
              determinedShift:
                e.shift_type === "shift" ? getCachedShift(e) : "normal",
            })),
          },
        ];
      } else {
        groupedResult.sessions_by_date[date] = daySessions.map((s) => ({
          firstEntry: s.firstEntry,
          lastExit: s.lastExit,
          firstEntryPhoto: s.firstEntryPhoto,
          lastExitPhoto: s.lastExitPhoto,
          shiftType: s.shiftType,
          workDuration: s.workDuration,
          hasPermission:
            s.havePermission ?? s.events.some((e) => e.leave_request),
          events: s.events,
        }));
      }
    }

    result.push(groupedResult);
  }

  return result;
}

function findLastEvent(events, type) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event_type === type) return events[i];
  }
  return null;
}

// Функция для создания новой смены
function createNewSession(eventTime, event) {
  if (event.shift_type === "shift") {
    const eventShift = determineShift(eventTime, event);
    return {
      type: "shift",
      shiftType: eventShift,
      start: getShiftStartTime(eventTime, eventShift, event),
      end: getShiftEndTime(eventTime, eventShift, event),
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
    const ended = eventTime.toMillis() > session.end.toMillis();
    return ended;
  } else {
    return eventTime.toISODate() !== session.date;
  }
}

function addMinutesToDuration(durationStr, minutesToAdd = 0) {
  const [h, m] = durationStr.split(":").map(Number);
  let total = h * 60 + m + minutesToAdd;
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createSession(session, events, tripsForUser) {
  const currentDate =
    session.type === "normal"
      ? session.date
      : DateTime.fromFormat(
          events[0].event_time_string,
          "yyyy-MM-dd HH:mm:ss"
        ).toISODate();

  // Ищем командировку/отгул для этого дня
  const leaveRequest = tripsForUser?.find((trip) => {
    const leaveStart = DateTime.fromFormat(
      trip.date_from,
      "yyyy-MM-dd HH:mm:ss"
    );
    const leaveEnd = DateTime.fromFormat(trip.date_to, "yyyy-MM-dd HH:mm:ss");

    return (
      currentDate >= leaveStart.toISODate() &&
      currentDate <= leaveEnd.toISODate()
    );
  });

  if (session.type === "normal") {
    const { firstEntry, lastExit, allEvents } = getNormalSessionEvents(events);

    const firstEntryTime = firstEntry
      ? DateTime.fromFormat(firstEntry.event_time_string, "yyyy-MM-dd HH:mm:ss")
      : null;

    const lastExitTime = lastExit
      ? DateTime.fromFormat(lastExit.event_time_string, "yyyy-MM-dd HH:mm:ss")
      : null;

    const base = {
      user_id: events[0].user_id,
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
              events[0].break_minutes
            )
          : "00:00",
      events: allEvents.map((e) => ({
        ...e,
        determinedShift: "normal",
      })),
    };

    if (leaveRequest && leaveRequest.is_company_paid) {
      const leaveStart = DateTime.fromFormat(
        leaveRequest.date_from,
        "yyyy-MM-dd HH:mm:ss"
      );

      const leaveEnd = DateTime.fromFormat(
        leaveRequest.date_to,
        "yyyy-MM-dd HH:mm:ss"
      );

      let minutesToAdd = 0;

      if (leaveStart.hasSame(leaveEnd, "day")) {
        minutesToAdd = leaveEnd.diff(leaveStart, "minutes").minutes;
      } else {
        if (currentDate === leaveStart.toISODate()) {
          minutesToAdd = 24 * 60 - leaveStart.hour * 60 - leaveStart.minute;
        } else if (currentDate === leaveEnd.toISODate()) {
          minutesToAdd = leaveEnd.hour * 60 + leaveEnd.minute;
        }
      }

      base.workDuration = addMinutesToDuration(base.workDuration, minutesToAdd);

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

  // Логика для смен
  const firstEntry = events.find(
    (e) => e.event_type === "entry" || e.event_type === "start"
  );
  const lastExit = [...events].reverse().find((e) => e.event_type === "exit");

  const firstEntryTime = firstEntry
    ? DateTime.fromFormat(firstEntry.event_time_string, "yyyy-MM-dd HH:mm:ss")
    : null;

  const lastExitTime = lastExit
    ? DateTime.fromFormat(lastExit.event_time_string, "yyyy-MM-dd HH:mm:ss")
    : null;

  const base = {
    user_id: events[0].user_id,
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
            events[0].break_minutes
          )
        : "00:00",
    events: events.map((e) => ({
      ...e,
      determinedShift: determineShift(
        DateTime.fromFormat(e.event_time_string, "yyyy-MM-dd HH:mm:ss"),
        e
      ),
    })),
  };

  // Если есть командировка/отгул
  if (leaveRequest && leaveRequest.is_company_paid) {
    const leaveStart = DateTime.fromFormat(
      leaveRequest.date_from,
      "yyyy-MM-dd HH:mm:ss"
    );

    const leaveEnd = DateTime.fromFormat(
      leaveRequest.date_to,
      "yyyy-MM-dd HH:mm:ss"
    );

    let minutesToAdd = 0;

    if (leaveStart.hasSame(leaveEnd, "day")) {
      minutesToAdd = leaveEnd.diff(leaveStart, "minutes").minutes;
    } else {
      if (currentDate === leaveStart.toISODate()) {
        minutesToAdd = 24 * 60 - leaveStart.hour * 60 - leaveStart.minute;
      } else if (currentDate === leaveEnd.toISODate()) {
        minutesToAdd = leaveEnd.hour * 60 + leaveEnd.minute;
      }
    }

    base.havePermission = true;

    base.workDuration = addMinutesToDuration(base.workDuration, minutesToAdd);

    base.events.push({
      leave_request: {
        date_from: leaveStart,
        date_to: leaveEnd,
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

// Функции для сменной работы (shift)
function getShiftStartTime(eventTime, shiftType, event) {
  if (!event) throw new Error("Event is required");
  const dateStr = eventTime.toISODate();
  return shiftType === "first"
    ? DateTime.fromFormat(
        `${dateStr} ${event.first_shift_start}`,
        "yyyy-MM-dd HH:mm:ss"
      )
    : DateTime.fromFormat(
        `${dateStr} ${event.second_shift_start}`,
        "yyyy-MM-dd HH:mm:ss"
      );
}

function getShiftEndTime(eventTime, shiftType, event) {
  if (!event) throw new Error("Event is required");
  const dateStr = eventTime.toISODate();
  return shiftType === "first"
    ? DateTime.fromFormat(
        `${dateStr} ${event.first_shift_end}`,
        "yyyy-MM-dd HH:mm:ss"
      )
    : DateTime.fromFormat(
        `${dateStr} ${event.second_shift_end}`,
        "yyyy-MM-dd HH:mm:ss"
      ).plus({ days: 1 }); // если вторая смена завершается после полуночи
}

function determineShift(eventTime, event) {
  const dateStr = eventTime.toISODate();

  const firstShiftStart = DateTime.fromFormat(
    `${dateStr} ${event.first_shift_start}`,
    "yyyy-MM-dd HH:mm:ss"
  );
  const firstShiftEnd = DateTime.fromFormat(
    `${dateStr} ${event.first_shift_end}`,
    "yyyy-MM-dd HH:mm:ss"
  );

  const secondShiftStart = DateTime.fromFormat(
    `${dateStr} ${event.second_shift_start}`,
    "yyyy-MM-dd HH:mm:ss"
  );
  const secondShiftEnd = DateTime.fromFormat(
    `${dateStr} ${event.second_shift_end}`,
    "yyyy-MM-dd HH:mm:ss"
  ).plus({ days: 1 });

  const thirdShiftStart = DateTime.fromFormat(
    `${dateStr} ${event.third_shift_start}`,
    "yyyy-MM-dd HH:mm:ss"
  );
  const thirdShiftEnd = DateTime.fromFormat(
    `${dateStr} ${event.third_shift_end}`,
    "yyyy-MM-dd HH:mm:ss"
  ).plus({ days: 1 });

  let diffs = [];

  if (event.event_type === "entry") {
    diffs = [
      {
        shift: "first",
        diff: Math.abs(eventTime.diff(firstShiftStart, "minutes").minutes),
      },
      {
        shift: "second",
        diff: Math.abs(eventTime.diff(secondShiftStart, "minutes").minutes),
      },
      {
        shift: "third",
        diff: Math.abs(eventTime.diff(thirdShiftStart, "minutes").minutes),
      },
    ];
  } else if (event.event_type === "exit") {
    diffs = [
      {
        shift: "first",
        diff: Math.abs(eventTime.diff(firstShiftEnd, "minutes").minutes),
      },
      {
        shift: "second",
        diff: Math.abs(eventTime.diff(secondShiftEnd, "minutes").minutes),
      },
      {
        shift: "third",
        diff: Math.abs(eventTime.diff(thirdShiftEnd, "minutes").minutes),
      },
    ];
  }

  diffs.sort((a, b) => a.diff - b.diff);
  return diffs[0]?.shift || "unknown";
}
