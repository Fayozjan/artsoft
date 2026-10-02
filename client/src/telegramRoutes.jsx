import { lazy } from "react";
import { Route } from "react-router-dom";

const BranchesPageTelegram = lazy(() => import("./pages/BranchesPageTelegram"));
const DepartmentsPageTelegram = lazy(() => import("./pages/DepartmentsPageTelegram"));
const EmployeesPageTelegram = lazy(() => import("./pages/EmployeesPageTelegram"));
const FacePassesPageTelegram = lazy(() => import("./pages/FacePassesPageTelegram"));
const AttendancePageTelegram = lazy(() => import("./pages/AttendancePageTelegram"));
const LateEmployeesPageTelegram = lazy(() => import("./pages/LateEmployeesPageTelegram"));
const TimesheetPageTelegram = lazy(() => import("./pages/TimesheetPageTelegram"));
const WorkSchedulesPageTelegram = lazy(() => import("./pages/WorkSchedulesPageTelegram"));
const TimeOffPageTelegram = lazy(() => import("./pages/TimeOffPageTelegram"));
const ProductionCalendarPage = lazy(() => import("./pages/ProductionCalendarPage"));
const PositionsPageTelegram = lazy(() => import("./pages/PositionsPageTelegram"));
const UsersPageTelegram = lazy(() => import("./pages/UsersPageTelegram"));
const TelegramBotsPage = lazy(() => import("./pages/TelegramBotsPage"));
const DoorsPage = lazy(() => import("./pages/DoorsPage"));
const FaceDevicesPage = lazy(() => import("./pages/FaceDevicesPage"));
const VehiclePassesPageTelegram = lazy(() => import("./pages/VehiclePassesPageTelegram"));
const GatesPage = lazy(() => import("./pages/GatesPage"));
const VehicleCamerasPage = lazy(() => import("./pages/VehicleCamerasPage"));
const NotFoundPageTelegram = lazy(() => import("./pages/NotFoundPageTelegram"));
import HomePageTelegram from "./pages/HomePageTelegram";
const MenuPageTelegram = lazy(() => import("./pages/MenuPageTelegram"));
const SettingsPageTelegram = lazy(() => import("./pages/SettingsPageTelegram"));
const FinancePageTelegram = lazy(() => import("./pages/FinancePageTelegram"));
const TasksPageTelegram = lazy(() => import("./pages/TasksPageTelegram"));
const StaffingPage = lazy(() => import("./pages/StaffingPage"));
const EmploymentOrdersPage = lazy(() => import("./pages/EmploymentOrdersPage"));
const AssetAssignmentsPageTelegram = lazy(() => import("./pages/AssetAssignmentsPageTelegram"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));
const CronTasksPage = lazy(() => import("./pages/CronTasksPage"));
const CanteenAllowancesPage = lazy(() => import("./pages/CanteenAllowancesPage"));
const CanteenDisplayPage = lazy(() => import("./pages/CanteenDisplayPage"));
const CanteenReportPage = lazy(() => import("./pages/CanteenReportPage"));
const OperationsPageTelegram = lazy(() => import("./pages/OperationsPageTelegram"));
const BatchReceiptsPageTelegram = lazy(() => import("./pages/BatchReceiptsPageTelegram"));
const WorkAcceptancePageTelegram = lazy(() => import("./pages/WorkAcceptancePageTelegram"));
const ProductionReportPageTelegram = lazy(() => import("./pages/ProductionReportPageTelegram"));

const telegramRoutes = (
  <>
    <Route path="home" element={<HomePageTelegram />} key="home" />,
    <Route path="finance" element={<FinancePageTelegram />} key="finance" />,
    <Route path="menu" element={<MenuPageTelegram />} key="menu" />,
    <Route
      path="settings"
      element={<SettingsPageTelegram />}
      key="settings"
    />
    ,
    <Route path="tasks" element={<TasksPageTelegram />} key="tasks" />,
    <Route path="branches" element={<BranchesPageTelegram />} key="branches" />,
    <Route
      path="departments"
      element={<DepartmentsPageTelegram />}
      key="departments"
    />
    ,
    <Route
      path="employees"
      element={<EmployeesPageTelegram />}
      key="employees"
    />
    ,
    <Route
      path="face-passes"
      element={<FacePassesPageTelegram />}
      key="face-passes"
    />
    ,
    <Route
      path="attendance"
      element={<AttendancePageTelegram />}
      key="attendance"
    />
    ,
    <Route
      path="late-employees"
      element={<LateEmployeesPageTelegram />}
      key="late-employees"
    />
    ,
    <Route path="timesheet" element={<TimesheetPageTelegram />} key="timesheet" />,
    <Route
      path="work-schedules"
      element={<WorkSchedulesPageTelegram />}
      key="work-schedules"
    />
    ,
    <Route path="time-off" element={<TimeOffPageTelegram />} key="time-off" />,
    <Route
      path="production-calendar"
      element={<ProductionCalendarPage />}
      key="production-calendar"
    />,
    <Route path="positions" element={<PositionsPageTelegram />} key="positions" />,
    <Route path="users" element={<UsersPageTelegram />} key="users" />,
    <Route
      path="telegram-bots"
      element={<TelegramBotsPage />}
      key="telegram-bots"
    />
    ,
    <Route path="doors" element={<DoorsPage />} key="doors" />,
    <Route
      path="face-devices"
      element={<FaceDevicesPage />}
      key="face-devices"
    />
    ,
    <Route
      path="vehicle-passes"
      element={<VehiclePassesPageTelegram />}
      key="vehicle-passes"
    />
    ,
    <Route path="gates" element={<GatesPage />} key="gates" />,
    <Route
      path="vehicle-cameras"
      element={<VehicleCamerasPage />}
      key="vehicle-cameras"
    />
    ,
    <Route path="staffing" element={<StaffingPage />} key="staffing" />
    <Route
      path="employment-orders"
      element={<EmploymentOrdersPage />}
      key="employment-orders"
    />
    <Route
      path="asset-assignments"
      element={<AssetAssignmentsPageTelegram />}
      key="asset-assignments"
    />
    <Route path="audit-logs" element={<AuditLogsPage />} key="audit-logs" />
    <Route path="cron-tasks" element={<CronTasksPage />} key="cron-tasks" />
    <Route
      path="canteen-allowances"
      element={<CanteenAllowancesPage />}
      key="canteen-allowances"
    />
    <Route
      path="canteen-display"
      element={<CanteenDisplayPage />}
      key="canteen-display"
    />
    <Route
      path="canteen-report"
      element={<CanteenReportPage />}
      key="canteen-report"
    />
    <Route
      path="operations"
      element={<OperationsPageTelegram />}
      key="operations"
    />
    <Route
      path="batch-receipts"
      element={<BatchReceiptsPageTelegram />}
      key="batch-receipts"
    />
    <Route
      path="work-acceptance"
      element={<WorkAcceptancePageTelegram />}
      key="work-acceptance"
    />
    <Route
      path="production-report"
      element={<ProductionReportPageTelegram />}
      key="production-report"
    />
    <Route path="*" element={<NotFoundPageTelegram />} />,
  </>
);

export default telegramRoutes;
