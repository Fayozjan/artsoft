import prisma from "../../prisma/client.js";

export const findEmploymentOrders = async ({ where, skip, take, orderBy }) => {
  return prisma.employment_orders.findMany({
    where,
    skip,
    take,
    orderBy,
    include: {
      employee: {
        select: { id: true, full_name: true },
      },
      added_by: {
        select: { id: true, full_name: true },
      },
    },
  });
};

export const countEmploymentOrders = async (where) => {
  return prisma.employment_orders.count({ where });
};

export const findEmploymentOrderById = async (id) => {
  return prisma.employment_orders.findUnique({
    where: { id: Number(id) },
    include: {
      employee: true,
    },
  });
};

export const findEmploymentOrdersByEmployeeId = async ({ where, orderBy }) => {
  return prisma.employment_orders.findMany({
    where,
    orderBy,
    include: {
      employee: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          middle_name: true,
          address: true,
          passport: true,
          pinfl: true,
        },
      },
      branch: {
        include: {
          director: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              middle_name: true,
            },
          },
        },
      },
      department: true,
      position: true,
    },
  });
};

export const getLatestOrderByEmployee = (employeeId) => {
  return prisma.employment_orders.findFirst({
    where: { employee_id: employeeId },
    orderBy: [{ date: "desc" }, { added_at: "desc" }],
    select: { id: true },
  });
};

export const createEmploymentOrderByModel = async (data) => {
  return prisma.employment_orders.create({
    data: {
      type: data.type,
      date: data.order_date ? new Date(data.order_date) : new Date(),
      order_number: data.order_number || null,
      note: data.note || null,
      employee: { connect: { id: Number(data.employeeId) } },

      branch:
        data.branch_id === null
          ? { disconnect: true }
          : data.branch_id
            ? { connect: { id: Number(data.branch_id) } }
            : undefined,

      department:
        data.department_id === null
          ? { disconnect: true }
          : data.department_id
            ? { connect: { id: Number(data.department_id) } }
            : undefined,

      position:
        data.position_id === null
          ? { disconnect: true }
          : data.position_id
            ? { connect: { id: Number(data.position_id) } }
            : undefined,
    },
  });
};

export const updateEmploymentOrderById = async (id, data) => {
  return prisma.employment_orders.update({
    where: { id: Number(id) },
    data: {
      order_number: data.order_number ?? undefined,
      date: data.date ?? undefined,

      branch:
        data.branch_id === null
          ? { disconnect: true }
          : data.branch_id
            ? { connect: { id: Number(data.branch_id) } }
            : undefined,

      department:
        data.department_id === null
          ? { disconnect: true }
          : data.department_id
            ? { connect: { id: Number(data.department_id) } }
            : undefined,

      position:
        data.position_id === null
          ? { disconnect: true }
          : data.position_id
            ? { connect: { id: Number(data.position_id) } }
            : undefined,
    },
  });
};

export const deleteEmploymentOrderById = async (id) => {
  return prisma.employment_orders.delete({
    where: { id: Number(id) },
  });
};
