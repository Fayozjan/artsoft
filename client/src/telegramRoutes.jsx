import { Route } from "react-router-dom";

import BranchesPage from "./pages/BranchesPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import EmployeesPageTelegram from "./pages/EmployeesPageTelegram";
import FacePassesPageTelegram from "./pages/FacePassesPageTelegram";
import AttendancePageTelegram from "./pages/AttendancePageTelegram";
import LateEmployeesPage from "./pages/LateEmployeesPage";
import TimesheetPage from "./pages/TimesheetPage";
import WorkSchedulesPage from "./pages/WorkSchedulesPage";
import TimeOffPage from "./pages/TimeOffPage";
import HolidaysPage from "./pages/HolidaysPage";
import PositionsPage from "./pages/PositionsPage";
import UsersPage from "./pages/UsersPage";
import TelegramBotsPage from "./pages/TelegramBotsPage";
import DoorsPage from "./pages/DoorsPage";
import FaceDevicesPage from "./pages/FaceDevicesPage";
import VehiclePassesPageTelegram from "./pages/VehiclePassesPageTelegram";
import GatesPage from "./pages/GatesPage";
import VehicleCamerasPage from "./pages/VehicleCamerasPage";
import NotFoundPageTelegram from "./pages/NotFoundPageTelegram";
import HomePageTelegram from "./pages/HomePageTelegram";
import MorePageTelegram from "./pages/MorePageTelegram";

const telegramRoutes = (
  <>
    <Route path="home" element={<HomePageTelegram />} key="home" />,
    <Route path="more" element={<MorePageTelegram />} key="more" />,
    <Route path="branches" element={<BranchesPage />} key="branches" />,
    <Route path="departments" element={<DepartmentsPage />} key="departments" />
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
      element={<LateEmployeesPage />}
      key="late-employees"
    />
    ,
    <Route path="timesheet" element={<TimesheetPage />} key="timesheet" />,
    <Route
      path="work-schedules"
      element={<WorkSchedulesPage />}
      key="work-schedules"
    />
    ,
    <Route path="time-off" element={<TimeOffPage />} key="time-off" />,
    <Route path="holidays" element={<HolidaysPage />} key="holidays" />,
    <Route path="positions" element={<PositionsPage />} key="positions" />,
    <Route path="users" element={<UsersPage />} key="users" />,
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
    <Route path="*" element={<NotFoundPageTelegram />} />,
  </>
);

export default telegramRoutes;
