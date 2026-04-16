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
  getSummary: async (userId) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const employeeWhere = buildEmployeeAccess(user);
    const branchWhere = buildBranchAccess(user);
    const deptWhere = buildDeptAccess(user);
    const { start: dayStart, end: dayEnd } = getDayRange();

    const [
      totalBranches,
      totalDepartments,
      totalEmployees,
      checkedInToday,
      checkedOutToday,
      timeOffToday,
      vehiclePassesToday,
    ] = await Promise.all([
      DashboardModel.countBranches(branchWhere),
      DashboardModel.countDepartments(deptWhere),
      DashboardModel.countEmployees(employeeWhere),
      DashboardModel.countCheckedInToday(dayStart, dayEnd, employeeWhere),
      DashboardModel.countCheckedOutToday(dayStart, dayEnd, employeeWhere),
      DashboardModel.countTimeOffToday(dayStart, dayEnd, employeeWhere),
      DashboardModel.countVehiclePassesToday(dayStart, dayEnd),
    ]);

    return {
      totalBranches,
      totalDepartments,
      totalEmployees,
      checkedInToday,
      checkedOutToday,
      timeOffToday,
      vehiclePassesToday,
    };
  },

  getAnalytics: async (userId) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const employeeWhere = buildEmployeeAccess(user);
    const { start: dayStart, end: dayEnd } = getDayRange();
    const last7Days = getLast7Days();
    const last6Months = getLast6Months();

    const [
      weeklyAttendance,
      employeesByBranch,
      doorTrafficByHour,
      hiringDynamics,
      topDepartments,
      branchActivity,
    ] = await Promise.all([
      DashboardModel.dailyAttendance(last7Days, employeeWhere),
      DashboardModel.employeesByBranch(employeeWhere),
      DashboardModel.doorTrafficByHour(dayStart, dayEnd, employeeWhere),
      DashboardModel.hiringDynamics(last6Months),
      DashboardModel.topDepartmentsByActivity(dayStart, dayEnd, employeeWhere),
      DashboardModel.branchActivity(dayStart, dayEnd, employeeWhere),
    ]);

    return {
      weeklyAttendance,
      employeesByBranch,
      doorTrafficByHour,
      hiringDynamics,
      topDepartments,
      branchActivity,
    };
  },

  getFeeds: async (userId) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const employeeWhere = buildEmployeeAccess(user);

    const [recentFacePasses, recentVehiclePasses, upcomingBirthdays, recentTimeOffs] =
      await Promise.all([
        DashboardModel.recentFacePasses(10, employeeWhere),
        DashboardModel.recentVehiclePasses(10),
        DashboardModel.upcomingBirthdays(7, employeeWhere),
        DashboardModel.recentTimeOffs(10, employeeWhere),
      ]);

    return {
      recentFacePasses,
      recentVehiclePasses,
      upcomingBirthdays,
      recentTimeOffs,
    };
  },
};
