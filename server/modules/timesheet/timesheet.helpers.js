export function buildSessionsIndex(employees) {
  const index = {};

  for (const emp of employees) {
    const empId = String(emp.employeeId);
    if (!emp.sessions) continue;

    index[empId] ??= {};

    for (const [day, session] of Object.entries(emp.sessions)) {
      index[empId][day] = {
        employeeId: empId,
        day: Number(day),
        session,
        events: session.events || [],
      };
    }
  }

  return index;
}
