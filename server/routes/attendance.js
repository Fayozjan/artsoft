import express from "express";
import pool from "../db.js";
import { processEvents } from "../utils/attendanceUtils.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

function transformEmployeeData(employees, targetDate) {
  return employees
    .map((employee) => {
      // Фильтруем сессии по targetDate
      const sessions = employee.sessions_by_date[targetDate];

      if (sessions && sessions.length > 0) {
        const session = sessions[0]; // Если на одну дату несколько сессий, можно выбрать первую
        const events = session.events;

        // Если есть события, обрабатываем
        if (events && events.length > 0) {
          const lastEvent = events[events.length - 1].event_type;
          const lastPhoto = events[events.length - 1].photo;

          return {
            employeeId: employee.employee_id,
            date: targetDate,
            firstEntry: session.firstEntry,
            lastExit: session.lastExit,
            lastEvent: lastEvent,
            employeeInfo: employee.employee_info,
            photo: lastPhoto,
            employeeNumber: employee.employee_number,
          };
        }
      }

      return null; // Возвращаем null, если не подошло
    })
    .filter((employee) => employee !== null); // Убираем null
}

function getDepartmentStats(employees, activeEmployeesCount) {
  const stats = activeEmployeesCount.map((department) => {
    // Получаем всех сотрудников данного отдела
    const departmentEmployees = employees.filter(
      (employee) => employee.employeeInfo.department_name === department.name
    );

    // Подсчитываем количество прибывших пользователей (событие entry)
    const arrivedEmployeeCount = departmentEmployees.length;

    // Подсчитываем количество пользователей, которые находятся на рабочем месте
    const onSiteEmployeeCount = departmentEmployees.filter(
      (employee) =>
        employee.firstEntry &&
        (employee.lastExit === null || employee.lastEvent === "entry")
    ).length;

    return {
      departmentName: department.name,
      departmentId: department.id,
      allEmployeeCount: Number(department.all_employee_count),
      arrivedEmployeeCount: arrivedEmployeeCount,
      onSiteEmployeeCount: onSiteEmployeeCount,
    };
  });

  // Сортировка по department_name по алфавиту
  return stats.sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { formData } = req.query;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 2);

    const todayString = today.toISOString().split("T")[0];
    const yesterdayString = yesterday.toISOString().split("T")[0];

    // === Достаём права пользователя ===
    const userAccess = await pool.query(
      `
        SELECT
          u.access_level,
          u.branches AS access_branches,
          u.departments AS access_departments,
          e.branch_id AS employee_branch_id,
          e.department_id AS employee_department_id
        FROM users u
        JOIN employees e ON e.id = u.employee_id
        WHERE u.id = $1;
      `,
      [userId]
    );

    if (!userAccess.rows.length) {
      return res.status(403).json({ error: "Пользователь не найден" });
    }

    const {
      access_level,
      employee_branch_id,
      employee_department_id,
      access_branches,
      access_departments,
    } = userAccess.rows[0];

    // === Условия ===
    let conditions = [];
    let values = [yesterdayString, todayString];
    let paramIndex = values.length + 1;

    let activeEmployeesConditions = [];
    let activeEmployeesValues = [];
    let activeIndex = 1;

    const addCond = (arr, cond, val, valuesArr, idxRef) => {
      if (val !== undefined && val !== null && val !== "") {
        arr.push(cond.replace("?", `$${idxRef.value}`));
        valuesArr.push(val);
        idxRef.value++;
      }
    };

    // === Ограничения доступа ===
    if (access_level === "branch" && employee_branch_id) {
      addCond(conditions, "e.branch_id = ?", employee_branch_id, values, {
        value: paramIndex,
      });
      addCond(
        activeEmployeesConditions,
        "e.branch_id = ?",
        employee_branch_id,
        activeUsersValues,
        { value: activeIndex }
      );
    }

    if (
      access_level === "multi-branch" &&
      Array.isArray(access_branches) &&
      access_branches.length > 0
    ) {
      const placeholders = access_branches
        .map((_, i) => `$${paramIndex + i}`)
        .join(", ");
      conditions.push(`e.branch_id IN (${placeholders})`);
      values.push(...access_branches.map(Number));
      paramIndex += access_branches.length;

      const activePlaceholders = access_branches
        .map((_, i) => `$${activeIndex + i}`)
        .join(", ");
      activeEmployeesConditions.push(`e.branch_id IN (${activePlaceholders})`);
      activeEmployeesValues.push(...access_branches.map(Number));
      activeIndex += access_branches.length;
    }

    if (access_level === "department" && employee_department_id) {
      addCond(
        conditions,
        "e.department_id = ?",
        employee_department_id,
        values,
        { value: paramIndex }
      );
      addCond(
        activeEmployeesConditions,
        "e.department_id = ?",
        employee_department_id,
        activeUsersValues,
        { value: activeIndex }
      );
    }

    if (
      access_level === "multi-department" &&
      Array.isArray(access_departments) &&
      access_departments.length > 0
    ) {
      if (formData.department_id) {
        addCond(
          conditions,
          "e.department_id = ?",
          Number(formData.department_id),
          values,
          { value: paramIndex }
        );
        addCond(
          activeEmployeesConditions,
          "e.department_id = ?",
          Number(formData.department_id),
          activeUsersValues,
          { value: activeIndex }
        );
      } else {
        const placeholders = access_departments
          .map((_, i) => `$${paramIndex + i}`)
          .join(", ");
        conditions.push(`e.department_id IN (${placeholders})`);
        values.push(...access_departments.map(Number));
        paramIndex += access_departments.length;

        const activePlaceholders = access_departments
          .map((_, i) => `$${activeIndex + i}`)
          .join(", ");
        activeEmployeesConditions.push(
          `e.department_id IN (${activePlaceholders})`
        );
        activeUsersValues.push(...access_departments.map(Number));
        activeIndex += access_departments.length;
      }
    }

    // === Дополнительные фильтры ===
    if (formData.branch_id) {
      addCond(conditions, "e.branch_id = ?", formData.branch_id, values, {
        value: paramIndex,
      });
      addCond(
        activeEmployeesConditions,
        "e.branch_id = ?",
        formData.branch_id,
        activeEmployeesValues,
        { value: activeIndex }
      );
    }

    if (formData.department_id) {
      addCond(
        conditions,
        "e.department_id = ?",
        formData.department_id,
        values,
        { value: paramIndex }
      );
      addCond(
        activeEmployeesConditions,
        "e.department_id = ?",
        formData.department_id,
        activeEmployeesValues,
        { value: activeIndex }
      );
    }

    const whereConditions =
      conditions.length > 0 ? " AND " + conditions.join(" AND ") : "";

    activeEmployeesConditions.push(
      `(e.status = 'active' OR e.status = 'true')`
    );

    // === Запросы ===
    const passesQuery = `
      SELECT
        f.employee_id,
        to_char(f.event_time, 'YYYY-MM-DD HH24:MI:SS') AS event_time_string,
        f.event_type,
        e.branch_id,
        b.name AS branch_name,
        e.department_id,
        d.name AS department_name,
        e.position_id,
        p.name AS position_name,
        e.name,
        e.surname,
        e.patronymic,
        e.photo,
        e.employee_number,
        ws.name AS shift_name,
        ws.shift_type,
        ws.shift_start,
        ws.shift_end,
        ws.first_shift_start,
        ws.first_shift_end,
        ws.second_shift_start,
        ws.second_shift_end,
        ws.third_shift_start,
        ws.third_shift_end,
        ws.grace_period
      FROM face_passes f
      JOIN employees e ON f.employee_id = e.id
      JOIN branches b ON e.branch_id = b.id
      JOIN departments d ON e.department_id = d.id
      JOIN positions p ON e.position_id = p.id
      JOIN work_schedules ws ON e.work_schedule_id = ws.id
      WHERE f.event_time::date >= $1 AND f.event_time::date <= $2
      ${whereConditions}
      ORDER BY f.employee_id, f.event_time;
    `;

    const activeEmployeesQuery = `
      SELECT 
        d.id,
        d.name, 
        COUNT(e.id) AS all_employee_count
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      WHERE ${activeEmployeesConditions.join(" AND ")}
      GROUP BY d.id, d.name;
    `;

    const [passesResult, activeEmployeesCountResult] = await Promise.all([
      pool.query(passesQuery, values),
      pool.query(activeEmployeesQuery, activeEmployeesValues),
    ]);

    const allActiveEmployeesQuery = `
      SELECT 
        e.id,
        e.name,
        e.surname,
        e.patronymic,
        e.photo,
        e.employee_number,
        e.department_id,
        p.name AS position_name,
        d.name AS department_name
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      JOIN positions p ON e.position_id = p.id
      WHERE ${activeEmployeesConditions.join(" AND ")};
    `;

    const allActiveEmployeesResult = await pool.query(
      allActiveEmployeesQuery,
      activeEmployeesValues
    );

    const allActiveEmployees = allActiveEmployeesResult.rows;

    // === Логика обработки ===
    const events = passesResult.rows;
    const activeEmployeesCount = activeEmployeesCountResult.rows;

    const allActiveEmployeesCount = activeEmployeesCount.reduce(
      (acc, current) => acc + Number(current.all_employee_count),
      0
    );

    const processedEvents = processEvents(events);

    const allArrivedEmployees = transformEmployeeData(
      processedEvents,
      todayString
    );
    const arrivedByDepartment = getDepartmentStats(
      allArrivedEmployees,
      activeEmployeesCount
    );

    const onSiteEmployeesCount = allArrivedEmployees.reduce(
      (acc, current) => acc + Number(current.lastEvent === "entry"),
      0
    );
    const leftEmployees = allArrivedEmployees.filter(
      (current) => current.lastEvent === "exit"
    );

    const arrivedEmployeesIds = new Set(
      allArrivedEmployees.map((employee) => Number(employee.employee_id))
    );
    const absentEmployees = allActiveEmployees.filter(
      (employee) => !arrivedEmployeesIds.has(employee.employee_id)
    );

    res.status(200).json({
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
    console.error("Ошибка:", err);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
});

/*
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { formData } = req.body;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 2);

    const todayString = today.toISOString().split("T")[0];
    const yesterdayString = yesterday.toISOString().split("T")[0];

    // === Достаём права пользователя ===
    const userAccess = await pool.query(
      `
        SELECT
          u.access_level,
          u.branches AS access_branches,
          u.departments AS access_departments,
          e.branch_id AS employee_branch_id,
          e.department_id AS employee_department_id
        FROM users u
        JOIN employees e ON e.id = u.employee_id
        WHERE u.id = $1;
      `,
      [userId]
    );

    if (!userAccess.rows.length) {
      return res.status(403).json({ error: "Пользователь не найден" });
    }

    const {
      access_level,
      employee_branch_id,
      employee_department_id,
      access_branches,
      access_departments,
    } = userAccess.rows[0];

    // === Условия ===
    let conditions = [];
    let values = [yesterdayString, todayString];
    let paramIndex = values.length + 1;

    let activeEmployeesConditions = [];
    let activeEmployeesValues = [];
    let activeIndex = 1;

    if (accessLevel === "department" && userDepId) {
      conditions.push(`u.department_id = $${paramIndex}`);
      values.push(Number(userDepId));
      paramIndex++;

      activeUsersConditions.push(`u.department_id = $${activeIndex}`);
      activeUsersValues.push(Number(userDepId));
      activeIndex++;
    } else if (accessLevel === "multi-department") {
      if (formData.department_id) {
        // Пользователь выбрал конкретный отдел — фильтруем только по нему
        conditions.push(`u.department_id = $${paramIndex}`);
        values.push(Number(formData.department_id));
        paramIndex++;

        activeUsersConditions.push(`u.department_id = $${activeIndex}`);
        activeUsersValues.push(Number(formData.department_id));
        activeIndex++;
      } else {
        // Иначе фильтруем по всем доступным отделам
        const placeholders = accessDepartments.map(
          (_, i) => `$${paramIndex + i}`
        );
        conditions.push(`u.department_id IN (${placeholders.join(", ")})`);
        values.push(...accessDepartments.map(Number));
        paramIndex += accessDepartments.length;

        const activePlaceholders = accessDepartments.map(
          (_, i) => `$${activeIndex + i}`
        );
        activeUsersConditions.push(
          `u.department_id IN (${activePlaceholders.join(", ")})`
        );
        activeUsersValues.push(...accessDepartments.map(Number));
        activeIndex += accessDepartments.length;
      }
    } else {
      if (formData.branch_id) {
        conditions.push(`u.branch_id = $${paramIndex}`);
        values.push(formData.branch_id);
        paramIndex++;

        activeUsersConditions.push(`u.branch_id = $${activeIndex}`);
        activeUsersValues.push(formData.branch_id);
        activeIndex++;
      }

      if (formData.department_id) {
        conditions.push(`u.department_id = $${paramIndex}`);
        values.push(formData.department_id);
        paramIndex++;

        activeUsersConditions.push(`u.department_id = $${activeIndex}`);
        activeUsersValues.push(formData.department_id);
        activeIndex++;
      }
    }

    const whereConditions =
      conditions.length > 0 ? " AND " + conditions.join(" AND ") : "";

    activeUsersConditions.push(`(u.status = 'active' OR u.status = 'true')`);

    const eventsQuery = `
    SELECT
      e.user_id,
      to_char(e.event_time, 'YYYY-MM-DD HH24:MI:SS') AS event_time_string,
      e.event_type,
      u.branch_id,
      b.name AS branch_name,
      u.department_id,
      d.name AS department_name,
      u.position_id,
      p.name AS position_name,
      u.name,
      u.surname,
      u.patronymic,
      u.photo,
      u.employee_number,
      ws.name AS shift_name,
      ws.shift_type,
      ws.shift_start,
      ws.shift_end,
      ws.first_shift_start,
      ws.first_shift_end,
      ws.second_shift_start,
      ws.second_shift_end,
      ws.third_shift_start,
      ws.third_shift_end,
      ws.grace_period
  FROM events e
  JOIN users u ON e.user_id = u.user_id
  JOIN branch b ON u.branch_id = b.id
  JOIN departments d ON u.department_id = d.id
  JOIN position p ON u.position_id = p.id
  JOIN work_schedules ws ON u.work_schedule_id = ws.id
  WHERE e.event_time::date >= $1 AND e.event_time::date <= $2
  ${whereConditions}
  ORDER BY e.user_id, e.event_time;
    `;

    // Запрос для подсчета активных пользователей
    const activeUsersQuery = `
      SELECT 
        d.id,
        d.name, 
        COUNT(u.user_id) AS all_user_count
      FROM 
        users u
      JOIN 
        departments d ON u.department_id = d.id
      WHERE 
        ${activeUsersConditions.join(" AND ")}
      GROUP BY 
         d.id, d.name;
    `;

    // Получаем события и количество активных пользователей
    const [eventsResult, activeUsersCountResult] = await Promise.all([
      pool.query(eventsQuery, values),
      pool.query(activeUsersQuery, activeUsersValues),
    ]);

    const allActiveUsersQuery = `
        SELECT 
          u.user_id,
          u.name,
          u.surname,
          u.patronymic,
          u.photo,
          u.employee_number,
          u.department_id,
          p.name AS position_name,
          d.name AS department_name
        FROM 
          users u
        JOIN 
          departments d ON u.department_id = d.id
        JOIN 
          position p ON u.position_id = p.id
        WHERE 
          ${activeUsersConditions.join(" AND ")};
      `;

    const allActiveUsersResult = await pool.query(
      allActiveUsersQuery,
      activeUsersValues
    );
    const allActiveUsers = allActiveUsersResult.rows;

    const events = eventsResult.rows;
    const activeUsersCount = activeUsersCountResult.rows;
    const allActiveUsersCount = activeUsersCount.reduce((acc, current) => {
      return acc + Number(current.all_user_count);
    }, 0);

    const processedEvents = processEvents(events);

    const allArrivedUsers = transformUserData(processedEvents, todayString);

    const arrivedByDepartment = getDepartmentStats(
      allArrivedUsers,
      activeUsersCount
    );

    const onSiteUsersCount = allArrivedUsers.reduce((acc, current) => {
      return acc + Number(current.lastEvent === "entry");
    }, 0);

    const leftUsers = allArrivedUsers.filter((current) => {
      return current.lastEvent === "exit";
    });

    const arrivedUserIds = new Set(
      allArrivedUsers.map((user) => Number(user.user_id))
    );

    const absentUsers = allActiveUsers.filter(
      (user) => !arrivedUserIds.has(user.user_id)
    );

    res.status(200).json({
      success: true,
      allArrivedUsers: allArrivedUsers,
      allActiveUsersCount: allActiveUsersCount,
      onSiteUsersCount: onSiteUsersCount,
      leftUsers: leftUsers,
      arrivedByDepartment: arrivedByDepartment,
      absentUsers: absentUsers,
    });
  } catch (err) {
    console.error("Ошибка:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
});
*/

export default router;
