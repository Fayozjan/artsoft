import { DateTime } from "luxon";

import {
  generateAttendanceReport,
  countScheduledDays,
  countScheduledMinutes,
} from "../../utils/attendanceUtils.js";
import { buildCalendarContext } from "../../utils/productionCalendar.utils.js";
import { EmployeeEfficiencyModel } from "./employeeEfficiency.model.js";
import {
  COMPONENT_WEIGHTS,
  clamp,
  round1,
  hhmmToMinutes,
  scoreAttendance,
  scorePunctuality,
  scoreWorkload,
  scoreTasks,
  overtimeBonus,
  weightedScore,
  gradeFor,
  effectiveWeights,
} from "./employeeEfficiency.helpers.js";

const ZONE = "Asia/Tashkent";
const DEFAULT_MONTHS = 3;
const MAX_MONTHS = 12;

const TASK_RESOLVED = new Set(["done", "confirmed"]);
const TASK_OPEN = new Set(["assigned", "in_progress"]);

// Пустая составляющая — когда данных для расчёта нет вообще
const emptyComponent = (key) => ({
  key,
  weight: COMPONENT_WEIGHTS[key],
  score: 0,
  applicable: false,
  effectiveWeight: 0,
});

// Дни с реальными проходами: синтетические сессии отпусков и оплачиваемых
// отгулов сюда не попадают — в них нельзя опоздать или уйти раньше
function countAttendedDays(sessions) {
  return Object.values(sessions || {}).filter((s) => s.events?.length > 0).length;
}

function collectEarlyLeaves(sessions) {
  let days = 0;
  let minutes = 0;

  Object.values(sessions || {}).forEach((s) => {
    const m = hhmmToMinutes(s.earlyLeave);
    if (m > 0) {
      days++;
      minutes += m;
    }
  });

  return { days, minutes };
}

// Разбор задач периода. Задача в работе с ненаступившим дедлайном в оценке
// не участвует — исполнитель ещё не опоздал.
function summarizeTasks(tasks, now) {
  let resolved = 0;
  let onTime = 0;
  let overdueClosed = 0;
  let openOverdue = 0;
  let inProgress = 0;

  for (const task of tasks) {
    const deadline = task.deadline ? new Date(task.deadline) : null;

    if (TASK_RESOLVED.has(task.status)) {
      resolved++;
      const completed = task.completed_at ? new Date(task.completed_at) : null;
      // Задача без дедлайна считается закрытой в срок
      if (!deadline || (completed && completed <= deadline)) onTime++;
      else overdueClosed++;
      continue;
    }

    if (TASK_OPEN.has(task.status)) {
      if (deadline && deadline < now) openOverdue++;
      else inProgress++;
    }
  }

  return {
    total: tasks.length,
    resolved,
    onTime,
    overdueClosed,
    openOverdue,
    inProgress,
  };
}

export const EmployeeEfficiencyService = {
  // Эффективность за последние `months` календарных месяцев (текущий включён
  // до сегодняшнего дня). Период обрезается датой приёма — до найма нормы нет.
  get: async (employeeId, { months } = {}) => {
    const monthsCount = clamp(
      Math.trunc(Number(months) || DEFAULT_MONTHS),
      1,
      MAX_MONTHS,
    );

    const loaded =
      await EmployeeEfficiencyModel.getEmployeeWithSchedule(employeeId);
    if (!loaded) return null;

    const { employee, scheduleHistory } = loaded;

    const now = DateTime.now().setZone(ZONE);
    const periodEnd = now.endOf("day");

    const hireRaw =
      (await EmployeeEfficiencyModel.getHireDate(employeeId)) ||
      employee.added_at;
    const hireDate = hireRaw
      ? DateTime.fromJSDate(new Date(hireRaw), { zone: ZONE }).startOf("day")
      : null;

    let periodStart = now.minus({ months: monthsCount - 1 }).startOf("month");
    if (hireDate && hireDate > periodStart) periodStart = hireDate;

    const period = {
      from: periodStart.toFormat("yyyy-MM-dd"),
      to: periodEnd.toFormat("yyyy-MM-dd"),
      months: monthsCount,
      hireDate: hireDate ? hireDate.toFormat("yyyy-MM-dd") : null,
    };

    if (periodStart > periodEnd) {
      return {
        employeeId: employee.id,
        period,
        hasData: false,
        score: 0,
        grade: "low",
        bonus: 0,
        trend: null,
        components: Object.keys(COMPONENT_WEIGHTS).map(emptyComponent),
        metrics: null,
        monthly: [],
      };
    }

    // Сутки назад — чтобы ночная смена, начавшаяся до периода, разобралась целиком
    const rangeFrom = periodStart.minus({ days: 1 }).startOf("day").toJSDate();
    const rangeTo = periodEnd.toJSDate();

    const [facePasses, timeOffRows, calendarOverrides, tasks] =
      await Promise.all([
        EmployeeEfficiencyModel.getFacePasses(employeeId, rangeFrom, rangeTo),
        EmployeeEfficiencyModel.getTimeOff(employeeId, rangeFrom, rangeTo),
        EmployeeEfficiencyModel.getCalendarOverrides(rangeFrom, rangeTo),
        EmployeeEfficiencyModel.getTasks(
          employeeId,
          periodStart.toJSDate(),
          rangeTo,
        ),
      ]);

    const calendarCtx = buildCalendarContext(calendarOverrides);
    const hasSchedule = scheduleHistory.length > 0;

    const attendanceInput = [
      {
        employeeId: Number(employee.id),
        employeeNumber: employee.employee_number,
        employeeFullName: [
          employee.last_name,
          employee.first_name,
          employee.middle_name,
        ]
          .filter(Boolean)
          .join(" "),
        employeePhoto: employee.photo || null,
        branchName: employee.branch?.name || null,
        departmentName: employee.department?.name || null,
        positionName: employee.position?.name || null,
        pinfl: employee.pinfl || null,
        workScheduleName: employee.workSchedule?.name || null,
        workSchedule: scheduleHistory,
        events: facePasses.map((p) => ({
          id: p.id,
          date: p.date,
          identifier: p.identifier,
          direction: p.direction,
          doorId: p.door_id,
          doorName: p.door?.name || null,
          photo: p.photo || null,
        })),
      },
    ];

    const timeOffs = { data: timeOffRows };

    // ── Помесячный проход ────────────────────────────────────────────────────
    // Табель считается по календарным месяцам, поэтому период разбивается на
    // месяцы; норма каждого обрезается датой приёма и сегодняшним днём.
    const monthly = [];
    const totals = {
      scheduledDays: 0,
      scheduledMinutes: 0,
      workedDays: 0,
      attendedDays: 0,
      workedMinutes: 0,
      lateDays: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      earlyLeaveDays: 0,
      earlyLeaveMinutes: 0,
      paidTimeOffDays: 0,
    };

    let cursor = periodStart.startOf("month");
    while (cursor <= periodEnd) {
      const monthKey = cursor.toFormat("yyyy-MM");
      const monthFrom = DateTime.max(cursor, periodStart).startOf("day");
      const monthTo = DateTime.min(cursor.endOf("month"), periodEnd);

      const report = generateAttendanceReport(
        attendanceInput,
        timeOffs,
        monthKey,
        null,
        calendarCtx,
      )[0];

      const sessions = report?.sessions || {};

      // Норма считается отдельно от отчёта: тот отдаёт её за месяц целиком,
      // а нужен отрезок от даты приёма до сегодняшнего дня
      const scheduledDays = hasSchedule
        ? countScheduledDays(
            monthFrom.toJSDate(),
            monthTo.toJSDate(),
            scheduleHistory,
            calendarCtx,
          )
        : 0;
      const scheduledMinutes = hasSchedule
        ? countScheduledMinutes(
            monthFrom.toJSDate(),
            monthTo.toJSDate(),
            scheduleHistory,
            calendarCtx,
          )
        : 0;

      const workedDays = report?.totalWorkedDays || 0;
      const workedMinutes = hhmmToMinutes(report?.totalWorkedHours);
      const lateDays = report?.totalLateCount || 0;
      const lateMinutes = hhmmToMinutes(report?.totalLateTime);
      const overtimeMinutes = report?.totalOvertimeMinutes || 0;
      const attendedDays = countAttendedDays(sessions);
      const earlyLeave = collectEarlyLeaves(sessions);
      const paidTimeOffDays = report?.totalPaidTimeOffDays || 0;

      const monthComponents = [
        {
          key: "attendance",
          weight: COMPONENT_WEIGHTS.attendance,
          ...scoreAttendance({ scheduledDays, workedDays }),
        },
        {
          key: "punctuality",
          weight: COMPONENT_WEIGHTS.punctuality,
          ...scorePunctuality({ attendedDays, lateDays, lateMinutes }),
        },
        {
          key: "workload",
          weight: COMPONENT_WEIGHTS.workload,
          ...scoreWorkload({ workedMinutes, scheduledMinutes }),
        },
      ];

      const monthScore = weightedScore(monthComponents);

      monthly.push({
        month: monthKey,
        score: monthScore.hasData ? monthScore.score : null,
        scheduledDays,
        scheduledMinutes,
        workedDays,
        attendedDays,
        workedMinutes,
        lateDays,
        lateMinutes,
        overtimeMinutes,
      });

      totals.scheduledDays += scheduledDays;
      totals.scheduledMinutes += scheduledMinutes;
      totals.workedDays += workedDays;
      totals.attendedDays += attendedDays;
      totals.workedMinutes += workedMinutes;
      totals.lateDays += lateDays;
      totals.lateMinutes += lateMinutes;
      totals.overtimeMinutes += overtimeMinutes;
      totals.earlyLeaveDays += earlyLeave.days;
      totals.earlyLeaveMinutes += earlyLeave.minutes;
      totals.paidTimeOffDays += paidTimeOffDays;

      cursor = cursor.plus({ months: 1 }).startOf("month");
    }

    const taskStats = summarizeTasks(tasks, now.toJSDate());

    // ── Итоговый балл ────────────────────────────────────────────────────────
    const components = [
      {
        key: "attendance",
        weight: COMPONENT_WEIGHTS.attendance,
        ...scoreAttendance({
          scheduledDays: totals.scheduledDays,
          workedDays: totals.workedDays,
        }),
        details: {
          scheduledDays: totals.scheduledDays,
          workedDays: totals.workedDays,
          absentDays: Math.max(0, totals.scheduledDays - totals.workedDays),
          paidTimeOffDays: totals.paidTimeOffDays,
        },
      },
      {
        key: "punctuality",
        weight: COMPONENT_WEIGHTS.punctuality,
        ...scorePunctuality({
          attendedDays: totals.attendedDays,
          lateDays: totals.lateDays,
          lateMinutes: totals.lateMinutes,
        }),
        details: {
          attendedDays: totals.attendedDays,
          lateDays: totals.lateDays,
          lateMinutes: totals.lateMinutes,
          avgLateMinutes: totals.lateDays
            ? round1(totals.lateMinutes / totals.lateDays)
            : 0,
        },
      },
      {
        key: "workload",
        weight: COMPONENT_WEIGHTS.workload,
        ...scoreWorkload({
          workedMinutes: totals.workedMinutes,
          scheduledMinutes: totals.scheduledMinutes,
        }),
        details: {
          workedMinutes: totals.workedMinutes,
          scheduledMinutes: totals.scheduledMinutes,
          overtimeMinutes: totals.overtimeMinutes,
          earlyLeaveDays: totals.earlyLeaveDays,
          earlyLeaveMinutes: totals.earlyLeaveMinutes,
        },
      },
      {
        key: "tasks",
        weight: COMPONENT_WEIGHTS.tasks,
        ...scoreTasks(taskStats),
        details: taskStats,
      },
    ];

    const base = weightedScore(components);
    const bonus = base.hasData
      ? overtimeBonus({
          overtimeMinutes: totals.overtimeMinutes,
          scheduledMinutes: totals.scheduledMinutes,
          workedMinutes: totals.workedMinutes,
        })
      : 0;

    const score = base.hasData ? round1(clamp(base.score + bonus)) : 0;

    // Тренд — последний месяц против предыдущего; месяцы без данных пропускаем
    const scored = monthly.filter((m) => m.score !== null);
    const trend =
      scored.length >= 2
        ? {
            current: scored[scored.length - 1].score,
            previous: scored[scored.length - 2].score,
            delta: round1(
              scored[scored.length - 1].score - scored[scored.length - 2].score,
            ),
          }
        : null;

    return {
      employeeId: employee.id,
      period,
      hasData: base.hasData,
      score,
      grade: gradeFor(score),
      bonus,
      trend,
      components: effectiveWeights(components),
      metrics: totals,
      monthly,
    };
  },
};
