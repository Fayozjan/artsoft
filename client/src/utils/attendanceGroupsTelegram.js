// Модели карточек «филиал / отдел» для Telegram-версии посещаемости.
// Один формат для режимов «за день» и «за период» — рисует AttendanceGroupsTelegram.

import { STATUS_META, percent } from "./attendanceTelegram";

const norm = (value) => String(value || "").toLowerCase();

// Оставляет ветки дерева «филиал → отделы», подходящие под выбранную группу и поиск.
// Поиск совпал с филиалом — показываем все его отделы, иначе только совпавшие.
const filterTree = (rows, { scope = {}, query = "" }) => {
  const q = norm(query.trim());

  return rows
    .filter((row) => !scope.branch || row.name === scope.branch)
    .map((row) => ({
      ...row,
      departments: row.departments.filter(
        (dept) =>
          (!scope.department || dept.name === scope.department) &&
          (!q || norm(dept.name).includes(q) || norm(row.name).includes(q)),
      ),
    }))
    .filter((row) => row.departments.length > 0);
};

// Разворачивает дерево в плоский список отделов (для вида «по отделам»)
const flattenDepartments = (rows) =>
  rows.flatMap((row) =>
    row.departments.map((dept) => ({ ...dept, branchName: row.name })),
  );

const buildGroups = (rows, { view, describe, showBranchName }) => {
  if (view === "departments") {
    return flattenDepartments(rows).map((dept) => ({
      key: `${dept.branchName}|${dept.name}`,
      name: dept.name,
      subtitle: showBranchName ? dept.branchName : undefined,
      isBranch: false,
      select: { branch: dept.branchName, department: dept.name },
      ...describe(dept),
    }));
  }

  return rows.map((row) => ({
    key: row.name,
    name: row.name,
    isBranch: true,
    select: { branch: row.name },
    ...describe(row),
    departments: row.departments.map((dept) => ({
      key: `${row.name}|${dept.name}`,
      name: dept.name,
      select: { branch: row.name, department: dept.name },
      ...describe(dept),
    })),
  }));
};

// ── За день ──────────────────────────────────────────────────────────────────

const describeDay = (isToday, t) => (stats) => {
  const keys = ["present", "absent", "late", ...(isToday ? ["inside", "left"] : [])];

  const counters = keys.map((key) => ({
    key,
    tone: STATUS_META[key].tone,
    value: stats[key],
    label: t(STATUS_META[key].labelKey),
  }));

  if (stats.onTimeOff > 0) {
    counters.push({
      key: "onTimeOff",
      tone: STATUS_META.onTimeOff.tone,
      value: stats.onTimeOff,
      label: t(STATUS_META.onTimeOff.labelKey),
    });
  }

  return {
    total: stats.totalEmployees,
    count: `${stats.present}/${stats.totalEmployees}`,
    rate: percent(stats.present, stats.totalEmployees),
    bar: [
      { tone: "green", value: stats.present },
      { tone: "teal", value: stats.onTimeOff },
      { tone: "red", value: stats.absent },
    ],
    counters,
  };
};

// branches — результат prepareAttendanceData; view: "branches" | "departments"
export const buildDayGroups = (branches, { view, isToday, t, scope, query }) =>
  buildGroups(filterTree(branches, { scope, query }), {
    view,
    describe: describeDay(isToday, t),
    showBranchName: branches.length > 1,
  });

// ── За период ────────────────────────────────────────────────────────────────

const describePeriod = (t) => (stats) => {
  const counters = [
    { key: "worked", tone: "green", value: stats.workedDays, label: t("attendanceTg.workedShort") },
    { key: "absent", tone: "red", value: stats.absentDays, label: t("attendanceTg.absentShort") },
    { key: "late", tone: "amber", value: stats.lateDays, label: t("attendanceTg.lateShort") },
  ];

  if (stats.timeOffDays > 0) {
    counters.push({
      key: "timeOff",
      tone: "teal",
      value: stats.timeOffDays,
      label: t("attendanceTg.timeOffShort"),
    });
  }

  return {
    total: stats.totalEmployees,
    count: `${stats.workedDays}/${stats.scheduledDays}`,
    rate: stats.scheduledDays > 0 ? Math.round(stats.attendanceRate) : null,
    bar: [
      { tone: "green", value: stats.workedDays },
      { tone: "teal", value: stats.timeOffDays },
      { tone: "red", value: stats.absentDays },
    ],
    counters,
  };
};

// rows — результат prepareAttendancePeriodData
export const buildPeriodGroups = (rows, { view, t, query }) =>
  buildGroups(filterTree(rows, { query }), {
    view,
    describe: describePeriod(t),
    showBranchName: rows.length > 1,
  });
