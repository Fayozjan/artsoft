import express from "express";
import pool from "../db.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // === Параметры ===
    const {
      start_date,
      end_date,
      branch_id,
      department_id,
      employee_id,
      position_id,
      event_type,
      door_name,
      page = "1",
      pageSize = "50",
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limit = parseInt(pageSize, 10) || 50;
    const offset = (pageNum - 1) * limit;

    let startDate = start_date ? new Date(start_date) : null;
    let endDate = end_date ? new Date(end_date) : null;

    if (startDate && endDate && endDate < startDate) {
      return res
        .status(400)
        .json({ error: "Дата окончания раньше даты начала" });
    }

    if (startDate && isNaN(startDate.getTime())) startDate = null;
    if (endDate && isNaN(endDate.getTime())) endDate = null;

    // === Доступы ===
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
    const conditions = [];
    const values = [];
    let idx = 1;

    const addCond = (sql, val) => {
      if (val !== null && val !== undefined && val !== "") {
        conditions.push(sql.replace("?", `$${idx}`));
        values.push(val);
        idx++;
      }
    };

    // даты
    addCond(
      "face_passes.event_time >= ?::timestamptz AT TIME ZONE 'Asia/Tashkent'",
      startDate
    );
    addCond(
      "face_passes.event_time <= ?::timestamptz AT TIME ZONE 'Asia/Tashkent'",
      endDate
    );

    // фильтры из query
    addCond("employees.department_id = ?", department_id);
    addCond("employees.id = ?", employee_id ? Number(employee_id) : null);
    addCond("employees.position_id = ?", position_id);
    addCond("face_passes.event_type = ?", event_type);

    // door_name
    if (door_name) {
      const arr = Array.isArray(door_name) ? door_name : [door_name];
      const placeholders = arr.map(() => `$${idx++}`).join(", ");
      conditions.push(`face_passes.door_name IN (${placeholders})`);
      values.push(...arr);
    }

    // доступы по веткам
    if (access_level === "branch" && employee_branch_id) {
      addCond("branches.id = ?", employee_branch_id);
    }

    if (
      access_level === "multi-branch" &&
      Array.isArray(access_branches) &&
      access_branches.length > 0
    ) {
      const placeholders = access_branches.map(() => `$${idx++}`).join(", ");
      conditions.push(`branches.id IN (${placeholders})`);
      values.push(...access_branches.map(Number));
    }

    if (branch_id) {
      addCond("branches.id = ?", branch_id);
    }

    // доступы по департаментам
    if (access_level === "department" && employee_department_id) {
      addCond("employees.department_id = ?", employee_department_id);
    }

    if (
      access_level === "multi-department" &&
      Array.isArray(access_departments) &&
      access_departments.length > 0
    ) {
      const placeholders = access_departments.map(() => `$${idx++}`).join(", ");
      conditions.push(`employees.department_id IN (${placeholders})`);
      values.push(...access_departments.map(Number));
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // === Запрос данных ===
    const eventsQuery = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY face_passes.event_time DESC) AS row_number,
        face_passes.*,
        employees.surname,
        employees.name,
        employees.patronymic,
        employees.photo,
        employees.id AS employee_id,
        departments.name AS department_name,
        positions.name AS position_name,
        branches.name AS branch_name,
        to_char(face_passes.event_time, 'DD-MM-YYYY HH24:MI:SS') AS event_time_formatted
      FROM face_passes
      LEFT JOIN employees ON face_passes.employee_id = employees.id
      LEFT JOIN departments ON employees.department_id = departments.id
      LEFT JOIN positions ON employees.position_id = positions.id
      LEFT JOIN branches ON departments.branch_id = branches.id
      ${where}
      ORDER BY face_passes.event_time DESC
      LIMIT $${idx} OFFSET $${idx + 1};
    `;

    const queryValues = [...values, limit, offset];

    const result = await pool.query(eventsQuery, queryValues);

    // === Подсчёт ===
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM face_passes
      LEFT JOIN employees ON face_passes.employee_id = employees.id
      LEFT JOIN departments ON employees.department_id = departments.id
      LEFT JOIN positions ON employees.position_id = positions.id
      LEFT JOIN branches ON departments.branch_id = branches.id
      ${where};
    `;

    const countResult = await pool.query(countQuery, values);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        pageSize: limit,
      },
    });
  } catch (err) {
    console.error("Ошибка при получении данных:", err);
    res.status(500).json({ error: "Ошибка при получении данных" });
  }
});

/*
router.post("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const {
      start_date,
      end_date,
      branch_id,
      department_id,
      user_id,
      position_id,
      event_type,
      door_name,
      page = 1,
      pageSize = 50,
    } = req.body;

    const doorNamesArray =
      Array.isArray(door_name) && door_name.length > 0 ? door_name : null;

    const limit = parseInt(pageSize);
    const offset = (parseInt(page, 10) - 1) * limit;

    let startDate = start_date ? new Date(start_date) : null;
    let endDate = end_date ? new Date(end_date) : null;

    if (startDate && endDate && endDate < startDate) {
      return res
        .status(400)
        .json({ error: "Дата окончания раньше даты начала" });
    }

    // Приводим к ISO-формату без миллисекунд, если нужно
    if (startDate && isNaN(startDate)) startDate = null;
    if (endDate && isNaN(endDate)) endDate = null;

    let branchFilter = null;
    let multiBranch = null;
    let departmentFilter = null;
    let multiDepartment = null;

    if (accessLevel === "multi-branch" && Array.isArray(accessBranches)) {
      multiBranch = accessBranches.map(Number);
    } else if (
      accessLevel === "branch" &&
      userBranchId &&
      userBranchId !== "undefined"
    ) {
      branchFilter = parseInt(userBranchId);
    } else if (branch_id) {
      branchFilter = parseInt(branch_id);
    }

    if (
      accessLevel === "multi-department" &&
      Array.isArray(accessDepartments)
    ) {
      multiDepartment = accessDepartments.map(Number);
    } else if (
      accessLevel === "department" &&
      userDepId &&
      userDepId !== "undefined"
    ) {
      departmentFilter = parseInt(userDepId);
    } else if (department_id) {
      departmentFilter = parseInt(department_id);
    }

    const eventsQuery = `
  SELECT 
    ROW_NUMBER() OVER (ORDER BY events.event_time DESC) AS row_number,
    events.*, 
    users.surname,
    users.name,
    users.patronymic,
    users.photo,
    departments.name AS department_name,
    position.name AS position_name,
    branch.name AS branch_name,
    to_char(events.event_time, 'DD-MM-YYYY HH24:MI:SS') AS event_time_formatted
  FROM events
  LEFT JOIN users ON events.user_id = users.user_id
  LEFT JOIN departments ON users.department_id = departments.id
  LEFT JOIN position ON users.position_id = position.id
  LEFT JOIN branch ON departments.branch_id = branch.id
  WHERE 
    ($1::timestamp IS NULL OR events.event_time >= $1::timestamp) AND
    ($2::timestamp IS NULL OR events.event_time <= $2::timestamp) AND
    (
      ($3::integer IS NULL AND ($11::int[] IS NULL OR users.department_id = ANY($11::int[])))
      OR
      users.department_id = $3::integer
    ) AND
    ($4::integer IS NULL OR users.user_id = $4::integer) AND
    ($5::integer IS NULL OR users.position_id = $5::integer) AND
    ($6::text IS NULL OR events.event_type = $6::text) AND 
    ($7::text[] IS NULL OR events.door_name = ANY($7::text[])) AND
    (
    ($8::integer IS NULL AND ($12::int[] IS NULL OR branch.id = ANY($12::int[])))
    OR branch.id = $8::integer
    )
  ORDER BY events.event_time DESC
  LIMIT $9 OFFSET $10;
`;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM events
      LEFT JOIN users ON events.user_id = users.user_id
      LEFT JOIN departments ON users.department_id = departments.id
      LEFT JOIN position ON users.position_id = position.id
      LEFT JOIN branch ON departments.branch_id = branch.id
      WHERE 
        ($1::timestamp IS NULL OR events.event_time >= $1::timestamp) AND
        ($2::timestamp IS NULL OR events.event_time <= $2::timestamp) AND
        (
          ($3::integer IS NULL AND ($9::int[] IS NULL OR users.department_id = ANY($9::int[])))
          OR
          users.department_id = $3::integer
        ) AND        
        ($4::integer IS NULL OR users.user_id = $4::integer) AND
        ($5::integer IS NULL OR users.position_id = $5::integer) AND
        ($6::text IS NULL OR events.event_type = $6::text) AND
        ($7::text[] IS NULL OR events.door_name = ANY($7::text[])) AND
        (
          ($8::integer IS NULL AND ($10::int[] IS NULL OR branch.id = ANY($10::int[])))
          OR branch.id = $8::integer
        )
    `;

    const values = [
      startDate,
      endDate,
      departmentFilter,
      user_id ? parseInt(user_id) : null,
      position_id ? parseInt(position_id) : null,
      event_type || null,
      doorNamesArray,
      branchFilter,
      limit,
      offset,
      multiDepartment,
      multiBranch,
    ];

    const countValues = [
      startDate,
      endDate,
      departmentFilter,
      user_id ? parseInt(user_id) : null,
      position_id ? parseInt(position_id) : null,
      event_type || null,
      doorNamesArray,
      branchFilter,
      multiDepartment,
      multiBranch,
    ];

    const [eventsResult, countResult] = await Promise.all([
      pool.query(eventsQuery, values),
      pool.query(countQuery, countValues),
    ]);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      success: true,
      data: eventsResult.rows,
      pagination: {
        currentPage: parseInt(page, 10),
        totalPages,
        totalItems,
        pageSize: limit,
      },
    });
  } catch (err) {
    console.error("Ошибка при получении данных:", err);
    res.status(500).json({ error: "Ошибка при получении данных" });
  }
});
*/

export default router;
