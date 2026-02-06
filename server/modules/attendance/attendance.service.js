import { DateTime } from "luxon";

import { UserModel } from "../users/users.model.js";
import { generateAttendanceReport } from "../../utils/attendanceUtils.js";
import { getActiveEmployeesService } from "../employees/employees.service.js";
import { splitEmployeesByTodayStatus } from "./attendance.helpers.js";
import { findLateEmployeesByDay } from "../lateEmployees/lateEmployees.helpers.js";
import { getAllFacePasses } from "../facePasses/facePasses.service.js";
import { getHolidaysService } from "../holidays/holidays.service.js";
import { getTimeOffsAllService } from "../timeOff/timeOff.service.js";
import { BranchService } from "../branches/branches.service.js";
import { getActiveDepartmentsService } from "../departments/departments.service.js";

export async function getAttendanceService({ userId, filters }) {
  const user = await UserModel.getUserById(userId);
  if (!user) throw new Error("Пользователь не найден");

  const dt = DateTime.fromISO(filters.date, { zone: "Asia/Tashkent" });
  const dayKey = dt.day.toString();

  const start_date = dt.minus({ days: 1 }).startOf("day").toJSDate();
  const end_date = dt.endOf("day").toJSDate();

  filters.start_date = start_date;
  filters.end_date = end_date;

  const [faceEvents, employees, holidays, timeOffs, branches, departments] =
    await Promise.all([
      getAllFacePasses({ userId, filters }),
      getActiveEmployeesService({ userId, filters }),
      getHolidaysService(start_date, end_date),
      getTimeOffsAllService({ userId, filters: { start_date, end_date } }),
      BranchService.listActive({ userId }),
      getActiveDepartmentsService({ userId }),
    ]);

  let attendanceEvents = generateAttendanceReport(faceEvents);

  attendanceEvents = attendanceEvents.map((item) => ({
    ...item,
    sessions: item.sessions?.[dayKey]
      ? { [dayKey]: item.sessions[dayKey] }
      : {},
  }));

  const attendanceMap = new Map(
    attendanceEvents.map((e) => [String(e.employeeId), e]),
  );

  for (const emp of employees.data) {
    const key = String(emp.id);

    if (!attendanceMap.has(key)) {
      attendanceEvents.push({
        ...emp,
        employeeId: emp.id,
      });
    }
  }

  const { present, absent, inside, left } =
    splitEmployeesByTodayStatus(attendanceEvents);

  const presentIds = new Set(present.map((item) => item.id));
  const filteredAttendanceEvents = attendanceEvents.filter((item) =>
    presentIds.has(item.id),
  );

  const late = await findLateEmployeesByDay(
    filteredAttendanceEvents,
    filters.date,
    holidays.data,
    timeOffs.data,
  );

  return {
    data: {
      employees: employees.data,
      branches: branches.data,
      departments: departments.data,
      present: present,
      absent: absent,
      late: late,
      inside: inside,
      left: left,
    },
  };
}
