import { generateAttendanceReport } from "../../utils/attendanceUtils.js";
import { getCalendarOverrides } from "./timesheet.model.js";
import {
  buildCalendarContext,
  serializeOverrides,
} from "../../utils/productionCalendar.utils.js";

import { FacePassesService } from "../facePasses/facePasses.service.js";
import { EmployeeService } from "../employees/employees.service.js";
import { TimeOffService } from "../timeOff/timeOff.service.js";
import { buildZeroEventStubs, buildScheduleHistoryMap } from "./timesheet.helpers.js";

// Строит месячный табель (сотрудник -> сессии по дням) без пагинации —
// используется крон-задачей tabel_report (Excel в Telegram). Форма filter совпадает
// с PRESET_FIELDS в client/src/components/TimesheetFilter.jsx — сохранённый пресет
// подставляется в config.filter без преобразования.
export async function getMonthTimesheet({ userId, month, filter = {} }) {
  const { branch_ids, department_ids, position_ids, employee_ids, status, hasEvents } = filter;

  const [year, monthValue] = month.split("-").map(Number);
  const start_date = new Date(year, monthValue - 1, 0, 0, 0, 0);
  const end_date = new Date(year, monthValue, 1, 23, 59, 59);

  const filters = {
    month,
    start_date,
    end_date,
    branch_ids,
    department_ids,
    position_ids,
    employee_ids,
    status,
  };

  const calendarOverrides = await getCalendarOverrides(month);

  const employees = await EmployeeService.getAll({
    userId,
    filters,
    page: 1,
    pageSize: 999999,
  });

  const events = await FacePassesService.getAll({
    userId,
    filters: { ...filters, employeeIds: employees.data.map((e) => e.id) },
  });

  const timeOffs = await TimeOffService.getAll({
    userId,
    filters: { ...filters, employeeIds: employees.data.map((e) => e.id) },
  });

  // Сотрудники без единого badge-события целиком выпадают из events (группировка
  // по face_passes) — без этого их company-paid отлучки/отгулы никогда не попадут
  // в generateAttendanceReport, т.к. функция обходит только attendanceData
  const historyByEmployee = await buildScheduleHistoryMap(employees.data.map((e) => e.id));
  const zeroEventStubs = buildZeroEventStubs(events, employees.data, historyByEmployee);
  const attendanceData = [...events, ...zeroEventStubs];

  // производственный календарь — чтобы нерабочие дни вычитались из плановых
  // дней/часов, а сокращённые уменьшали норму
  let processedEvents = generateAttendanceReport(
    attendanceData,
    timeOffs,
    month,
    null,
    buildCalendarContext(calendarOverrides),
  );

  const processedMap = new Map(
    processedEvents.map((e) => [String(e.employeeId), e]),
  );

  for (const emp of employees.data) {
    const key = String(emp.id);

    if (!processedMap.has(key)) {
      processedEvents.push({
        employeeId: key,
        employeeFullName: `${[emp.last_name, emp.first_name, emp.middle_name]
          .filter(Boolean)
          .join(" ")} (${key})`,
        employeePhoto: emp.photo || null,
        branchName: emp?.branch?.name,
        departmentName: emp?.department?.name,
        positionName: emp?.position?.name,
        pinfl: emp?.pinfl,
        workScheduleName: emp.work_schedule?.name,
        status: emp.status,
        sessions: {},
      });
    } else {
      processedMap.get(key).status = emp.status;
    }
  }

  // Company-paid отлучка засчитывается наравне с реальным badge-событием
  const hasEventsOrPaidTimeOff = (s) =>
    s.events?.length > 0 || s.timeOff?.isCompanyPaid;
  if (hasEvents === "yes") {
    processedEvents = processedEvents.filter((emp) =>
      Object.values(emp.sessions || {}).some(hasEventsOrPaidTimeOff),
    );
  } else if (hasEvents === "no") {
    processedEvents = processedEvents.filter(
      (emp) => !Object.values(emp.sessions || {}).some(hasEventsOrPaidTimeOff),
    );
  }

  return { processedEvents, calendar: serializeOverrides(calendarOverrides) };
}
