export function prepareAttendanceData(data, fallbacks = { noBranch: "—", noDepartment: "—" }) {
  if (!data || !data.employees) return [];

  const presentIds = new Set(data.present.map((e) => e.employeeId));
  const absentIds = new Set(data.absent.map((e) => e.employeeId));
  const insideIds = new Set(data.inside.map((e) => e.employeeId));
  const leftIds = new Set(data.left.map((e) => e.employeeId));
  const lateIds = new Set(data.late.map((e) => e.employeeId));
  const onTimeOffIds = new Set((data.onTimeOff || []).map((e) => e.employeeId));

  const presentMap = new Map(data.present.map((e) => [e.employeeId, { firstEntry: e.firstEntry, firstEntryDoor: e.firstEntryDoor || null, timeOff: e.timeOff || null }]));
  const leftMap = new Map(data.left.map((e) => [e.employeeId, e.lastExit]));
  const lateMap = new Map(data.late.map((e) => [e.employeeId, e.lateMinutes]));
  const onTimeOffMap = new Map((data.onTimeOff || []).map((e) => [e.employeeId, e.timeOff]));
  const absentTimeOffMap = new Map(data.absent.map((e) => [e.employeeId, e.timeOff || null]));

  const branchSortMap = new Map(
    (data.branches || []).map((b) => [b.name, b.sort_order ?? 0]),
  );
  const positionSortMap = new Map(
    (data.positions || []).map((p) => [p.name, p.sort_order ?? 0]),
  );

  const branchesMap = {};

  data.employees.forEach((emp) => {
    const branchName = emp.branchName || fallbacks.noBranch;
    const departmentName = emp.departmentName || fallbacks.noDepartment;
    const branchSortOrder = branchSortMap.get(emp.branchName) ?? 0;
    const positionSortOrder = positionSortMap.get(emp.positionName) ?? 0;

    if (!branchesMap[branchName]) {
      branchesMap[branchName] = {
        name: branchName,
        sort_order: branchSortOrder,
        totalEmployees: 0,
        present: 0,
        absent: 0,
        inside: 0,
        left: 0,
        late: 0,
        onTimeOff: 0,
        employees: [],
        departments: {},
      };
    }

    const branch = branchesMap[branchName];
    branch.totalEmployees += 1;
    if (presentIds.has(emp.id)) branch.present += 1;
    if (absentIds.has(emp.id)) branch.absent += 1;
    if (insideIds.has(emp.id)) branch.inside += 1;
    if (leftIds.has(emp.id)) branch.left += 1;
    if (lateIds.has(emp.id)) branch.late += 1;
    if (onTimeOffIds.has(emp.id)) branch.onTimeOff += 1;

    const employeeRecord = {
      employeeId: emp.id,
      employeeFullName: emp.employeeFullName,
      employeeNumber: emp.employeeNumber,
      employeePhoto: emp.employeePhoto,
      branchName: emp.branchName,
      branchSortOrder,
      departmentName: emp.departmentName,
      positionName: emp.positionName,
      positionSortOrder,
      present: presentIds.has(emp.id),
      absent: absentIds.has(emp.id),
      inside: insideIds.has(emp.id),
      left: leftIds.has(emp.id),
      late: lateIds.has(emp.id),
      onTimeOff: onTimeOffIds.has(emp.id),
      firstEntry: presentMap.get(emp.id)?.firstEntry || null,
      firstEntryDoor: presentMap.get(emp.id)?.firstEntryDoor || null,
      lastExit: leftMap.get(emp.id) || null,
      lateMinutes: lateMap.get(emp.id) || 0,
      timeOffInfo:
        presentMap.get(emp.id)?.timeOff ||
        onTimeOffMap.get(emp.id) ||
        absentTimeOffMap.get(emp.id) ||
        null,
    };
    branch.employees.push(employeeRecord);

    if (!branch.departments[departmentName]) {
      branch.departments[departmentName] = {
        name: departmentName,
        totalEmployees: 0,
        present: 0,
        absent: 0,
        inside: 0,
        left: 0,
        late: 0,
        onTimeOff: 0,
        employees: [],
      };
    }

    const dept = branch.departments[departmentName];
    dept.totalEmployees += 1;
    if (presentIds.has(emp.id)) dept.present += 1;
    if (absentIds.has(emp.id)) dept.absent += 1;
    if (insideIds.has(emp.id)) dept.inside += 1;
    if (leftIds.has(emp.id)) dept.left += 1;
    if (lateIds.has(emp.id)) dept.late += 1;
    if (onTimeOffIds.has(emp.id)) dept.onTimeOff += 1;
    dept.employees.push(employeeRecord);
  });

  const byPositionThenName = (a, b) =>
    (a.positionSortOrder ?? 0) - (b.positionSortOrder ?? 0) ||
    a.employeeFullName.localeCompare(b.employeeFullName, "ru", { sensitivity: "base" });

  return Object.values(branchesMap)
    .map((branch) => ({
      ...branch,
      employees: [...branch.employees].sort(byPositionThenName),
      departments: Object.values(branch.departments).map((dept) => ({
        ...dept,
        employees: [...dept.employees].sort(byPositionThenName),
      })),
    }))
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.name.localeCompare(b.name, "ru", { sensitivity: "base" }),
    );
}
