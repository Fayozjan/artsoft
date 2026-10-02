import { EmployeeWorkScheduleHistoryModel } from "../employeeScheduleHistory/employeeScheduleHistory.model.js";

// Одна выборка истории графика на всех сотрудников страницы — используется и для
// заглушек employee без событий, и для сотрудников с событиями (FacePassesService.getAllLean).
export async function buildScheduleHistoryMap(employeeIds) {
  const historyByEmployee = new Map();
  if (!employeeIds?.length) return historyByEmployee;

  const historyRecords = await EmployeeWorkScheduleHistoryModel.findByEmployeeIds(employeeIds);

  historyRecords.forEach((h) => {
    if (!historyByEmployee.has(h.employee_id)) historyByEmployee.set(h.employee_id, []);
    historyByEmployee.get(h.employee_id).push(h);
  });

  return historyByEmployee;
}

// Сотрудники без единого badge-события не попадают в грппировку FacePassesService.getAllLean
// (она строится по строкам face_passes). Достраиваем для них пустые attendanceData-заглушки
// с историей графика, чтобы generateAttendanceReport мог применить их отгулы/отлучки.
export function buildZeroEventStubs(events, employeesData, historyByEmployee) {
  const eventEmployeeIds = new Set(events.map((e) => e.employeeId));
  const missingEmployees = employeesData.filter(
    (emp) => !eventEmployeeIds.has(emp.id),
  );

  return missingEmployees.map((emp) => ({
    employeeId: emp.id,
    employeeNumber: emp.employee_number,
    employeeFullName: `${[emp.last_name, emp.first_name, emp.middle_name]
      .filter(Boolean)
      .join(" ")} (${emp.id})`,
    employeePhoto: emp.photo || null,
    branchName: emp.branch?.name || null,
    departmentName: emp.department?.name || null,
    positionName: emp.position?.name || null,
    pinfl: emp.pinfl || null,
    workScheduleName: emp.workSchedule?.name || null,
    workSchedule: historyByEmployee.get(emp.id) || [],
    events: [],
  }));
}

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
