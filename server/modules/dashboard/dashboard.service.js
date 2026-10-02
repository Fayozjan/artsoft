import { UserModel } from "../users/users.model.js";
import { DashboardModel } from "./dashboard.model.js";

function buildEmployeeAccess(user) {
  if (user.access_level === "absolute") return {};
  if (user.access_level === "branch") {
    return { branch_id: { in: user.branch_access || [] } };
  }
  if (user.access_level === "department") {
    return { department_id: { in: user.department_access || [] } };
  }
  return {};
}

function buildBranchAccess(user) {
  if (user.access_level === "absolute") return {};
  if (user.access_level === "branch") {
    return { id: { in: user.branch_access || [] } };
  }
  if (user.access_level === "department") {
    return {
      departments: { some: { id: { in: user.department_access || [] } } },
    };
  }
  return {};
}

function buildDeptAccess(user) {
  if (user.access_level === "absolute") return {};
  if (user.access_level === "branch") {
    return { branch_id: { in: user.branch_access || [] } };
  }
  if (user.access_level === "department") {
    return { id: { in: user.department_access || [] } };
  }
  return {};
}

// задачи привязаны к сотруднику / отделу / должности / пользователю,
// поэтому доступ считаем через исполнителя-сотрудника или отдел-исполнитель
function buildTaskAccess(user, branchId = null) {
  const conditions = [];

  if (user.access_level === "branch") {
    conditions.push({
      assignee_employee: { branch_id: { in: user.branch_access || [] } },
    });
  } else if (user.access_level === "department") {
    conditions.push({
      OR: [
        { assignee_employee: { department_id: { in: user.department_access || [] } } },
        { assignee_department_id: { in: user.department_access || [] } },
      ],
    });
  }

  if (branchId) {
    conditions.push({ assignee_employee: { branch_id: Number(branchId) } });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

function getDayRange(date = new Date()) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const { start, end } = getDayRange(d);
    const label = d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
    days.push({ start, end, label });
  }
  return days;
}

function getLast30Days() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const { start, end } = getDayRange(d);
    const label = d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
    days.push({ start, end, label });
  }
  return days;
}

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
    months.push({ start, end, label });
  }
  return months;
}

export const DashboardService = {
  getSummary: async (userId, branchId = null) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const employeeWhere = buildEmployeeAccess(user);
    const branchWhere = buildBranchAccess(user);
    const deptWhere = buildDeptAccess(user);
    if (branchId) {
      employeeWhere.branch_id = Number(branchId);
      branchWhere.id = Number(branchId);
      deptWhere.branch_id = Number(branchId);
    }
    const { start: dayStart, end: dayEnd } = getDayRange();

    const [
      totalBranches,
      totalDepartments,
      totalEmployees,
      totalPositions,
      checkedInToday,
      checkedOutToday,
      timeOffToday,
      vehiclePassesToday,
      lateToday,
      currentlyOnSite,
    ] = await Promise.all([
      DashboardModel.countBranches(branchWhere),
      DashboardModel.countDepartments(deptWhere),
      DashboardModel.countEmployees(employeeWhere),
      DashboardModel.countPositions(),
      DashboardModel.countCheckedInToday(dayStart, dayEnd, employeeWhere),
      DashboardModel.countCheckedOutToday(dayStart, dayEnd, employeeWhere),
      DashboardModel.countTimeOffToday(dayStart, dayEnd, employeeWhere),
      DashboardModel.countVehiclePassesToday(dayStart, dayEnd),
      DashboardModel.countLateToday(dayStart, dayEnd, 9, 30, employeeWhere),
      DashboardModel.countCurrentlyOnSite(dayStart, dayEnd, employeeWhere),
    ]);

    return {
      totalBranches,
      totalDepartments,
      totalEmployees,
      totalPositions,
      checkedInToday,
      checkedOutToday,
      timeOffToday,
      vehiclePassesToday,
      lateToday,
      currentlyOnSite,
      absentToday: Math.max(0, totalEmployees - checkedInToday),
    };
  },

  getAnalytics: async (userId, branchId = null) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const employeeWhere = buildEmployeeAccess(user);
    if (branchId) employeeWhere.branch_id = Number(branchId);

    const orderWhere = {};
    if (user.access_level === "branch" && user.branch_access?.length) {
      orderWhere.branch_id = { in: user.branch_access };
    }
    if (branchId) orderWhere.branch_id = Number(branchId);

    const { start: dayStart, end: dayEnd } = getDayRange();
    const last7Days = getLast7Days();
    const last30Days = getLast30Days();
    const last6Months = getLast6Months();

    const [
      weeklyAttendance,
      monthlyAttendance,
      employeesByBranch,
      employeesByDepartment,
      doorTrafficByHour,
      vehicleTrafficByHour,
      hiringDynamics,
      weeklyHiringDynamics,
      topDepartments,
      branchActivity,
      topLateArrivals,
      topEarlyDepartures,
      employeesByPosition,
    ] = await Promise.all([
      DashboardModel.dailyAttendance(last7Days, employeeWhere),
      DashboardModel.dailyAttendance(last30Days, employeeWhere),
      DashboardModel.employeesByBranch(employeeWhere),
      DashboardModel.employeesByDepartment(employeeWhere),
      DashboardModel.doorTrafficByHour(dayStart, dayEnd, employeeWhere),
      DashboardModel.vehicleTrafficByHour(dayStart, dayEnd),
      DashboardModel.hiringDynamics(last6Months, orderWhere),
      DashboardModel.hiringDynamicsByDay(last7Days, orderWhere),
      DashboardModel.topDepartmentsByActivity(dayStart, dayEnd, employeeWhere),
      DashboardModel.branchActivity(dayStart, dayEnd, employeeWhere),
      DashboardModel.topLateArrivals(dayStart, dayEnd, 5, employeeWhere),
      DashboardModel.topEarlyDepartures(dayStart, dayEnd, 5, employeeWhere),
      DashboardModel.employeesByPosition(employeeWhere),
    ]);

    return {
      weeklyAttendance,
      monthlyAttendance,
      employeesByBranch,
      employeesByDepartment,
      doorTrafficByHour,
      vehicleTrafficByHour,
      hiringDynamics,
      weeklyHiringDynamics,
      topDepartments,
      branchActivity,
      topLateArrivals,
      topEarlyDepartures,
      employeesByPosition,
    };
  },

  getFeeds: async (userId, branchId = null) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const employeeWhere = buildEmployeeAccess(user);
    if (branchId) employeeWhere.branch_id = Number(branchId);
    const { start: dayStart, end: dayEnd } = getDayRange();

    const [recentFacePasses, recentVehiclePasses, vehiclePassesToday, upcomingBirthdays, recentTimeOffs] =
      await Promise.all([
        DashboardModel.recentFacePasses(10, employeeWhere),
        DashboardModel.recentVehiclePasses(10),
        DashboardModel.vehiclePassesToday(dayStart, dayEnd, 20),
        DashboardModel.upcomingBirthdays(7, employeeWhere),
        DashboardModel.recentTimeOffs(10, employeeWhere),
      ]);

    return {
      recentFacePasses,
      recentVehiclePasses,
      vehiclePassesToday,
      upcomingBirthdays,
      recentTimeOffs,
    };
  },

  getFinance: async (userId, branchId = null) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const employeeWhere = buildEmployeeAccess(user);
    if (branchId) employeeWhere.branch_id = Number(branchId);

    const [stats, recentPayments, salaryByBranch, salaryByDept] = await Promise.all([
      DashboardModel.financeStats(employeeWhere),
      DashboardModel.recentPayments(10, employeeWhere),
      DashboardModel.salaryByBranch(employeeWhere),
      DashboardModel.salaryByDept(employeeWhere),
    ]);

    return { stats, recentPayments, salaryByBranch, salaryByDept };
  },

  getTasks: async (userId, branchId = null) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const taskWhere = buildTaskAccess(user, branchId);
    const now = new Date();

    const [total, byStatus, overdue, recentTasks, upcomingDeadlines] = await Promise.all([
      DashboardModel.countTasks(taskWhere),
      DashboardModel.tasksByStatus(taskWhere),
      DashboardModel.countTasks({
        ...taskWhere,
        deadline: { lt: now },
        status: { notIn: ["done", "confirmed", "cancelled"] },
      }),
      DashboardModel.recentTasks(5, taskWhere),
      DashboardModel.upcomingTaskDeadlines(5, taskWhere, now),
    ]);

    const statusCount = Object.fromEntries(byStatus.map((s) => [s.status, s.count]));

    return {
      stats: {
        total,
        draft: statusCount.draft ?? 0,
        assigned: statusCount.assigned ?? 0,
        inProgress: statusCount.in_progress ?? 0,
        done: statusCount.done ?? 0,
        confirmed: statusCount.confirmed ?? 0,
        cancelled: statusCount.cancelled ?? 0,
        completed: (statusCount.done ?? 0) + (statusCount.confirmed ?? 0),
        overdue,
      },
      byStatus,
      recentTasks,
      upcomingDeadlines,
    };
  },
};
