// Общее для Telegram-версии «Опоздания»: единая модель сотрудника для режимов
// «за день» и «за период», сводка, группы, дни и сортировка.

import { formatLateMinutesToHours } from "../helpers/time";

const num = (value) => Number(value) || 0;

const timeOf = (value) => (value ? String(value).slice(0, 5) : "");

// «04:20» — часы:минуты, целые минуты
export const hhmm = (minutes) => formatLateMinutesToHours(Math.max(0, Math.round(num(minutes))));

// «12 500» — сумма штрафа
export const formatMoney = (value) =>
  String(Math.round(num(value))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// ── Модель сотрудника ────────────────────────────────────────────────────────

const normalizeDetail = (row) => ({
  date: row.date,
  scheduled: timeOf(row.scheduledStart),
  actual: timeOf(row.actualStart),
  late: num(row.lateMinutes),
  breakEnd: timeOf(row.scheduledBreakEnd),
  breakReturn: timeOf(row.actualBreakReturn),
  breakLate: num(row.breakReturnLateMinutes),
  photo: row.actualStartPhoto || null,
  timeOff: row.timeOff || null,
});

const baseOf = (row) => ({
  key: String(row.employeeId),
  employeeId: row.employeeId,
  fullName: row.employeeFullName || "",
  number: row.employeeNumber,
  photo: row.employeePhoto || null,
  branch: row.branchName || "",
  department: row.departmentName || "",
  position: row.positionName || "",
});

// Строка режима «за день»: одна запись = один сотрудник = один день
const fromDayRow = (row) => {
  const detail = normalizeDetail(row);

  return {
    ...baseOf(row),
    minutes: detail.late,
    breakMinutes: detail.breakLate,
    count: detail.late > 0 ? 1 : 0,
    breakCount: detail.breakLate > 0 ? 1 : 0,
    money: num(row.dailyLateMoney),
    workDays: 0,
    attendedDays: 0,
    fallbackPhoto: detail.photo,
    details: [detail],
  };
};

// Строка режима «за период»: сотрудник с итогами и списком опозданий по дням
const fromPeriodRow = (row) => ({
  ...baseOf(row),
  minutes: num(row.monthlyLateMinutes),
  breakMinutes: num(row.monthlyBreakReturnLateMinutes),
  count: num(row.monthlyArrivalLateCount),
  breakCount: num(row.monthlyLunchLateCount),
  money: num(row.monthlyLateMoney),
  workDays: num(row.monthlyWorkDays),
  attendedDays: num(row.monthlyAttendedDays),
  fallbackPhoto: row.lastLatePhoto || null,
  details: (row.details || [])
    .map(normalizeDetail)
    .sort((a, b) => (a.date < b.date ? 1 : -1)),
});

export const buildLateEmployees = (data, isPeriod) => {
  if (isPeriod) {
    return (data?.lateEmployeesByMonth || []).map(fromPeriodRow);
  }
  return (Array.isArray(data) ? data : []).map(fromDayRow);
};

// Сколько раз человек опоздал (на приход и после перерыва)
export const occurrences = (emp) => emp.count + emp.breakCount;

// Минуты для ранжирования тяжести: если опоздания на приход нет — берём после перерыва
const severityMinutes = (emp) => (emp.minutes > 0 ? emp.minutes : emp.breakMinutes);

// ── Тяжесть опоздания (полоса и фильтры в шапке) ─────────────────────────────

export const SEVERITY_TONES = { low: "amber", mid: "orange", high: "red" };

export const severityOf = (emp, isPeriod) => {
  if (isPeriod) {
    const times = occurrences(emp);
    if (times <= 1) return "low";
    return times <= 3 ? "mid" : "high";
  }

  const minutes = severityMinutes(emp);
  if (minutes <= 10) return "low";
  return minutes <= 30 ? "mid" : "high";
};

// ── Сводка ───────────────────────────────────────────────────────────────────

export const summarize = (list) => {
  const totals = list.reduce(
    (acc, emp) => {
      acc.minutes += emp.minutes;
      acc.breakMinutes += emp.breakMinutes;
      acc.count += emp.count;
      acc.breakCount += emp.breakCount;
      acc.money += emp.money;
      return acc;
    },
    { minutes: 0, breakMinutes: 0, count: 0, breakCount: 0, money: 0 },
  );

  return {
    ...totals,
    people: list.length,
    average: list.length ? Math.round(totals.minutes / list.length) : 0,
  };
};

// ── Сортировка ───────────────────────────────────────────────────────────────

export const SORT_KEYS = ["minutes", "count", "money", "name"];

const byName = (a, b) => a.fullName.localeCompare(b.fullName, "ru", { sensitivity: "base" });

export const sortEmployees = (list, sortKey) => {
  const sorted = [...list];

  switch (sortKey) {
    case "name":
      return sorted.sort(byName);
    case "count":
      return sorted.sort(
        (a, b) => occurrences(b) - occurrences(a) || b.minutes - a.minutes || byName(a, b),
      );
    case "money":
      return sorted.sort((a, b) => b.money - a.money || b.minutes - a.minutes || byName(a, b));
    default:
      return sorted.sort(
        (a, b) =>
          severityMinutes(b) - severityMinutes(a) ||
          b.breakMinutes - a.breakMinutes ||
          byName(a, b),
      );
  }
};

// ── Поиск ────────────────────────────────────────────────────────────────────

export const matchesQuery = (emp, query) => {
  if (!query) return true;

  return [emp.fullName, emp.number, emp.position, emp.department, emp.branch].some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(query),
  );
};

// ── Группы: филиалы и отделы ─────────────────────────────────────────────────

// view: "branches" | "departments"; fallbacks — подписи для пустых названий
export const buildLateGroups = (list, { view, fallbacks, query }) => {
  const byDepartment = view === "departments";
  const map = new Map();

  list.forEach((emp) => {
    const branch = emp.branch || fallbacks.noBranch;
    const department = emp.department || fallbacks.noDepartment;
    const key = byDepartment ? `${branch}|${department}` : branch;

    if (!map.has(key)) {
      map.set(key, {
        key,
        name: byDepartment ? department : branch,
        branch,
        isBranch: !byDepartment,
        select: byDepartment ? { branch, department } : { branch },
        members: [],
      });
    }
    map.get(key).members.push(emp);
  });

  const q = (query || "").trim().toLowerCase();
  const groups = [...map.values()]
    .filter((group) => !q || group.name.toLowerCase().includes(q) || group.branch.toLowerCase().includes(q))
    .map(({ members, ...group }) => ({ ...group, ...summarize(members) }));

  const peak = Math.max(1, ...groups.map((group) => group.minutes + group.breakMinutes));

  return groups
    .map((group) => ({
      ...group,
      // доля группы в самом «тяжёлом» — для полосы
      share: Math.round(((group.minutes + group.breakMinutes) / peak) * 100),
    }))
    .sort(
      (a, b) =>
        b.people - a.people ||
        b.minutes - a.minutes ||
        a.name.localeCompare(b.name, "ru", { sensitivity: "base" }),
    );
};

// ── Дни периода ──────────────────────────────────────────────────────────────

// byBranchAndDay — data.lateByBranchAndDay; allowedIds — сотрудники, прошедшие фильтры
export const buildLateDays = (byBranchAndDay, allowedIds, fallbackBranch) => {
  const days = new Map();

  (byBranchAndDay || []).forEach((branch) => {
    (branch.days || []).forEach((day) => {
      const employees = (day.employees || []).filter((emp) =>
        allowedIds.has(String(emp.employeeId)),
      );
      if (employees.length === 0) return;

      if (!days.has(day.date)) {
        days.set(day.date, { date: day.date, count: 0, minutes: 0, branches: [] });
      }

      const target = days.get(day.date);
      const rows = employees
        .map((emp) => ({
          key: `${branch.branchName}|${emp.employeeId}`,
          employeeId: emp.employeeId,
          fullName: emp.employeeFullName || "",
          photo: emp.employeePhoto || null,
          department: emp.departmentName || "",
          position: emp.positionName || "",
          scheduled: timeOf(emp.scheduledStart),
          actual: timeOf(emp.actualStart),
          late: num(emp.lateMinutes),
          breakLate: num(emp.breakReturnLateMinutes),
          timeOff: emp.timeOff || null,
        }))
        .sort((a, b) => b.late - a.late || a.fullName.localeCompare(b.fullName, "ru"));

      target.count += rows.length;
      target.minutes += rows.reduce((sum, row) => sum + row.late, 0);
      target.branches.push({
        name: branch.branchName || fallbackBranch,
        count: rows.length,
        employees: rows,
      });
    });
  });

  return [...days.values()]
    .map((day) => ({
      ...day,
      branches: day.branches.sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
};
