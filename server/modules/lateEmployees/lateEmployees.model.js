import prisma from "../../prisma/client.js";
import { formatDates } from "./lateEmployees.helpers.js";

export async function getHolidays(date) {
  return prisma.holidays.findMany({
    where: {
      date_from: { lte: new Date(date) },
      date_to: { gte: new Date(date) },
    },
    orderBy: { date_from: "asc" },
  });
}

export async function getFacePassesByDate({
  userId,
  page,
  pageSize,
  filters = {},
  all = false,
}) {
  const {
    date,
    branch_id,
    department_id,
    employee_id,
    position_id,
    event_type,
    door_name,
  } = filters;

  // --- доступы пользователя ---
  const user = await prisma.users.findUnique({
    where: { id: Number(userId) },
    include: { employee: true },
  });

  if (!user) throw new Error("Пользователь не найден");

  const { access_level, branches, departments, employee } = user;
  const where = {};

  if (date) {
    const [year, month, day] = date.split("-").map(Number);

    // начало дня (UTC)
    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // начало следующего дня (UTC)
    const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

    where.event_time = {
      gte: start,
      lt: end,
    };
  }

  if (branch_id) where.employee = { branch_id: Number(branch_id) };
  if (department_id) where.employee = { department_id: Number(department_id) };
  if (employee_id) where.employee_id = Number(employee_id);
  if (position_id) where.employee = { position_id: Number(position_id) };
  if (event_type) where.event_type = event_type;
  if (door_name)
    where.door_name = {
      in: Array.isArray(door_name) ? door_name : [door_name],
    };

  // --- доступы ---
  if (access_level === "branch" && employee?.branch_id) {
    where.employee = { ...where.employee, branch_id: employee.branch_id };
  } else if (access_level === "multi-branch" && branches?.length) {
    where.employee = { ...where.employee, branch_id: { in: branches } };
  } else if (access_level === "department" && employee?.department_id) {
    where.employee = {
      ...where.employee,
      department_id: employee.department_id,
    };
  } else if (access_level === "multi-department" && departments?.length) {
    where.employee = { ...where.employee, department_id: { in: departments } };
  } else if (access_level !== "absolute") {
    where.employee_id = -1;
  }

  // --- если нужно всё ---
  if (all) {
    const records = await prisma.face_passes.findMany({
      where,
      orderBy: { event_time: "desc" },
      include: {
        employee: {
          include: {
            branch: true,
            department: true,
            position: true,
            work_schedule: true,
          },
        },
      },
    });

    return { data: formatDates(records), pagination: null };
  }

  // --- пагинация ---
  const currentPage = Math.max(parseInt(page) || 1, 1);
  const size = Math.max(parseInt(pageSize) || 50, 1);
  const skip = (currentPage - 1) * size;

  const [records, total] = await Promise.all([
    prisma.face_passes.findMany({
      where,
      skip,
      take: size,
      orderBy: { event_time: "desc" },
      include: {
        employee: {
          include: {
            branch: true,
            department: true,
            position: true,
            work_schedule: true,
          },
        },
      },
    }),
    prisma.face_passes.count({ where }),
  ]);

  return {
    data: formatDates(records),
    pagination: {
      totalItems: total,
      currentPage,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    },
  };
}

export async function getEmployeeFacePassesByDate(date, userIds) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return prisma.events.findMany({
    where: {
      event_time: {
        gte: start,
        lte: end,
      },
      user_id: { in: userIds },
    },
    orderBy: [{ user_id: "asc" }, { event_time: "asc" }],
    select: {
      user_id: true,
      event_time: true,
      event_type: true,
      user: {
        select: {
          department_id: true,
          department: { select: { name: true } },
          position_id: true,
          position: { select: { name: true } },
          name: true,
          surname: true,
          patronymic: true,
          work_schedule: {
            select: {
              name: true,
              shift_type: true,
              shift_start: true,
              shift_end: true,
              first_shift_start: true,
              first_shift_end: true,
              second_shift_start: true,
              second_shift_end: true,
              third_shift_start: true,
              third_shift_end: true,
              grace_period: true,
            },
          },
        },
      },
    },
  });
}

export async function getFacePassesByMonthRange({
  userId,
  page,
  pageSize,
  filters = {},
  all = false,
}) {
  const {
    startOfMonth,
    endOfMonth,
    branch_id,
    department_id,
    employee_id,
    position_id,
  } = filters;

  // --- доступы пользователя ---
  const user = await prisma.users.findUnique({
    where: { id: Number(userId) },
    include: { employee: true },
  });

  if (!user) throw new Error("Пользователь не найден");

  const { access_level, branches, departments, employee } = user;
  const where = {};

  // --- фильтр по датам ---
  if (startOfMonth && endOfMonth) {
    where.event_time = {
      gte: new Date(startOfMonth),
      lte: new Date(endOfMonth),
    };
  }

  // --- фильтр по сотруднику ---
  const employeeWhere = {};
  if (branch_id) employeeWhere.branch_id = Number(branch_id);
  if (department_id) employeeWhere.department_id = Number(department_id);
  if (position_id) employeeWhere.position_id = Number(position_id);
  if (employee_id) employeeWhere.employee_id = Number(employee_id);

  // --- фильтры доступа ---

  if (access_level === "branch" && employee?.branch_id) {
    employeeWhere.branch_id = employee.branch_id;
  } else if (access_level === "multi-branch" && branches?.length) {
    employeeWhere.branch_id = { in: branches };
  } else if (access_level === "department" && employee?.department_id) {
    employeeWhere.department_id = employee.department_id;
  } else if (access_level === "multi-department" && departments?.length) {
    employeeWhere.department_id = { in: departments };
  } else if (access_level !== "absolute") {
    where.employee_id = -1;
  }

  if (Object.keys(employeeWhere).length) where.employee = employeeWhere;

  const include = {
    employee: {
      include: {
        branch: true,
        department: true,
        position: true,
        work_schedule: true,
      },
    },
  };

  // --- если нужно всё ---
  if (all) {
    const records = await prisma.face_passes.findMany({
      where,
      orderBy: { event_time: "desc" },
      include,
    });
    return { data: formatDates(records), pagination: null };
  }

  // --- пагинация ---
  const currentPage = Math.max(parseInt(page) || 1, 1);
  const size = Math.max(parseInt(pageSize) || 50, 1);
  const skip = (currentPage - 1) * size;

  const [records, total] = await Promise.all([
    prisma.face_passes.findMany({
      where,
      skip,
      take: size,
      orderBy: { event_time: "desc" },
      include: {
        employee: {
          include: {
            branch: true,
            department: true,
            position: true,
            work_schedule: true,
          },
        },
      },
    }),
    prisma.face_passes.count({ where }),
  ]);

  return {
    data: formatDates(records),
    pagination: {
      totalItems: total,
      currentPage,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    },
  };
}

export async function getEmployeeFacePassesByMonthRange({
  startOfMonth,
  endOfMonth,
  employeeIds,
}) {
  // Проверка на наличие пользователей
  if (!employeeIds || employeeIds.length === 0) {
    throw new Error("Нет пользователей для выборки.");
  }

  const where = {
    employee_id: { in: employeeIds.map(Number) },
  };

  // Фильтр по диапазону дат, если указан
  if (startOfMonth && endOfMonth) {
    where.event_time = {
      gte: new Date(startOfMonth),
      lte: new Date(endOfMonth),
    };
  }

  const [records, total] = await Promise.all([
    prisma.face_passes.findMany({
      where,
      orderBy: { event_time: "desc" },
      include: {
        employee: {
          include: {
            branch: true,
            department: true,
            position: true,
            work_schedule: true,
          },
        },
      },
    }),
    prisma.face_passes.count({ where }),
  ]);

  return {
    data: formatDates(records),
    pagination: {
      totalItems: total,
      currentPage: 1,
      pageSize: records.length,
      totalPages: 1,
    },
  };
}

export async function getTimeOffForDate(startDate, endDate) {
  const rows = await prisma.time_off.findMany({
    where: {
      date_from: { lte: endDate },
      date_to: { gte: startDate },
    },
    select: {
      employee_id: true,
      date_from: true,
      date_to: true,
    },
  });

  const map = {};
  rows.forEach((p) => {
    if (!map[p.employee_id]) map[p.employee_id] = [];
    map[p.employee_id].push({
      from: p.date_from.toISOString().replace("T", " ").slice(0, 19),
      to: p.date_to.toISOString().replace("T", " ").slice(0, 19),
    });
  });

  return map;
}
