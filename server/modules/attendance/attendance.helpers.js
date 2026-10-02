export function splitEmployeesByTodayStatus(data = []) {
  const result = {
    present: [],
    absent: [],
    inside: [],
    left: [],
    onTimeOff: [],
  };

  for (const employee of data) {
    // sessions содержит только одну дату (сегодня)
    const session = employee.sessions
      ? Object.values(employee.sessions)[0] ?? null
      : null;

    const hasEvents = Array.isArray(session?.events) && session.events.length > 0;
    const isCompanyPaidOff = session?.timeOff?.isCompanyPaid === true;

    // Отсутствие: нет реальных событий, и либо совсем нет сессии, либо отгул не за счёт компании
    // (отгул за свой счёт не меняет статус — просто прикрепляем причину для отображения в "Пришел")
    if (!session || (!hasEvents && !isCompanyPaidOff)) {
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
        timeOff: session?.timeOff || null,
      });
      continue;
    }

    // Отгул на весь день (day_off/vacation, за счёт компании), реальных событий не было → отдельный статус, не present/absent
    if (
      !hasEvents &&
      session.timeOff?.isCompanyPaid &&
      session.timeOff.type !== "hour"
    ) {
      result.onTimeOff.push({
        employeeId: employee.employeeId,
        employeeNumber: employee.employeeNumber,
        employeeFullName: employee.employeeFullName,
        employeePhoto: employee.employeePhoto,
        branchName: employee.branchName,
        departmentName: employee.departmentName,
        positionName: employee.positionName,
        workScheduleName: employee.workScheduleName,
        timeOff: session.timeOff,
      });
      continue;
    }

    // Была сессия (реальная или excused "hour"-отгул) → сотрудник присутствует
    const firstEntry = session.firstEntry || null;
    const firstEntryDoor = session.firstEntryDoor || null;
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
      firstEntryDoor,
      lastExit,
      workDuration,
      shiftType,
      timeOff: session.timeOff || null,
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
