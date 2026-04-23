import { Router } from "express";
import express from "express";

import branchesRoutes from "../modules/branches/branches.routes.js";
import departmentRoutes from "../modules/departments/departments.routes.js";
import employeesRoutes from "../modules/employees/employees.routes.js";
import employmentOrderRoutes from "../modules/employmentOrders/employmentOrders.routes.js";
import employeeScheduleHistoryRoutes from "../modules/employeeScheduleHistory/employeeScheduleHistory.routes.js";
import employeeSalaryHistoryRoutes from "../modules/employeeSalaryHistory/employeeSalaryHistory.routes.js";
import attendance from "../modules/attendance/attendance.routes.js";
import timesheet from "../modules/timesheet/timesheet.routes.js";
import lateEmployeesRouter from "../modules/lateEmployees/lateEmployees.routes.js";
import facePassesRouter from "../modules/facePasses/facePasses.routes.js";
import vehiclePassesRouter from "../modules/vehiclePasses/vehiclePasses.routes.js";
import workScheduleRoutes from "../modules/workSchedules/workSchedules.routes.js";
import timeOff from "../modules/timeOff/timeOff.routes.js";
import holidays from "../modules/holidays/holidays.routes.js";
import positionsRoutes from "../modules/positions/positions.routes.js";
import usersRoutes from "../modules/users/users.routes.js";
import telegramBots from "../modules/telegramBots/telegramBots.routes.js";
import doorsRoutes from "../modules/doors/doors.routes.js";
import gatesRoutes from "../modules/gates/gates.routes.js";
import faceDevicesRoutes from "../modules/faceDevices/faceDevices.routes.js";
import anprCamerasRoutes from "../modules/anprCameras/anprCameras.routes.js";
import employeeDoorTasks from "../modules/employeeDoorTasks/employeeDoorTasks.routes.js";
import menusRoutes from "../modules/menus/menus.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import payrollRoutes from "../modules/payroll/payroll.routes.js";

const router = Router();

// Auth
router.use("/auth", authRoutes);

// Modules
router.use("/branches", branchesRoutes);
router.use("/departments", departmentRoutes);
router.use("/employees", employeesRoutes);
router.use("/employment-orders", employmentOrderRoutes);
router.use("/employee-schedule-history", employeeScheduleHistoryRoutes);
router.use("/employee-salary-history", employeeSalaryHistoryRoutes);
router.use("/face-passes", facePassesRouter);
router.use("/vehicle-passes", vehiclePassesRouter);
router.use("/attendance", attendance);
router.use("/late-employees", lateEmployeesRouter);
router.use("/timesheet", timesheet);
router.use("/work-schedules", workScheduleRoutes);
router.use("/time-off", timeOff);
router.use("/holidays", holidays);
router.use("/positions", positionsRoutes);
router.use("/users", usersRoutes);
router.use("/telegram-bots", telegramBots);
router.use("/doors", doorsRoutes);
router.use("/gates", gatesRoutes);
router.use("/face-devices", faceDevicesRoutes);
router.use("/anpr-cameras", anprCamerasRoutes);
router.use("/employee-door-tasks", employeeDoorTasks);
router.use("/menus", menusRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/payroll", payrollRoutes);

export default router;
