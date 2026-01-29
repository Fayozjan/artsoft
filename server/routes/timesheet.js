import express from "express";
import pool from "../db.js";
import { eachDayOfInterval, format, addHours } from "date-fns";

import { processEvents } from "../utils/attendanceUtils.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

function filterSessionsByMonth(data, selectedMonth) {
  return data.map((entry) => {
    const filteredSessions = {};

    for (const date in entry.sessions_by_date) {
      if (date.startsWith(selectedMonth)) {
        filteredSessions[date] = entry.sessions_by_date[date];
      }
    }

    return {
      ...entry,
      sessions_by_date: filteredSessions,
    };
  });
}

function formatResultForTelegram(data, baseDate) {
  // выделяем строку даты в формате YYYY-MM-DD
  const filterDate = baseDate.toISOString().split("T")[0];

  return data
    .map((user) => {
      const sessionsForDate = user.sessions_by_date[filterDate];
      if (!sessionsForDate || sessionsForDate.length === 0) {
        return null; // Пропускаем
      }

      const session = sessionsForDate[0];

      return {
        user_id: user.user_id,
        name: `${user.user_info.surname || ""} ${user.user_info.name || ""} ${
          user.user_info.patronymic || ""
        }`,
        position: user.user_info.position_name,
        department: user.user_info.department_name,
        entry: session.firstEntry,
        exit: session.lastExit,
        workDuration: session.workDuration,
        date: filterDate,
      };
    })
    .filter(Boolean);
}

async function getEmployeeTripsMap(startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT 
      employee_id, 
      CASE 
        WHEN type = 'day' 
          THEN to_char((date_from AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD')
        ELSE 
          to_char(date_from AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI:SS')
      END AS date_from,
      CASE 
        WHEN type = 'day' 
          THEN to_char((date_to AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD')
        ELSE 
          to_char(date_to AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI:SS')
      END AS date_to,
      is_company_paid,
      reason,
      permission_number,
      credited_hours,
      type
    FROM leave_permissions
    WHERE date_from <= $2 AND date_to >= $1
  `,
    [startDate, endDate]
  );

  const tripsMap = {};
  for (const trip of rows) {
    if (!tripsMap[trip.user_id]) tripsMap[trip.user_id] = [];
    tripsMap[trip.user_id].push(trip);
  }
  return tripsMap;
}

function getAdjustedTimes(dateFrom, dateTo, creditedHours = null) {
  const hasTimeFrom = typeof dateFrom === "string" && dateFrom.includes(":");
  const hasTimeTo = typeof dateTo === "string" && dateTo.includes(":");

  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  const firstEntry = hasTimeFrom ? format(start, "HH:mm") : null;
  const lastExit = hasTimeTo ? format(end, "HH:mm") : null;

  let workDuration = null;

  if (typeof creditedHours === "number" && creditedHours > 0) {
    workDuration = `${String(creditedHours).padStart(2, "0")}:00`;
  } else if (hasTimeFrom && hasTimeTo) {
    const diffMs = end - start;
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    workDuration = `${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}`;
  }

  if (creditedHours !== null && !hasTimeFrom && !hasTimeTo) {
    return {
      firstEntry: null,
      lastExit: null,
      workDuration,
      date_from: format(start, "yyyy-MM-dd"),
      time_range: null,
    };
  }

  return {
    firstEntry,
    lastExit,
    workDuration,
    date_from: hasTimeFrom
      ? format(start, "yyyy-MM-dd HH:mm:ss")
      : format(start, "yyyy-MM-dd"),
    date_to: hasTimeTo
      ? format(end, "yyyy-MM-dd HH:mm:ss")
      : format(end, "yyyy-MM-dd"),
    time_range:
      creditedHours !== null
        ? null
        : hasTimeFrom && hasTimeTo
        ? `${firstEntry} - ${lastExit}`
        : null,
  };
}

function injectPermissionsIntoSessions(result, tripsMap, startDate, endDate) {
  const days = eachDayOfInterval({ start: startDate, end: endDate }).map((d) =>
    format(d, "yyyy-MM-dd")
  );

  for (const user of result) {
    const userTrips = tripsMap[user.user_id] || [];

    for (const trip of userTrips) {
      if (!trip.is_company_paid) continue;

      const tripStart = trip.date_from.slice(0, 10);
      const tripEnd = trip.date_to.slice(0, 10);

      for (const day of days) {
        if (day >= tripStart && day <= tripEnd) {
          if (!user.sessions_by_date[day]) {
            const {
              firstEntry,
              lastExit,
              workDuration,
              date_from,
              date_to,
              time_range,
            } = getAdjustedTimes(
              trip.date_from,
              trip.date_to,
              trip.credited_hours
            );

            // Если передан credited_hours и дата без времени → оставляем только дату
            const noTimeInDates =
              !trip.date_from.includes(":") && !trip.date_to.includes(":");

            user.sessions_by_date[day] = [
              {
                hasPermission: true,
                firstEntry,
                lastExit,
                workDuration,
                events: [
                  {
                    leave_request: {
                      reason: trip.reason,
                      permission_number: trip.permission_number,
                      date_from: noTimeInDates
                        ? trip.date_from.slice(0, 10)
                        : date_from,
                      date_to: noTimeInDates
                        ? trip.date_to.slice(0, 10)
                        : date_to,
                      time_range,
                      company_paid: trip.is_company_paid ? "Да" : "Нет",
                      type: trip.type,
                      credited_hours: trip.credited_hours ?? 0,
                    },
                  },
                ],
              },
            ];
          }
        }
      }
    }
  }

  return result;
}

router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;

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

  try {
    const { month, branch_id, department_id, position_id, employee_id } =
      req.query;

    if (!month) {
      return res.status(400).json({ error: "Месяц не выбран" });
    }

    const [year, monthValue] = month.split("-").map(Number);

    // === Условия для фильтрации ===
    let conditions = [];
    let values = [];
    let paramIndex = 1;

    const addCond = (cond, val) => {
      if (val !== undefined && val !== null && val !== "") {
        conditions.push(cond.replace("?", `$${paramIndex}`));
        values.push(val);
        paramIndex++;
      }
    };

    // --- Ограничения по access_level ---
    if (access_level === "branch" && employee_branch_id) {
      addCond("e.branch_id = ?", employee_branch_id);
    }

    if (access_level === "multi-branch" && Array.isArray(access_branches)) {
      if (access_branches.length > 0) {
        const placeholders = access_branches
          .map((_, i) => `$${paramIndex + i}`)
          .join(", ");
        conditions.push(`e.branch_id IN (${placeholders})`);
        values.push(...access_branches.map(Number));
        paramIndex += access_branches.length;
      }
    }

    if (access_level === "department" && employee_department_id) {
      addCond("e.department_id = ?", employee_department_id);
    }

    if (
      access_level === "multi-department" &&
      Array.isArray(access_departments)
    ) {
      if (access_departments.length > 0) {
        const placeholders = access_departments
          .map((_, i) => `$${paramIndex + i}`)
          .join(", ");
        conditions.push(`e.department_id IN (${placeholders})`);
        values.push(...access_departments.map(Number));
        paramIndex += access_departments.length;
      }
    }

    // --- Дополнительные query-фильтры ---
    if (branch_id) {
      addCond("e.branch_id = ?", Number(branch_id));
    }
    if (department_id) {
      addCond("e.department_id = ?", Number(department_id));
    }
    if (position_id) {
      addCond("e.position_id = ?", Number(position_id));
    }
    if (employee_id) {
      addCond("e.id = ?", Number(employee_id));
    }

    const startOfMonth = new Date(year, monthValue - 1, 1);
    const endOfMonth = new Date(year, monthValue, 0, 23, 59, 59);

    const previousDay = new Date(startOfMonth);
    previousDay.setDate(previousDay.getDate() - 1);
    previousDay.setHours(0, 0, 0, 0);

    const whereConditions =
      conditions.length > 0 ? " AND " + conditions.join(" AND ") : "";

    // === Запрос событий ===
    const eventsQuery = `
      SELECT
        f.employee_id,
        to_char(f.event_time, 'YYYY-MM-DD HH24:MI:SS') AS event_time_string,
        f.event_type,
        f.event_photo,
        f.door_name,
        e.branch_id,
        b.name AS branch_name,
        e.department_id,
        d.name AS department_name,
        e.position_id,
        p.name AS position_name,
        e.name,
        e.surname,
        e.patronymic,
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
        ws.grace_period,
        ws.break_minutes
      FROM face_passes f
      JOIN employees e ON f.employee_id = e.id
      JOIN branches b ON e.branch_id = b.id
      JOIN departments d ON e.department_id = d.id
      JOIN positions p ON e.position_id = p.id
      JOIN work_schedules ws ON e.work_schedule_id = ws.id
      WHERE f.event_time >= $${paramIndex} AND f.event_time <= $${
      paramIndex + 1
    }
      ${whereConditions}
      ORDER BY f.employee_id, f.event_time;
    `;

    values.push(previousDay.toISOString(), endOfMonth.toISOString());

    const { rows: events } = await pool.query(eventsQuery, values);

    // --- Получаем праздники ---
    const holidaysQuery = `
      SELECT 
        id, 
        name, 
        TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from, 
        TO_CHAR(date_to, 'YYYY-MM-DD') AS date_to
      FROM holidays 
      WHERE 
      (EXTRACT(MONTH FROM date_from) = $1 AND EXTRACT(YEAR FROM date_from) = $2)
      OR 
      (EXTRACT(MONTH FROM date_to) = $1 AND EXTRACT(YEAR FROM date_to) = $2)
      ORDER BY date_from;
    `;

    const { rows: holidays } = await pool.query(holidaysQuery, [
      monthValue,
      year,
    ]);

    // --- Обработка событий ---
    const tripsMap = await getEmployeeTripsMap(
      previousDay.toISOString(),
      endOfMonth.toISOString()
    );

    const result = processEvents(events, tripsMap);
    const extendedResult = injectPermissionsIntoSessions(
      result,
      tripsMap,
      startOfMonth,
      endOfMonth
    );

    const filteredResult = filterSessionsByMonth(extendedResult, month);

    res.status(200).json({
      success: true,
      data: filteredResult,
      holidays,
    });
  } catch (err) {
    console.error("Ошибка:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
});

router.post("/by-users", async (req, res) => {
  try {
    const { date, user_ids } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: "User IDs array is required" });
    }

    const baseDate = new Date(date);

    // Начало диапазона: два дня до опорной даты
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() - 2);
    startDate.setHours(0, 0, 0, 0);

    // Конец диапазона: конец опорного дня
    const endDate = new Date(baseDate);
    endDate.setHours(23, 59, 59, 999);

    const eventsQuery = `
      SELECT
          e.user_id,
          to_char(e.event_time, 'YYYY-MM-DD HH24:MI:SS') AS event_time_string,
          e.event_type,
          e.event_photo,
          u.department_id,
          d.name AS department_name,
          u.position_id,
          p.name AS position_name,
          u.name,
          u.surname,
          u.patronymic,
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
          ws.grace_period,
          ws.break_minutes
      FROM events e
      JOIN users u ON e.user_id = u.user_id
      JOIN departments d ON u.department_id = d.id
      JOIN position p ON u.position_id = p.id
      JOIN work_schedules ws ON u.work_schedule_id = ws.id
      WHERE e.event_time >= $1 AND e.event_time <= $2
        AND u.user_id = ANY($3)
      ORDER BY e.user_id, e.event_time;
    `;

    const eventsValues = [
      startDate.toISOString(),
      endDate.toISOString(),
      user_ids,
    ];

    const { rows: events } = await pool.query(eventsQuery, eventsValues);

    const result = processEvents(events);
    const data = formatResultForTelegram(result, baseDate);

    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (err) {
    console.error("Ошибка:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
});

/*
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;

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

  try {
    const { month, branch_id, department_id, position_id, employee_id } =
      req.query;

    if (!month) {
      return res.status(400).json({ error: "Месяц не выбран" });
    }

    if (!branch_id && !department_id && !employee_id) {
      return res.status(400).json({
        error: "Нужно указать хотя бы филиал, отдел или пользователя",
      });
    }

    const [year, monthValue] = month.split("-").map(Number);

    // === Условия для фильтрации ===
    let conditions = [];
    let values = [];
    let paramIndex = 1;

    const addCond = (cond, val) => {
      if (val !== undefined && val !== null && val !== "") {
        conditions.push(cond.replace("?", `$${paramIndex}`));
        values.push(val);
        paramIndex++;
      }
    };

    // --- Ограничения по access_level ---
    if (access_level === "branch" && employee_branch_id) {
      addCond("u.branch_id = ?", employee_branch_id);
    }

    if (access_level === "multi-branch" && Array.isArray(access_branches)) {
      if (access_branches.length > 0) {
        const placeholders = access_branches
          .map((_, i) => `$${paramIndex + i}`)
          .join(", ");
        conditions.push(`u.branch_id IN (${placeholders})`);
        values.push(...access_branches.map(Number));
        paramIndex += access_branches.length;
      }
    }

    if (access_level === "department" && employee_department_id) {
      addCond("u.department_id = ?", employee_department_id);
    }

    if (
      access_level === "multi-department" &&
      Array.isArray(access_departments)
    ) {
      if (access_departments.length > 0) {
        const placeholders = access_departments
          .map((_, i) => `$${paramIndex + i}`)
          .join(", ");
        conditions.push(`u.department_id IN (${placeholders})`);
        values.push(...access_departments.map(Number));
        paramIndex += access_departments.length;
      }
    }

    // --- Дополнительные query-фильтры (разрешены только если access_level = "all") ---
    if (branch_id && access_level === "all") {
      addCond("u.branch_id = ?", Number(branch_id));
    }
    if (department_id && access_level === "all") {
      addCond("u.department_id = ?", Number(department_id));
    }
    if (position_id) {
      addCond("u.position_id = ?", Number(position_id));
    }
    if (employee_id) {
      addCond("u.user_id = ?", Number(employee_id));
    }

    // Запрос списка праздников за указанный месяц
    const holidaysQuery = `
      SELECT 
      id, 
      name, 
      TO_CHAR(date_from, 'YYYY-MM-DD') AS date_from, 
      TO_CHAR(date_to, 'YYYY-MM-DD') AS date_to
      FROM holidays 
      WHERE 
      (EXTRACT(MONTH FROM date_from) = $1 AND EXTRACT(YEAR FROM date_from) = $2)
      OR 
      (EXTRACT(MONTH FROM date_to) = $1 AND EXTRACT(YEAR FROM date_to) = $2)
      ORDER BY date_from;
    `;

    const holidaysValues = [monthValue, year];
    const { rows: holidays } = await pool.query(holidaysQuery, holidaysValues);

    const startOfMonth = new Date(year, monthValue - 1, 1);
    const endOfMonth = new Date(year, monthValue, 0, 23, 59, 59); // последний день месяца

    // Добавим начало предыдущего дня (для смен с пересечением границы месяца)
    const previousDay = new Date(startOfMonth);
    previousDay.setDate(previousDay.getDate() - 1);
    previousDay.setHours(0, 0, 0, 0);

    const eventsQuery = `
      SELECT
          e.user_id,
          to_char(e.event_time, 'YYYY-MM-DD HH24:MI:SS') AS event_time_string,
          e.event_type,
          e.event_photo,
          e.door_name,
          u.branch_id,
          b.name AS branch_name,
          u.department_id,
          d.name AS department_name,
          u.position_id,
          p.name AS position_name,
          u.name,
          u.surname,
          u.patronymic,
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
          ws.grace_period,
          ws.break_minutes
      FROM events e
      JOIN users u ON e.user_id = u.user_id
      JOIN branch b ON u.branch_id = b.id
      JOIN departments d ON u.department_id = d.id
      JOIN position p ON u.position_id = p.id
      JOIN work_schedules ws ON u.work_schedule_id = ws.id
      WHERE e.event_time >= $1 AND e.event_time <= $2
        AND ($3::int IS NULL OR u.department_id IS NOT DISTINCT FROM $3::int)
        AND ($4::int IS NULL OR u.position_id IS NOT DISTINCT FROM $4::int)
        AND ($5::int IS NULL OR u.user_id IS NOT DISTINCT FROM $5::int)
        AND ($6::int IS NULL OR u.branch_id IS NOT DISTINCT FROM $6::int)
      ORDER BY e.user_id, e.event_time;
    `;

    const eventsValues = [
      previousDay.toISOString(),
      endOfMonth.toISOString(),
      department_id,
      position_id,
      user_id,
      branch_id,
    ];

    const { rows: events } = await pool.query(eventsQuery, eventsValues);

    // Получаем отгулы
    const tripsMap = await getUserTripsMap(
      previousDay.toISOString(),
      endOfMonth.toISOString()
    );

    const result = processEvents(events, tripsMap);
    const extendedResult = injectPermissionsIntoSessions(
      result,
      tripsMap,
      startOfMonth,
      endOfMonth
    );

    const filteredResult = filterSessionsByMonth(extendedResult, month);

    res.status(200).json({
      success: true,
      data: filteredResult,
      holidays,
    });
  } catch (err) {
    console.error("Ошибка:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
});
*/

export default router;
