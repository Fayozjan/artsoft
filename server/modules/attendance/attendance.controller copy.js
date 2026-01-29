function normalizeDateKey(date) {
  if (typeof date === "string") return date;
  return new Date(date).toISOString().split("T")[0]; // yyyy-MM-dd
}

import { processEvents } from "../../utils/attendanceUtils.js";
import {
  getUserAccess,
  getFacePasses,
  getActiveEmployeesCount,
  getAllActiveEmployees,
} from "./attendance.model.js";

function transformEmployeeData(employees, targetDate) {
  const targetDateKey = normalizeDateKey(targetDate);

  return employees
    .map((employee) => {
      const sessions = employee.sessions_by_date[targetDateKey];
      if (!sessions?.length) return null;

      const session = sessions[0];
      const events = session.events;
      if (!events?.length) return null;

      const lastEvent = events.at(-1).event_type;
      const lastPhoto = events.at(-1).photo;

      return {
        employeeId: employee.employee_id,
        date: targetDateKey,
        firstEntry: session.firstEntry,
        lastExit: session.lastExit,
        lastEvent,
        employeeInfo: employee.employee_info,
        photo: lastPhoto,
        employeeNumber: employee.employee_number,
      };
    })
    .filter(Boolean);
}

function getDepartmentStats(employees, activeEmployeesCount) {
  return activeEmployeesCount
    .map((department) => {
      const departmentEmployees = employees.filter(
        (emp) => emp.employeeInfo.department_name === department.name
      );

      const arrivedEmployeeCount = departmentEmployees.length;
      const onSiteEmployeeCount = departmentEmployees.filter(
        (emp) =>
          emp.firstEntry && (emp.lastExit === null || emp.lastEvent === "entry")
      ).length;

      return {
        departmentName: department.name,
        departmentId: department.id,
        allEmployeeCount: Number(department.all_employee_count),
        arrivedEmployeeCount,
        onSiteEmployeeCount,
      };
    })
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

export async function getAttendanceStats(req, res) {
  try {
    const userId = req.user.id;
    const { formData } = req.query;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 2);

    // --- доступ пользователя ---
    const access = await getUserAccess(userId);
    if (!access) {
      return res.status(403).json({ error: "Пользователь не найден" });
    }

    // --- получаем события и сотрудников ---
    const [passesResult, activeEmployeesCount, allActiveEmployees] =
      await Promise.all([
        getFacePasses({ access, yesterday, today, formData }),
        getActiveEmployeesCount({ userId, formData }),
        getAllActiveEmployees({ access, formData }),
      ]);

    const events = passesResult;

    const allActiveEmployeesCount = activeEmployeesCount.reduce(
      (acc, cur) => acc + Number(cur.all_employee_count),
      0
    );

    // --- обработка ---
    const processedEvents = processEvents(events);

    const allArrivedEmployees = transformEmployeeData(processedEvents, today);

    const arrivedByDepartment = getDepartmentStats(
      allArrivedEmployees,
      activeEmployeesCount
    );

    const onSiteEmployeesCount = allArrivedEmployees.reduce(
      (acc, emp) => acc + Number(emp.lastEvent === "entry"),
      0
    );

    const leftEmployees = allArrivedEmployees.filter(
      (emp) => emp.lastEvent === "exit"
    );

    const arrivedIds = new Set(
      allArrivedEmployees.map((e) => Number(e.employeeId))
    );
    const absentEmployees = allActiveEmployees.filter(
      (emp) => !arrivedIds.has(emp.id)
    );

    res.json({
      success: true,
      data: {
        allArrivedEmployees,
        allActiveEmployeesCount,
        onSiteEmployeesCount,
        leftEmployees,
        arrivedByDepartment,
        absentEmployees,
      },
    });
  } catch (err) {
    console.error("Ошибка в getAttendanceStats:", err);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
}

export async function getAttendance(req, res) {
  try {
    const userId = req.user.id;
    const formData = req.query.formData;

    const data = await attendanceService.getAttendance({
      userId,
      formData,
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error("Ошибка в getAttendance:", err);

    res.status(err.status || 500).json({
      error: err.message || "Ошибка при обработке данных",
    });
  }
}
