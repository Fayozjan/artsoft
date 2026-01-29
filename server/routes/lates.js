import express from "express";
import pool from "../db.js";

import { processEvents } from "../utils/attendanceUtils.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

function parseLocalDateTime(str) {
  // str: "2025-08-05 08:00:00"
  const [datePart, timePart] = str.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  // Создаём Date в локальном времени без смещения
  return new Date(year, month - 1, day, hour, minute, second || 0);
}

function adjustScheduledTimeForPermissions(
  scheduledTime,
  userId,
  permissionsMap
) {
  const userPermissions = permissionsMap[userId] || [];

  for (const perm of userPermissions) {
    const permFrom = parseLocalDateTime(perm.from);
    const permTo = parseLocalDateTime(perm.to);

    if (permFrom <= scheduledTime && permTo > scheduledTime) {
      return {
        scheduledTime: new Date(permTo),
        havePermission: true,
        permissionEndTime: perm.to, // строка в локальном виде, можно и new Date(permTo)
      };
    }
  }

  return {
    scheduledTime,
    havePermission: false,
    permissionEndTime: null,
  };
}

function findLateEmployees(
  processedEvents,
  holidays,
  targetDate,
  permissionsMap = {}
) {
  const lateEmployees = [];
  const holidayDates = holidays.map(
    (h) => new Date(h.date_from).toISOString().split("T")[0]
  );

  processedEvents.forEach((employee) => {
    Object.entries(employee.sessions_by_date).forEach(([date, sessions]) => {
      if (holidayDates.includes(date)) return;

      sessions.forEach((session) => {
        const { firstEntry, firstEntryPhoto, shiftType, events } = session;
        if (!firstEntry || !events?.length) return;

        const shiftEvent = events[0];
        let shiftStartTime;
        switch (shiftType) {
          case "first":
            shiftStartTime = shiftEvent.first_shift_start;
            break;
          case "second":
            shiftStartTime = shiftEvent.second_shift_start;
            break;
          case "third":
            shiftStartTime = shiftEvent.third_shift_start;
            break;
          default:
            shiftStartTime = shiftEvent.shift_start;
        }
        if (!shiftStartTime) return;

        let scheduledTime = parseLocalDateTime(`${date} ${shiftStartTime}`);

        // Учитываем отгул (подробно)
        const {
          scheduledTime: adjScheduled,
          havePermission,
          permissionEndTime,
        } = adjustScheduledTimeForPermissions(
          scheduledTime,
          employee.employee_id,
          permissionsMap
        );

        scheduledTime = adjScheduled;

        const actualTime = parseLocalDateTime(`${date} ${firstEntry}`);

        if (actualTime > scheduledTime) {
          const lateMinutes = Math.round((actualTime - scheduledTime) / 60000);

          lateEmployees.push({
            employee_id: employee.employee_id,
            ...employee.employee_info,
            date,
            shift_type: shiftType,
            scheduled_start: shiftStartTime,
            actual_start: firstEntry,
            actual_start_photo: firstEntryPhoto,
            late_minutes: lateMinutes,
            have_permission: havePermission,
            permission_end_time: permissionEndTime,
          });
        }
      });
    });
  });

  const latenessMap = {};
  lateEmployees.forEach((emp) => {
    latenessMap[emp.employee_id] = (latenessMap[emp.employee_id] || 0) + 1;
  });

  lateEmployees.forEach((emp) => {
    emp.monthly_late_count = latenessMap[emp.employee_id] || 0;
  });

  return lateEmployees.filter((emp) => emp.date === targetDate);
}

function findLateEmployeesForMonth(
  processedEvents,
  holidays,
  permissionsMap = {}
) {
  const lateEmployeesMap = new Map();
  const holidayDates = holidays.map(
    (h) => new Date(h.date_from).toISOString().split("T")[0]
  );

  processedEvents.forEach((employee) => {
    Object.entries(employee.sessions_by_date).forEach(([date, sessions]) => {
      if (holidayDates.includes(date)) return;

      sessions.forEach((session) => {
        const { firstEntry, shiftType, events } = session;
        if (!firstEntry || !events?.length) return;

        const shiftEvent = events[0];
        if (!shiftEvent) return;

        let shiftStartTime;
        switch (shiftType) {
          case "first":
            shiftStartTime = shiftEvent.first_shift_start;
            break;
          case "second":
            shiftStartTime = shiftEvent.second_shift_start;
            break;
          case "third":
            shiftStartTime = shiftEvent.third_shift_start;
            break;
          default:
            shiftStartTime = shiftEvent.shift_start;
        }
        if (!shiftStartTime) return;

        let scheduledTime = parseLocalDateTime(`${date} ${shiftStartTime}`);

        // Учитываем отгул (подробно)
        const {
          scheduledTime: adjScheduled,
          havePermission,
          permissionEndTime,
        } = adjustScheduledTimeForPermissions(
          scheduledTime,
          employee.employee_id,
          permissionsMap
        );

        scheduledTime = adjScheduled;

        const actualTime = parseLocalDateTime(`${date} ${firstEntry}`);

        if (actualTime > scheduledTime) {
          const lateMinutes = Math.round((actualTime - scheduledTime) / 60000);
          const key = employee.employee_id;

          if (!lateEmployeesMap.has(key)) {
            const employeeInfo = employee.employee_info;
            const fullname = [
              employeeInfo?.surname,
              employeeInfo?.name,
              employeeInfo?.patronymic,
            ]
              .filter(Boolean)
              .join(" ");

            lateEmployeesMap.set(key, {
              employee_id: employee.employee_id,
              fullname: `${fullname} ${employee.employee_id}` || "Неизвестно",
              branch_name: employeeInfo?.branch_name || "Не указано",
              department_name: employeeInfo?.department_name || "Не указано",
              position_name: employeeInfo?.position_name || "Не указано",
              lateDays: [],
              monthly_late_count: 0,
            });
          }

          lateEmployeesMap.get(key).lateDays.push({
            date,
            minutesLate: lateMinutes,
            actual: firstEntry,
            scheduled: shiftStartTime,
            have_permission: havePermission,
            permission_end_time: permissionEndTime,
          });

          lateEmployeesMap.get(key).monthly_late_count += 1;
        }
      });
    });
  });

  return [...lateEmployeesMap.values()];
}

async function getEventsWithinRange(startDate, endDate, filters) {
  let query = `
    SELECT
      f.employee_id,
      to_char(f.event_time, 'YYYY-MM-DD HH24:MI:SS') AS event_time_string,
      f.event_type,
      f.event_photo,
      e.department_id,
      br.name AS branch_name,
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
      ws.grace_period
    FROM face_passes f
    JOIN employees e ON f.employee_id = e.id
    JOIN departments d ON e.department_id = d.id
    JOIN branches br ON d.branch_id = br.id
    JOIN positions p ON e.position_id = p.id
    JOIN work_schedules ws ON e.work_schedule_id = ws.id
    WHERE f.event_time BETWEEN $1 AND $2
  `;

  const values = [startDate, endDate];
  let counter = 3;

  const {
    access_level,
    employee_branch_id,
    employee_department_id,
    access_branches,
    access_departments,
    branch_id,
    department_id,
    position_id,
    employee_id,
  } = filters;

  if (access_level === "department") {
    query += ` AND e.department_id = $${counter++}`;
    values.push(employee_department_id);
  } else if (
    access_level === "multi-department" &&
    Array.isArray(access_departments) &&
    access_departments.length > 0
  ) {
    query += ` AND e.department_id = ANY($${counter++}::int[])`;
    values.push(access_departments);
  } else if (access_level === "branch") {
    query += ` AND d.branch_id = $${counter++}`;
    values.push(employee_branch_id);
  } else if (
    access_level === "multi-branch" &&
    Array.isArray(access_branches) &&
    access_branches.length > 0
  ) {
    query += ` AND d.branch_id = ANY($${counter++}::int[])`;
    values.push(access_branches);
  }

  if (branch_id) {
    query += ` AND d.branch_id = $${counter++}`;
    values.push(branch_id);
  }

  if (department_id) {
    query += ` AND e.department_id = $${counter++}`;
    values.push(department_id);
  }

  if (position_id) {
    query += ` AND e.position_id = $${counter++}`;
    values.push(position_id);
  }

  if (employee_id) {
    if (Array.isArray(employee_id)) {
      query += ` AND e.id = ANY($${counter++}::int[])`;
    } else {
      query += ` AND e.id = $${counter++}`;
    }
    values.push(employee_id);
  }

  query += ` ORDER BY f.employee_id, f.event_time`;

  const { rows } = await pool.query(query, values);

  return rows;
}

router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const { date, mode, branch_id, department_id, position_id, employee_id } =
      req.query;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const parsedDate =
      mode === "month" && date.length === 7 ? `${date}-01` : date;

    const targetDateStart = new Date(parsedDate);
    const targetDateEnd = new Date(parsedDate);
    targetDateStart.setHours(0, 0, 0, 0);
    targetDateEnd.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(parsedDate);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(startOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    // 1. Получаем данные о правах пользователя
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
      [userId] // берём из токена
    );

    if (!userAccess.rows.length) {
      return res.status(403).json({ error: "Пользователь не найден" });
    }

    const accessFilters = userAccess.rows[0];

    const filters = {
      access_level: accessFilters.access_level,
      employee_branch_id: accessFilters.employee_branch_id,
      employee_department_id: accessFilters.employee_department_id,
      access_branches: accessFilters.access_branches,
      access_departments: accessFilters.access_departments,
      branch_id,
      department_id,
      position_id,
      employee_id,
    };

    // === 2. Праздники ===
    const holidaysQuery = `
      SELECT id, name, date_from, date_to
      FROM holidays
      WHERE $1::date BETWEEN date_from AND date_to
      ORDER BY date_from;
    `;
    const { rows: holidays } = await pool.query(holidaysQuery, [parsedDate]);

    // === 3. Дневной режим ===
    if (mode === "day") {
      const eventsDay = await getEventsWithinRange(
        targetDateStart,
        targetDateEnd,
        filters
      );
      const processedDayEvents = processEvents(eventsDay);

      // Загружаем разрешения на отгулы за этот день
      const permissionsQuery = `
      SELECT 
        employee_id,
        to_char(date_from AT TIME ZONE 'UTC' AT TIME ZONE '+05', 'YYYY-MM-DD HH24:MI:SS') AS date_from_local,
        to_char(date_to   AT TIME ZONE 'UTC' AT TIME ZONE '+05', 'YYYY-MM-DD HH24:MI:SS') AS date_to_local
      FROM leave_permissions
      WHERE date_from <= $2 AND date_to >= $1
      `;
      const { rows: permissionsRows } = await pool.query(permissionsQuery, [
        targetDateStart,
        targetDateEnd,
      ]);

      // Формируем карту отгулов
      const permissionsMap = {};
      permissionsRows.forEach((p) => {
        if (!permissionsMap[p.employee_id]) permissionsMap[p.employee_id] = [];

        permissionsMap[p.employee_id].push({
          from: p.date_from_local,
          to: p.date_to_local,
        });
      });

      const lateEmployeesDay = findLateEmployees(
        processedDayEvents,
        holidays,
        date,
        permissionsMap
      );

      // Если никто не опоздал — возвращаем сразу
      if (lateEmployeesDay.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            events: processedDayEvents,
            lateEmployees: [],
          },
          holidays,
        });
      }

      // === 3. Загружаем события за месяц только для этих employee_id ===
      const lateEmployeesIds = lateEmployeesDay.map((e) => e.employee_id);
      const eventsMonth = await getEventsWithinRange(startOfMonth, endOfMonth, {
        ...filters,
        lateEmployeesIds,
      });

      const processedMonthEvents = processEvents(eventsMonth);
      const monthlyLateEmployees = findLateEmployees(
        processedMonthEvents,
        holidays,
        date,
        permissionsMap
      );

      return res.status(200).json({
        success: true,
        data: {
          events: processedDayEvents,
          lateEmployees: monthlyLateEmployees,
        },
        holidays,
      });
    }

    // === 3. Месячный режим ===
    if (mode === "month") {
      // Загружаем все события месяца
      const eventsMonth = await getEventsWithinRange(
        startOfMonth,
        endOfMonth,
        filters
      );

      const processedMonthEvents = processEvents(eventsMonth);

      const lateEmployees = findLateEmployeesForMonth(
        processedMonthEvents,
        holidays
      );

      return res.status(200).json({
        success: true,
        data: {
          events: processedMonthEvents,
          lateEmployees,
        },
        holidays,
      });
    }

    // === Неверный режим ===
    return res.status(400).json({ error: "Invalid mode" });
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

    // Запрос списка праздников за указанную дату
    const holidaysQuery = `
      SELECT id, name, date_from, date_to 
      FROM holidays 
      WHERE $1::date BETWEEN date_from AND date_to
      ORDER BY date_from;
    `;

    const holidaysValues = [date];
    const { rows: holidays } = await pool.query(holidaysQuery, holidaysValues);

    // Базовый запрос событий с фильтрацией по массиву user_ids
    const eventsQuery = `
      SELECT
          e.user_id,
          to_char(e.event_time, 'YYYY-MM-DD HH24:MI:SS') AS event_time_string,
          e.event_type,
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
          ws.grace_period
      FROM events e
      JOIN users u ON e.user_id = u.user_id
      JOIN departments d ON u.department_id = d.id
      JOIN position p ON u.position_id = p.id
      JOIN work_schedules ws ON u.work_schedule_id = ws.id
      WHERE DATE(e.event_time) = $1
      AND u.user_id = ANY($2)
      ORDER BY e.user_id, e.event_time;
    `;

    const eventsValues = [date, user_ids];

    const { rows: events } = await pool.query(eventsQuery, eventsValues);

    // Обрабатываем события и находим опоздавших
    const processedEvents = processEvents(events);
    const lateEmployees = findLateEmployees(processedEvents, holidays);

    res.status(200).json({
      success: true,
      data: {
        events: processedEvents,
        lateEmployees,
      },
      holidays,
    });
  } catch (err) {
    console.error("Ошибка:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
});

// function findLateEmployees(processedEvents, holidays, targetDate) {
//   const lateEmployees = [];
//   const holidayDates = holidays.map(
//     (h) => new Date(h.date_from).toISOString().split("T")[0]
//   );

//   processedEvents.forEach((employee) => {
//     Object.entries(employee.sessions_by_date).forEach(([date, sessions]) => {
//       // Проверяем, не выходной ли это день
//       const isHoliday = holidayDates.includes(date);

//       if (isHoliday) return;

//       sessions.forEach((session) => {
//         const { firstEntry, firstEntryPhoto, shiftType, events } = session;

//         if (!firstEntry) {
//           console.warn(
//             `Пустой firstEntry у пользователя ${employee.user_id} на дату ${date}`
//           );
//           return;
//         }

//         const firstEvent = events.find((ev) => {
//           const [h, m] = firstEntry.split(":");
//           const evTime = new Date(session.date);
//           evTime.setHours(h, m, 0, 0);
//           const eventTime = new Date(ev.event_time);
//           return Math.abs(eventTime - evTime) < 60000; // +/- 1 минута
//         });

//         const eventPhoto = firstEvent?.event_photo || null;

//         if (!firstEntry) return;

//         const shiftEvent = events[0];

//         if (!shiftEvent) return;

//         let shiftStartTime;
//         switch (shiftType) {
//           case "first":
//             shiftStartTime = shiftEvent.first_shift_start;
//             break;
//           case "second":
//             shiftStartTime = shiftEvent.second_shift_start;
//             break;
//           case "third":
//             shiftStartTime = shiftEvent.third_shift_start;
//             break;
//           default:
//             shiftStartTime = shiftEvent.shift_start;
//         }

//         if (!shiftStartTime) return;

//         // Сравниваем время прихода с временем начала смены
//         const [scheduledHour, scheduledMinute] = shiftStartTime
//           .split(":")
//           .map(Number);
//         const [actualHour, actualMinute] = firstEntry.split(":").map(Number);

//         const scheduledTime = new Date(date);
//         scheduledTime.setHours(scheduledHour, scheduledMinute, 0, 0);

//         const actualTime = new Date(date);
//         actualTime.setHours(actualHour, actualMinute, 0, 0);

//         // Проверяем, если время прихода позднее времени начала смены
//         if (actualTime > scheduledTime) {
//           const lateMinutes = Math.round((actualTime - scheduledTime) / 60000);

//           lateEmployees.push({
//             user_id: employee.user_id,
//             ...employee.user_info,
//             date,
//             shift_type: shiftType,
//             scheduled_start: shiftStartTime,
//             actual_start: firstEntry,
//             actual_start_photo: firstEntryPhoto,
//             late_minutes: lateMinutes,
//             photo: eventPhoto,
//           });
//         }
//       });
//     });
//   });

//   const latenessMap = {};

//   lateEmployees.forEach((emp) => {
//     if (!latenessMap[emp.user_id]) {
//       latenessMap[emp.user_id] = 0;
//     }
//     latenessMap[emp.user_id]++;
//   });

//   // Обогащаем каждый объект поля `monthly_late_count`
//   lateEmployees.forEach((emp) => {
//     emp.monthly_late_count = latenessMap[emp.user_id] || 0;
//   });

//   return lateEmployees.filter((emp) => emp.date === targetDate);
// }

// function findLateEmployeesForMonth(processedEvents, holidays) {
//   const lateEmployeesMap = new Map();

//   const holidayDates = holidays.map(
//     (h) => new Date(h.date_from).toISOString().split("T")[0]
//   );

//   processedEvents.forEach((employee) => {
//     Object.entries(employee.sessions_by_date).forEach(([date, sessions]) => {
//       if (holidayDates.includes(date)) return;

//       sessions.forEach((session) => {
//         const { firstEntry, shiftType, events } = session;

//         if (!firstEntry || !events?.length) return;

//         const shiftEvent = events[0];
//         if (!shiftEvent) return;

//         let shiftStartTime;
//         switch (shiftType) {
//           case "first":
//             shiftStartTime = shiftEvent.first_shift_start;
//             break;
//           case "second":
//             shiftStartTime = shiftEvent.second_shift_start;
//             break;
//           case "third":
//             shiftStartTime = shiftEvent.third_shift_start;
//             break;
//           default:
//             shiftStartTime = shiftEvent.shift_start;
//         }

//         if (!shiftStartTime) return;

//         const [scheduledHour, scheduledMinute] = shiftStartTime
//           .split(":")
//           .map(Number);
//         const [actualHour, actualMinute] = firstEntry.split(":").map(Number);

//         const scheduledTime = new Date(date);
//         scheduledTime.setHours(scheduledHour, scheduledMinute, 0, 0);

//         const actualTime = new Date(date);
//         actualTime.setHours(actualHour, actualMinute, 0, 0);

//         if (actualTime > scheduledTime) {
//           const lateMinutes = Math.round((actualTime - scheduledTime) / 60000);
//           const key = employee.user_id;

//           if (!lateEmployeesMap.has(key)) {
//             const userInfo = employee.user_info;
//             const fullname = [
//               userInfo?.surname,
//               userInfo?.name,
//               userInfo?.patronymic,
//             ]
//               .filter(Boolean)
//               .join(" ");

//             lateEmployeesMap.set(key, {
//               user_id: employee.user_id,
//               fullname: `${fullname} ${employee.user_id}` || "Неизвестно",
//               branch_name: userInfo?.branch_name || "Не указано",
//               department_name: userInfo?.department_name || "Не указано",
//               position_name: userInfo?.position_name || "Не указано",
//               lateDays: [],
//               monthly_late_count: 0,
//             });
//           }

//           lateEmployeesMap.get(key).lateDays.push({
//             date,
//             minutesLate: lateMinutes,
//             actual: firstEntry, // пришёл
//             scheduled: shiftStartTime, // по графику
//           });

//           lateEmployeesMap.get(key).monthly_late_count += 1;
//         }
//       });
//     });
//   });

//   return [...lateEmployeesMap.values()];
// }

/*
router.post("/", async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const targetDateStart = new Date(date);
    targetDateStart.setHours(0, 0, 0, 0);
    const targetDateEnd = new Date(date);
    targetDateEnd.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(date);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(startOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    // === 1. Запрашиваем праздники ===
    const holidaysQuery = `
      SELECT id, name, date_from, date_to
      FROM holidays
      WHERE $1::date BETWEEN date_from AND date_to
      ORDER BY date_from;
    `;
    const { rows: holidays } = await pool.query(holidaysQuery, [date]);

    // === 2. Загружаем события за конкретный день ===
    const eventsDay = await getEventsWithinRange(
      targetDateStart,
      targetDateEnd,
      req.body
    );
    const processedDayEvents = processEvents(eventsDay);
    const lateEmployeesDay = findLateEmployees(
      processedDayEvents,
      holidays,
      date
    );

    // Если никто не опоздал — возвращаем сразу
    if (lateEmployeesDay.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          events: processedDayEvents,
          lateEmployees: [],
        },
        holidays,
      });
    }

    // === 3. Загружаем события за месяц только для этих user_id ===
    const lateUserIds = lateEmployeesDay.map((e) => e.user_id);
    const eventsMonth = await getEventsWithinRange(startOfMonth, endOfMonth, {
      ...req.body,
      user_id: lateUserIds,
    });

    const processedMonthEvents = processEvents(eventsMonth);
    const monthlyLateEmployees = findLateEmployees(
      processedMonthEvents,
      holidays,
      date
    );

    res.status(200).json({
      success: true,
      data: {
        events: processedDayEvents,
        lateEmployees: monthlyLateEmployees,
      },
      holidays,
    });
  } catch (err) {
    console.error("Ошибка:", err.message);
    res.status(500).json({ error: "Ошибка при обработке данных" });
  }
});
*/

export default router;
