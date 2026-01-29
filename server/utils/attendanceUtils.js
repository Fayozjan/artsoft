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

function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function generateAttendanceReport(attendanceData) {
  return attendanceData.map((data) => {
    // 1. Подготовка базовых данных
    const scheduleType = data.workSchedule?.shift_type || "normal";
    const sortedEvents = (data.events || [])
      .filter((e) => e.date)
      .map((e) => ({
        ...e,
        parsedDate: parseCustomDate(e.date),
      }))
      .sort((a, b) => a.parsedDate - b.parsedDate);

    const sessionsMap = {};
    let totalMinutesWorked = 0;

    if (scheduleType === "normal" || scheduleType === "flexible") {
      const eventsByDay = {};

      sortedEvents.forEach((event) => {
        const dayKey = event.parsedDate.getDate().toString();
        if (!eventsByDay[dayKey]) eventsByDay[dayKey] = [];
        eventsByDay[dayKey].push(event);
      });

      // Обрабатываем каждый день
      Object.keys(eventsByDay).forEach((dayKey) => {
        const dailyEvents = eventsByDay[dayKey];

        const firstEntryEvent = dailyEvents.find(
          (e) => e.direction === "entry"
        );
        const lastExitEvent = [...dailyEvents]
          .reverse()
          .find((e) => e.direction === "exit");

        let durationMinutes = 0;
        let firstEntryTime = null;
        let lastExitTime = null;

        if (
          firstEntryEvent &&
          lastExitEvent &&
          lastExitEvent.parsedDate > firstEntryEvent.parsedDate
        ) {
          const diffMs = lastExitEvent.parsedDate - firstEntryEvent.parsedDate;
          durationMinutes = Math.floor(diffMs / 1000 / 60);
          totalMinutesWorked += durationMinutes;
        }

        if (firstEntryEvent)
          firstEntryTime = formatTime(firstEntryEvent.parsedDate);
        if (lastExitEvent) lastExitTime = formatTime(lastExitEvent.parsedDate);

        // Формируем сессию
        sessionsMap[dayKey] = {
          firstEntry: firstEntryTime,
          lastExit: lastExitTime,
          workDuration: formatDuration(durationMinutes),
          shiftType: scheduleType,
          hasPermission: false,
          events: dailyEvents.map((e) => ({
            employeeId: e.employee_id,
            date: e.date,
            direction: e.direction,
            door_id: e.door_id,
            door_name: e.door_name,
            determinedShift: "normal / flexible",
            event_photo: e.photo || null,
          })),
        };
      });
    } else if (scheduleType === "shift") {
      const shiftsByStartDay = {};

      let i = 0;
      while (i < sortedEvents.length) {
        const currentEvent = sortedEvents[i];

        if (currentEvent.direction === "entry") {
          const dayKey = currentEvent.parsedDate.getDate().toString();

          let exitEvent = null;
          let shiftEvents = [currentEvent];
          let j = i + 1;

          while (j < sortedEvents.length) {
            const nextEvent = sortedEvents[j];
            // Лимит смены 24 часа (86400000 мс)
            if (nextEvent.parsedDate - currentEvent.parsedDate > 86400000) {
              break;
            }

            shiftEvents.push(nextEvent);

            if (nextEvent.direction === "exit") {
              exitEvent = nextEvent;
              i = j;
              break;
            }
            j++;
          }

          // Расчет длительности найденной одиночной смены
          let durationMinutes = 0;
          if (exitEvent) {
            const diffMs = exitEvent.parsedDate - currentEvent.parsedDate;
            durationMinutes = Math.floor(diffMs / 1000 / 60);
            totalMinutesWorked += durationMinutes;
          }

          // Сохраняем информацию об одиночной смене в группу
          if (!shiftsByStartDay[dayKey]) shiftsByStartDay[dayKey] = [];

          shiftsByStartDay[dayKey].push({
            firstEntry: currentEvent.parsedDate,
            lastExit: exitEvent ? exitEvent.parsedDate : null,
            durationMinutes: durationMinutes,
            events: shiftEvents,
          });

          if (!exitEvent) i++;
          else i++;
        } else {
          i++;
        }
      }

      Object.keys(shiftsByStartDay).forEach((dayKey) => {
        const shifts = shiftsByStartDay[dayKey];

        const firstEntryOfAllShifts = shifts[0].firstEntry;

        let lastExitOfAllShifts = null;
        shifts.forEach((shift) => {
          if (shift.lastExit) {
            if (!lastExitOfAllShifts || shift.lastExit > lastExitOfAllShifts) {
              lastExitOfAllShifts = shift.lastExit;
            }
          }
        });

        const totalShiftDurationMinutes = shifts.reduce(
          (sum, shift) => sum + shift.durationMinutes,
          0
        );

        const allEvents = shifts
          .flatMap((shift) => shift.events)
          .sort((a, b) => a.parsedDate - b.parsedDate);

        sessionsMap[dayKey] = {
          firstEntry: formatTime(firstEntryOfAllShifts),
          lastExit: formatTime(lastExitOfAllShifts),
          workDuration: formatDuration(totalShiftDurationMinutes),
          shiftType: "shift",
          hasPermission: false,
          events: allEvents.map((e) => ({
            employee_id: e.id,
            date: e.date,
            direction: e.direction,
            door_id: e.door_id,
            door_name: e.door_name,
            determinedShift: "shift_aggregated",
            event_photo: e.photo || null,
          })),
        };
      });
    }

    const workedDaysCount = Object.values(sessionsMap).filter(
      (s) => s.workDuration !== "00:00"
    ).length;

    return {
      employeeId: data.employeeId.toString(),
      employeeNumber: data.employeeNumber,
      employeeFullName: data.employeeFullName,
      employeePhoto: data.employeePhoto || null,
      branchName: data.branchName,
      departmentName: data.departmentName,
      positionName: data.positionName,
      workScheduleName: data.workSchedule?.name,
      workSchedule: data.workSchedule,
      totalWorkedDays: workedDaysCount,
      totalWorkedHours: formatDuration(totalMinutesWorked),
      sessions: sessionsMap,
    };
  });
}
