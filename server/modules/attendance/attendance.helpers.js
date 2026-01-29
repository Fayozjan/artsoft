export function splitEmployeesByTodayStatus(data = []) {
  const result = {
    present: [],
    absent: [],
    inside: [],
    left: [],
  };

  for (const employee of data) {
    // sessions содержит только одну дату (сегодня)
    const session = employee.sessions
      ? Object.values(employee.sessions)[0] ?? null
      : null;

    if (
      !session ||
      !Array.isArray(session.events) ||
      session.events.length === 0
    ) {
      result.absent.push({
        employeeId: employee.employeeId,
        employeeNumber: employee.employeeNumber,
        employeeFullName: employee.employeeFullName,
        employeePhoto: employee.employeePhoto,
        branchName: employee.branchName,
        departmentName: employee.departmentName,
        positionName: employee.positionName,
        workScheduleName: employee.workScheduleName,
        scheduledStart: employee.workSchedule?.shiftStart || null,
      });
      continue;
    }

    // Была сессия → сотрудник присутствует
    const firstEntry = session.firstEntry || null;
    const lastExit = session.lastExit || null;
    const workDuration = session.workDuration || null;
    const shiftType = session.shiftType || null;

    const baseEmployee = {
      employeeId: employee.employeeId,
      employeeNumber: employee.employeeNumber,
      employeeFullName: employee.employeeFullName,
      employeePhoto: employee.employeePhoto,
      branchName: employee.branchName,
      departmentName: employee.departmentName,
      positionName: employee.positionName,
      workScheduleName: employee.workScheduleName,
      scheduledStart: employee.workSchedule?.shiftStart || null,
      firstEntry,
      lastExit,
      workDuration,
      shiftType,
    };

    result.present.push({ ...baseEmployee });

    const lastEvent = session.events.at(-1);

    if (lastEvent?.direction === "entry") {
      result.inside.push({
        ...baseEmployee,
        status: "inside",
      });
    } else if (lastEvent?.direction === "exit") {
      result.left.push({
        ...baseEmployee,
        status: "left",
      });
    }
  }

  return result;
}
