export function fmtLateMinutes(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function sanitizeFileName(name) {
  const cleaned = String(name || "").replace(/[\\/:*?"<>|]/g, "").trim();
  return cleaned || "report";
}

// Фильтрация по именам/id — так же, как filterAttendanceRows в attendanceReportUtils.js,
// т.к. lateEmployeesService не принимает массивы branches/departments/positions напрямую.
export function filterLateRows(rows, filter = {}) {
  const f = { branches: [], departments: [], employees: [], positions: [], ...filter };
  let result = rows;
  if (f.branches.length) result = result.filter((e) => f.branches.includes(e.branchName));
  if (f.departments.length) result = result.filter((e) => f.departments.includes(e.departmentName));
  if (f.employees.length) {
    const ids = f.employees.map(String);
    result = result.filter((e) => ids.includes(String(e.employeeId)));
  }
  if (f.positions.length) result = result.filter((e) => f.positions.includes(e.positionName));
  return result;
}
