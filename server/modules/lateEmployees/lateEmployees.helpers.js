import { DateTime } from "luxon";

function adjustScheduledTimeForPermissions(scheduledTime, userId, timeOffMap) {
  const userPermissions = timeOffMap[userId] || [];

  for (const perm of userPermissions) {
    const permFrom = parseLocalDateTime(perm.from);
    const permTo = parseLocalDateTime(perm.to);

    if (permFrom <= scheduledTime && permTo > scheduledTime) {
      return {
        scheduledTime: new Date(permTo),
        havePermission: true,
        permissionEndTime: perm.to,
      };
    }
  }

  return {
    scheduledTime,
    havePermission: false,
    permissionEndTime: null,
  };
}

export function formatDates(records) {
  return records.map((r) => ({
    ...r,
    event_time: DateTime.fromJSDate(r.event_time, { zone: "utc" }).toFormat(
      "yyyy-MM-dd HH:mm:ss"
    ),
  }));
}

function parseLocalDateTime(dateStr) {
  return new Date(dateStr.replace(" ", "T"));
}

function formatTime(t) {
  if (!t) return null;
  return t.slice(0, 5);
}

function getShiftStart(ws, shiftType) {
  switch (shiftType) {
    case "first":
      return ws.first_shift_start;
    case "second":
      return ws.second_shift_start;
    case "third":
      return ws.third_shift_start;
    default:
      return ws.shift_start;
  }
}

function getDateFromDayIndex(dayIndex) {
  const today = new Date();
  const monthStr = String(today.getMonth() + 1).padStart(2, "0");
  const yearStr = today.getFullYear();
  return `${yearStr}-${monthStr}-${String(dayIndex).padStart(2, "0")}`;
}

export function getDateRange(mode, date) {
  const dt =
    typeof date === "string"
      ? DateTime.fromISO(date, { zone: "Asia/Tashkent" })
      : DateTime.fromJSDate(date, { zone: "Asia/Tashkent" });

  if (!dt.isValid) throw new Error("Invalid date");

  let startDate, endDate;

  if (mode === "month") {
    startDate = dt.startOf("month").toJSDate();
    endDate = dt.endOf("month").toJSDate();
  } else {
    // "day"
    startDate = dt.startOf("day").toJSDate();
    endDate = dt.endOf("day").toJSDate();
  }

  return { startDate, endDate };
}

export function getMonthRangeFromDate(date) {
  const dt =
    typeof date === "string"
      ? DateTime.fromISO(date, { zone: "Asia/Tashkent" })
      : DateTime.fromJSDate(date, { zone: "Asia/Tashkent" });

  if (!dt.isValid) throw new Error("Invalid date");

  return {
    monthStartDate: dt.startOf("month").toJSDate(),
    monthEndDate: dt.endOf("month").toJSDate(),
  };
}

export const findLateEmployeesByDay = async (
  data,
  targetDate,
  holidays,
  timeOffs
) => {
  if (!targetDate) {
    throw new Error("targetDate обязателен для findLateEmployeesByDay");
  }

  const holidayDates = new Set(
    holidays.map((h) => new Date(h.date_from).toISOString().split("T")[0])
  );

  const [year, month] = targetDate.split("-").map(Number);
  const lateEmployees = [];

  data.forEach((employee) => {
    const {
      employeeId,
      employeeNumber,
      employeeFullName,
      employeePhoto,
      branchName,
      departmentName,
      positionName,
      workScheduleName,
      workSchedule,
      sessions,
    } = employee;

    if (!sessions || !workSchedule) return;

    const shiftType = workSchedule.shift_type;

    Object.entries(sessions).forEach(([dayIndex, session]) => {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(
        dayIndex
      ).padStart(2, "0")}`;

      // только нужная дата и не праздник
      if (date !== targetDate || holidayDates.has(date)) return;

      const { firstEntry, events } = session;
      if (shiftType === "flexible" || !firstEntry || !events?.length) return;

      const shiftStartTime = getShiftStart(workSchedule, shiftType);
      if (!shiftStartTime) return;

      let scheduledTime = parseLocalDateTime(
        `${date} ${formatTime(shiftStartTime)}`
      );

      // разрешения / отгулы
      const {
        scheduledTime: adjustedScheduledTime,
        havePermission,
        permissionEndTime,
      } = adjustScheduledTimeForPermissions(
        scheduledTime,
        employeeId,
        timeOffs
      );

      scheduledTime = adjustedScheduledTime;

      const actualTime = parseLocalDateTime(`${date} ${firstEntry}`);

      if (actualTime > scheduledTime) {
        const lateMinutes = Math.floor((actualTime - scheduledTime) / 60000);

        const firstEntryEvent = events.find((e) => e.direction === "entry");

        lateEmployees.push({
          employeeId,
          employeeNumber,
          employeeFullName,
          employeePhoto,
          branchName,
          departmentName,
          positionName,
          workScheduleName,
          date,
          shiftType,
          scheduledStart: formatTime(shiftStartTime),
          actualStart: firstEntry,
          actualStartPhoto: firstEntryEvent?.event_photo || null,
          lateMinutes,
          havePermission,
          permissionEndTime,
        });
      }
    });
  });

  return lateEmployees;
};

export const findLateEmployeesByMonth = async (data, holidays, timeOffs) => {
  const holidayDates = new Set(
    holidays.map((h) => new Date(h.date_from).toISOString().split("T")[0])
  );

  const allLateRecords = [];

  data.forEach((employee) => {
    const {
      employeeId,
      employeeNumber,
      employeeFullName,
      employeePhoto,
      branchName,
      departmentName,
      positionName,
      workScheduleName,
      workSchedule,
      sessions,
    } = employee;

    if (!sessions || !workSchedule) return;

    const shiftType = workSchedule.shift_type;

    Object.entries(sessions).forEach(([dayIndex, session]) => {
      const date = session.date || getDateFromDayIndex(dayIndex);
      if (holidayDates.has(date)) return;

      const { firstEntry, events } = session;
      if (shiftType === "flexible" || !firstEntry || !events?.length) return;

      const shiftStartTime = getShiftStart(workSchedule, shiftType);
      if (!shiftStartTime) return;

      let scheduledTime = parseLocalDateTime(
        `${date} ${formatTime(shiftStartTime)}`
      );

      const {
        scheduledTime: adjustedScheduledTime,
        havePermission,
        permissionEndTime,
      } = adjustScheduledTimeForPermissions(
        scheduledTime,
        employeeId,
        timeOffs
      );

      scheduledTime = adjustedScheduledTime;

      const actualTime = parseLocalDateTime(`${date} ${firstEntry}`);

      if (actualTime > scheduledTime) {
        const lateMinutes = Math.floor((actualTime - scheduledTime) / 60000);

        const firstEntryEvent = events.find((e) => e.direction === "entry");

        allLateRecords.push({
          employeeId,
          employeeNumber,
          employeeFullName,
          employeePhoto,
          branchName,
          departmentName,
          positionName,
          workScheduleName,
          date,
          shiftType,
          scheduledStart: formatTime(shiftStartTime),
          actualStart: firstEntry,
          actualStartPhoto: firstEntryEvent?.event_photo || null,
          lateMinutes,
          havePermission,
          permissionEndTime,
        });
      }
    });
  });

  // Группировка по сотруднику
  const grouped = {};

  allLateRecords.forEach((rec) => {
    if (!grouped[rec.employeeId]) {
      grouped[rec.employeeId] = {
        employeeId: rec.employeeId,
        employeeFullName: rec.employeeFullName,
        employeePhoto: rec.employeePhoto,
        branchName: rec.branchName,
        departmentName: rec.departmentName,
        positionName: rec.positionName,
        monthlyLateCount: 0,
        monthlyLateMinutes: 0,
        details: [],
      };
    }

    const target = grouped[rec.employeeId];
    target.details.push({
      date: rec.date,
      shiftType: rec.shiftType,
      scheduledStart: rec.scheduledStart,
      actualStart: rec.actualStart,
      actualStartPhoto: rec.actualStartPhoto,
      lateMinutes: rec.lateMinutes,
      havePermission: rec.havePermission,
      permissionEndTime: rec.permissionEndTime,
    });

    target.monthlyLateCount += 1;
    target.monthlyLateMinutes += rec.lateMinutes;
  });

  return Object.values(grouped);
};
