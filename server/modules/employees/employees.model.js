import prisma from "../../prisma/client.js";
import dotenv from "dotenv";
dotenv.config();

export async function getEmployees(where = {}, skip = 0, take = 50) {
  const [data, total] = await Promise.all([
    prisma.employees.findMany({
      where,
      skip,
      take,
      orderBy: { last_name: "asc" },
      include: {
        branch: true,
        department: true,
        position: true,
        workSchedule: true,
      },
    }),
    prisma.employees.count({ where }),
  ]);

  return { data, total };
}

export const getAllEmployees = async (where = {}) => {
  return prisma.employees.findMany({
    where,
    orderBy: { last_name: "asc" },
    include: {
      branch: true,
      department: true,
      position: true,
    },
  });
};

export const getActiveEmployeesModel = async (where) => {
  return prisma.employees.findMany({
    where,
    orderBy: { last_name: "asc" },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      employee_number: true,
      photo: true,
      branch: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
  });
};

export const getEmployee = (id) => {
  return prisma.employees.findUnique({
    where: { id: Number(id) },
    include: {
      branch: true,
      department: true,
      position: true,
      employmentOrders: true,
    },
  });
};

export const createEmployee = async (data) => {
  return await prisma.$transaction(async (tx) => {
    const newEmployee = await tx.employees.create({
      data: {
        ...data,
      },
    });

    // Если переданы данные для приказа
    if (data.order_date || data.order_number) {
      await tx.orders.create({
        data: {
          employee_id: newEmployee.id,
          branch_id: newEmployee.branch_id ?? null,
          department_id: newEmployee.department_id ?? null,
          position_id: newEmployee.position_id ?? null,
          date: data.order_date ?? null,
          order_number: data.order_number ?? null,
          type: "hire",
        },
      });
    }

    return newEmployee;
  });
};

export const editEmployee = async (id, data) => {
  return prisma.employees.update({
    where: { id: Number(id) },
    data,
  });
};

export const deleteEmployee = async (id) => {
  return prisma.employees.delete({ where: { id: Number(id) } });
};

export async function getAllEmployeeIds() {
  try {
    const employees = await prisma.employees.findMany({
      select: { id: true },
    });

    return employees.map((emp) => emp.id);
  } catch (err) {
    console.error("Ошибка при получении всех ID сотрудников:", err);
    throw err;
  }
}

export async function addEmployeeRaw(body) {
  const { id, first_name, branch_id, status } = body;

  await prisma.$executeRaw`
    INSERT INTO employees (id, first_name, branch_id, status)
    VALUES (${id}, ${first_name}, ${branch_id}, ${status})
  `;
}
