import pool from "../db.js";

// Функция для добавления графика работы
export const addWorkSchedule = async (scheduleData) => {
  const {
    name,
    status,
    first_shift_start,
    first_shift_end,
    second_shift_start,
    second_shift_end,
    third_shift_start,
    third_shift_end,
    shift_type,
    shift_start,
    shift_end,
    break_minutes,
  } = scheduleData;

  const isNormalShift = shift_type === "normal";

  const query = `
    INSERT INTO work_schedules (
      name, status,
      first_shift_start, first_shift_end,
      second_shift_start, second_shift_end,
      third_shift_start, third_shift_end,
      shift_type,
      shift_start, shift_end,
      break_minutes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *;
  `;

  const values = [
    name,
    status,
    isNormalShift ? null : first_shift_start,
    isNormalShift ? null : first_shift_end,
    isNormalShift ? null : second_shift_start,
    isNormalShift ? null : second_shift_end,
    isNormalShift ? null : third_shift_start,
    isNormalShift ? null : third_shift_end,
    shift_type,
    isNormalShift ? shift_start : null,
    isNormalShift ? shift_end : null,
    break_minutes,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

// Функция для получения всех графиков работы с пагинацией
export const getAllWorkSchedules = async (page, pageSize) => {
  // Если pageSize не передан → вернуть все
  if (!pageSize) {
    const query = `
      SELECT ws.*, 
             COUNT(e.work_schedule_id) AS employee_count
      FROM work_schedules ws
      LEFT JOIN employees e ON e.work_schedule_id = ws.id
      GROUP BY ws.id
      ORDER BY ws.name ASC;
    `;
    const { rows } = await pool.query(query);

    return {
      schedules: rows, // Все графики
      pagination: null, // Пагинация не используется
    };
  }

  // Если pageSize передан → включаем пагинацию
  page = Math.max(1, parseInt(page, 10) || 1);
  pageSize = Math.max(1, parseInt(pageSize, 10));

  const offset = (page - 1) * pageSize;

  const query = `
    SELECT ws.*, 
           COUNT(e.work_schedule_id) AS employee_count, 
           COUNT(*) OVER() AS total_count
    FROM work_schedules ws
    LEFT JOIN employees e ON e.work_schedule_id = ws.id
    GROUP BY ws.id
    ORDER BY ws.name ASC
    LIMIT $1 OFFSET $2;
  `;

  const { rows } = await pool.query(query, [pageSize, offset]);

  if (rows.length === 0) {
    return {
      schedules: [],
      pagination: {
        currentPage: page,
        totalPages: 0,
        totalItems: 0,
        pageSize,
      },
    };
  }

  const totalItems = parseInt(rows[0].total_count, 10);
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    schedules: rows,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      pageSize,
    },
  };
};

// Функция для получения одного графика работы по ID
export const getWorkScheduleById = async (id) => {
  const query = "SELECT * FROM work_schedules WHERE id = $1;";
  const { rows } = await pool.query(query, [id]);
  return rows[0];
};

// Функция для обновления графика работы по ID
export const updateWorkSchedule = async (id, scheduleData) => {
  const {
    name,
    status,
    first_shift_start,
    first_shift_end,
    second_shift_start,
    second_shift_end,
    third_shift_start,
    third_shift_end,
    shift_type,
    shift_start,
    shift_end,
    break_minutes,
  } = scheduleData;

  const isNormalShift = shift_type === "normal";

  const query = `
    UPDATE work_schedules
    SET
      name = $1, status = $2,
      first_shift_start = $3, first_shift_end = $4,
      second_shift_start = $5, second_shift_end = $6,third_shift_start = $7, third_shift_end = $8,
      shift_type = $9, shift_start = $10, shift_end = $11, break_minutes = $12
    WHERE id = $13
    RETURNING *;
  `;

  const values = [
    name,
    status,
    isNormalShift ? null : first_shift_start,
    isNormalShift ? null : first_shift_end,
    isNormalShift ? null : second_shift_start,
    isNormalShift ? null : second_shift_end,
    isNormalShift ? null : third_shift_start,
    isNormalShift ? null : third_shift_end,
    shift_type,
    isNormalShift ? shift_start : null,
    isNormalShift ? shift_end : null,
    break_minutes,
    id,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

// Функция для удаление графика работы
export const deleteWorkSchedule = async (id) => {
  const query = `DELETE FROM work_schedules WHERE id = $1 RETURNING *;`;
  const values = [id];

  try {
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      console.error("График работы с таким ID не найден");
    }
    return rows[0];
  } catch (error) {
    throw error;
  }
};
