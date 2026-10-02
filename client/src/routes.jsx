import { lazy } from "react";
import { Route } from "react-router-dom";

const HomePage = lazy(() => import("./pages/HomePage"));
const BranchesPage = lazy(() => import("./pages/BranchesPage"));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const FacePassesPage = lazy(() => import("./pages/FacePassesPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const LateEmployeesPage = lazy(() => import("./pages/LateEmployeesPage"));
const TimesheetPage = lazy(() => import("./pages/TimesheetPage"));
const WorkSchedulesPage = lazy(() => import("./pages/WorkSchedulesPage"));
const TimeOffPage = lazy(() => import("./pages/TimeOffPage"));
const ProductionCalendarPage = lazy(() => import("./pages/ProductionCalendarPage"));
const PositionsPage = lazy(() => import("./pages/PositionsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const TelegramBotsPage = lazy(() => import("./pages/TelegramBotsPage"));
const DoorsPage = lazy(() => import("./pages/DoorsPage"));
const FaceDevicesPage = lazy(() => import("./pages/FaceDevicesPage"));
const VehiclePassesPage = lazy(() => import("./pages/VehiclePassesPage"));
const GatesPage = lazy(() => import("./pages/GatesPage"));
const VehicleCamerasPage = lazy(() => import("./pages/VehicleCamerasPage"));
const SalarySettingPage = lazy(() => import("./pages/SalarySettingPage"));
const PayrollPage = lazy(() => import("./pages/PayrollPage"));
const SalaryPayoutsPage = lazy(() => import("./pages/SalaryPayoutsPage"));
const StaffingPage = lazy(() => import("./pages/StaffingPage"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));
const EmploymentOrdersPage = lazy(() => import("./pages/EmploymentOrdersPage"));
const AssetAssignmentsPage = lazy(() => import("./pages/AssetAssignmentsPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const CronTasksPage = lazy(() => import("./pages/CronTasksPage"));
const BatchReceiptsPage = lazy(() => import("./pages/BatchReceiptsPage"));
const OperationsPage = lazy(() => import("./pages/OperationsPage"));
const WorkAcceptancePage = lazy(() => import("./pages/WorkAcceptancePage"));
const ProductionReportPage = lazy(() => import("./pages/ProductionReportPage"));
const CanteenAllowancesPage = lazy(() => import("./pages/CanteenAllowancesPage"));
const CanteenDisplayPage = lazy(() => import("./pages/CanteenDisplayPage"));
const CanteenReportPage = lazy(() => import("./pages/CanteenReportPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const SectionPage = lazy(() => import("./pages/SectionPage"));
const UnitsPage = lazy(() => import("./pages/UnitsPage"));
const ProductCategoriesPage = lazy(() => import("./pages/ProductCategoriesPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const AttributesPage = lazy(() => import("./pages/AttributesPage"));
const PartnerCategoriesPage = lazy(() => import("./pages/PartnerCategoriesPage"));
const PartnersPage = lazy(() => import("./pages/PartnersPage"));
const StockLocationsPage = lazy(() => import("./pages/StockLocationsPage"));
const WarehousesPage = lazy(() => import("./pages/WarehousesPage"));
const StockPickingTypesPage = lazy(() => import("./pages/StockPickingTypesPage"));
const StockPickingsPage = lazy(() => import("./pages/StockPickingsPage"));
const StockReportPage = lazy(() => import("./pages/StockReportPage"));
const CurrenciesPage = lazy(() => import("./pages/CurrenciesPage"));

const Routes = [
  <Route path="home" element={<HomePage />} key="home" />,
  <Route path="hr" element={<SectionPage />} key="hr" />,
  <Route path="finance" element={<SectionPage />} key="finance" />,
  <Route path="canteen" element={<SectionPage />} key="canteen" />,
  <Route path="production" element={<SectionPage />} key="production" />,
  <Route path="stock" element={<SectionPage />} key="stock" />,
  <Route path="settings" element={<SectionPage />} key="settings" />,
  <Route path="branches" element={<BranchesPage />} key="branches" />,
  <Route path="departments" element={<DepartmentsPage />} key="departments" />,
  <Route path="employees" element={<EmployeesPage />} key="employees" />,
  <Route path="face-passes" element={<FacePassesPage />} key="face-passes" />,
  <Route path="attendance" element={<AttendancePage />} key="attendance" />,
  <Route
    path="late-employees"
    element={<LateEmployeesPage />}
    key="late-employees"
  />,
  <Route path="timesheet" element={<TimesheetPage />} key="timesheet" />,
  <Route
    path="work-schedules"
    element={<WorkSchedulesPage />}
    key="work-schedules"
  />,
  <Route path="time-off" element={<TimeOffPage />} key="time-off" />,
  <Route
    path="production-calendar"
    element={<ProductionCalendarPage />}
    key="production-calendar"
  />,
  <Route path="positions" element={<PositionsPage />} key="positions" />,
  <Route path="users" element={<UsersPage />} key="users" />,
  <Route
    path="telegram-bots"
    element={<TelegramBotsPage />}
    key="telegram-bots"
  />,
  <Route path="doors" element={<DoorsPage />} key="doors" />,
  <Route
    path="face-devices"
    element={<FaceDevicesPage />}
    key="face-devices"
  />,

  <Route
    path="salary-settings"
    element={<SalarySettingPage />}
    key="salary-settings"
  />,
  <Route path="payroll" element={<PayrollPage />} key="payroll" />,
  <Route
    path="salary-payouts"
    element={<SalaryPayoutsPage />}
    key="salary-payouts"
  />,
  <Route
    path="vehicle-passes"
    element={<VehiclePassesPage />}
    key="vehicle-passes"
  />,
  <Route path="gates" element={<GatesPage />} key="gates" />,
  <Route
    path="vehicle-cameras"
    element={<VehicleCamerasPage />}
    key="vehicle-cameras"
  />,
  <Route path="staffing" element={<StaffingPage />} key="staffing" />,
  <Route path="audit-logs" element={<AuditLogsPage />} key="audit-logs" />,
  <Route path="employment-orders" element={<EmploymentOrdersPage />} key="employment-orders" />,
  <Route
    path="asset-assignments"
    element={<AssetAssignmentsPage />}
    key="asset-assignments"
  />,
  <Route path="tasks" element={<TasksPage />} key="tasks" />,
  <Route path="cron-tasks" element={<CronTasksPage />} key="cron-tasks" />,

  <Route
    path="canteen-allowances"
    element={<CanteenAllowancesPage />}
    key="canteen-allowances"
  />,
  <Route
    path="canteen-display"
    element={<CanteenDisplayPage />}
    key="canteen-display"
  />,
  <Route
    path="canteen-report"
    element={<CanteenReportPage />}
    key="canteen-report"
  />,
  <Route
    path="batch-receipts"
    element={<BatchReceiptsPage />}
    key="batch-receipts"
  />,
  <Route path="operations" element={<OperationsPage />} key="operations" />,
  <Route
    path="work-acceptance"
    element={<WorkAcceptancePage />}
    key="work-acceptance"
  />,
  <Route
    path="production-report"
    element={<ProductionReportPage />}
    key="production-report"
  />,
  <Route path="units" element={<UnitsPage />} key="units" />,
  <Route
    path="product-categories"
    element={<ProductCategoriesPage />}
    key="product-categories"
  />,
  <Route path="products" element={<ProductsPage />} key="products" />,
  <Route path="attributes" element={<AttributesPage />} key="attributes" />,
  <Route
    path="partner-categories"
    element={<PartnerCategoriesPage />}
    key="partner-categories"
  />,
  <Route path="partners" element={<PartnersPage />} key="partners" />,
  <Route
    path="stock-locations"
    element={<StockLocationsPage />}
    key="stock-locations"
  />,
  <Route path="warehouses" element={<WarehousesPage />} key="warehouses" />,
  <Route
    path="stock-picking-types"
    element={<StockPickingTypesPage />}
    key="stock-picking-types"
  />,
  <Route
    path="stock-pickings"
    element={<StockPickingsPage />}
    key="stock-pickings"
  />,
  <Route
    path="stock-report"
    element={<StockReportPage />}
    key="stock-report"
  />,
  <Route path="currencies" element={<CurrenciesPage />} key="currencies" />,

  <Route path="*" element={<NotFoundPage />} />,
];

export default Routes;
