// Агрегация данных посещаемости за период по филиалам и отделам.
// В режиме «за период» разрез по сотрудникам не строится — только итоги групп.
export function prepareAttendancePeriodData(
  data,
  fallbacks = { noBranch: "—", noDepartment: "—" },
) {
  if (!data || !data.employees) return [];

  const statsMap = new Map(
    (data.periodStats || []).map((s) => [String(s.employeeId), s]),
  );

  const branchSortMap = new Map(
    (data.branches || []).map((b) => [b.name, b.sort_order ?? 0]),
  );

  const emptyTotals = () => ({
    totalEmployees: 0,
    scheduledDays: 0,
    workedDays: 0,
    absentDays: 0,
    timeOffDays: 0,
    lateDays: 0,
    lateMinutes: 0,
  });

  const addStats = (target, stats) => {
    target.totalEmployees += 1;
    target.scheduledDays += stats.scheduledDays || 0;
    target.workedDays += stats.workedDays || 0;
    target.absentDays += stats.absentDays || 0;
    target.timeOffDays += stats.timeOffDays || 0;
    target.lateDays += stats.lateDays || 0;
    target.lateMinutes += stats.lateMinutes || 0;
  };

  const withRate = (row) => ({
    ...row,
    attendanceRate:
      row.scheduledDays > 0
        ? Math.round((row.workedDays / row.scheduledDays) * 1000) / 10
        : 0,
  });

  const branchesMap = {};

  data.employees.forEach((emp) => {
    const branchName = emp.branchName || fallbacks.noBranch;
    const departmentName = emp.departmentName || fallbacks.noDepartment;
    const stats = statsMap.get(String(emp.id)) || {};

    if (!branchesMap[branchName]) {
      branchesMap[branchName] = {
        name: branchName,
        sort_order: branchSortMap.get(emp.branchName) ?? 0,
        ...emptyTotals(),
        departments: {},
      };
    }

    const branch = branchesMap[branchName];
    addStats(branch, stats);

    if (!branch.departments[departmentName]) {
      branch.departments[departmentName] = {
        name: departmentName,
        ...emptyTotals(),
      };
    }

    addStats(branch.departments[departmentName], stats);
  });

  return Object.values(branchesMap)
    .map((branch) =>
      withRate({
        ...branch,
        departments: Object.values(branch.departments)
          .map(withRate)
          .sort((a, b) =>
            a.name.localeCompare(b.name, "ru", { sensitivity: "base" }),
          ),
      }),
    )
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.name.localeCompare(b.name, "ru", { sensitivity: "base" }),
    );
}
