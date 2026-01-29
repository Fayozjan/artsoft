import prisma from "../../prisma/client.js";

// 🔹 вспомогательная функция для фильтрации по access
function buildAccessWhere(access) {
  const empWhere = {};

  if (access.access_level === "branch" && access.employee?.branch_id) {
    empWhere.branch_id = access.employee.branch_id;
  } else if (
    access.access_level === "multi-branch" &&
    access.branches?.length
  ) {
    empWhere.branch_id = { in: access.branches };
  } else if (
    access.access_level === "department" &&
    access.employee?.department_id
  ) {
    empWhere.department_id = access.employee.department_id;
  } else if (
    access.access_level === "multi-department" &&
    access.departments?.length
  ) {
    empWhere.department_id = { in: access.departments };
  } else if (access.access_level !== "absolute") {
    empWhere.id = -1; // запрет
  }

  return empWhere;
}

// доступ пользователя
export async function getUserAccess(userId) {
  return prisma.users.findUnique({
    where: { id: Number(userId) },
    include: {
      employee: { select: { branch_id: true, department_id: true } },
    },
  });
}

// события (face_passes)
export async function getFacePasses({ access, yesterday, today, formData }) {
  const where = {
    event_time: {
      gte: new Date(yesterday),
      lte: new Date(today),
    },
    employee: {}, // 🔹 фильтры будут тут
  };

  // доступы
  Object.assign(where.employee, buildAccessWhere(access));

  // ручные фильтры
  if (formData?.branch_id)
    where.employee.branch_id = Number(formData.branch_id);
  if (formData?.department_id)
    where.employee.department_id = Number(formData.department_id);

  return prisma.face_passes.findMany({
    where,
    orderBy: { event_time: "asc" },
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
}

// количество активных сотрудников по департаментам
export async function getActiveEmployeesCount({ userId, formData }) {
  // --- Получаем права пользователя ---
  const user = await prisma.users.findUnique({
    where: { id: Number(userId) },
    include: { employee: true },
  });

  if (!user) throw new Error("Пользователь не найден");

  const { access_level, employee, branches, departments } = user;

  // --- Фильтр по департаментам (права доступа) ---
  const depWhere = {};
  if (access_level === "branch" && employee?.branch_id) {
    depWhere.branch_id = employee.branch_id;
  } else if (access_level === "multi-branch" && branches?.length) {
    depWhere.branch_id = { in: branches };
  } else if (access_level === "department" && employee?.department_id) {
    depWhere.id = employee.department_id;
  } else if (access_level === "multi-department" && departments?.length) {
    depWhere.id = { in: departments };
  } else if (access_level !== "absolute") {
    depWhere.id = -1; // нет доступа
  }

  // --- Фильтр по сотрудникам ---
  const empWhere = { status: { in: ["active", "true"] } };
  if (formData?.branch_id) empWhere.branch_id = Number(formData.branch_id);
  if (formData?.department_id)
    empWhere.department_id = Number(formData.department_id);

  // --- Достаём департаменты с подсчётом сотрудников ---
  const records = await prisma.departments.findMany({
    where: depWhere,
    select: {
      id: true,
      name: true,
      employees: {
        where: empWhere,
        select: { id: true },
      },
    },
  });

  return records.map((d) => ({
    id: d.id,
    name: d.name,
    all_employee_count: d.employees.length,
  }));
}

// список всех активных сотрудников
export async function getAllActiveEmployees({ access, formData }) {
  const where = { status: { in: ["active", "true"] } };

  // доступы
  Object.assign(where, buildAccessWhere(access));

  if (formData?.branch_id) where.branch_id = Number(formData.branch_id);
  if (formData?.department_id)
    where.department_id = Number(formData.department_id);

  return prisma.employees.findMany({
    where,
    include: {
      department: true,
      position: true,
    },
  });
}
