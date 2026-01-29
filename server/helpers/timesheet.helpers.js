// Фильтрация сессий по месяцу (YYYY-MM)
export function filterSessionsByMonth(data, month) {
  if (!month) return data;

  const [year, monthValue] = month.split("-").map(Number);

  return data.filter((session) => {
    const sessionDate = new Date(session.date || session.event_time);
    return (
      sessionDate.getFullYear() === year &&
      sessionDate.getMonth() + 1 === monthValue
    );
  });
}

// Форматирование результата для Telegram-бота
export function formatResultForTelegram(data, holidays = []) {
  return data.map((employee) => {
    const sessions = employee.sessions || [];

    const workedDays = sessions.filter((s) => s.status === "worked").length;
    const missedDays = sessions.filter((s) => s.status === "absent").length;
    const holidayDays = holidays.length;

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        branch: employee.branch?.name || "",
        department: employee.department?.name || "",
        position: employee.position?.name || "",
      },
      summary: {
        worked: workedDays,
        absent: missedDays,
        holidays: holidayDays,
      },
    };
  });
}

// Универсальная утилита: группировка сессий по сотрудникам
export function groupSessionsByEmployee(events) {
  const map = new Map();

  events.forEach((event) => {
    const employeeId = event.employee_id;
    if (!map.has(employeeId)) {
      map.set(employeeId, {
        id: employeeId,
        name: `${event.employee?.surname || ""} ${
          event.employee?.name || ""
        }`.trim(),
        branch: event.employee?.branch,
        department: event.employee?.department,
        position: event.employee?.position,
        sessions: [],
      });
    }
    map.get(employeeId).sessions.push(event);
  });

  return Array.from(map.values());
}
