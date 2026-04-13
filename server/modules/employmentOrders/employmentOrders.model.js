import { prismaContext } from "../../utils/prismaContext.js";

export const EmploymentOrdersModel = {
  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employment_orders.create({ data });
  },

  findAll: async ({ where, skip, take, orderBy } = {}, tx = null) => {
    const prisma = tx || prismaContext.get();
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
  },

  findById: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employment_orders.findUnique({
      where: { id: Number(id) },
      include: { employee: true },
    });
  },

  findByEmployee: async (employeeId, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employment_orders.findMany({
      where: { employee_id: Number(employeeId) },
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
      orderBy: { date: "desc" },
    });
  },

  findLatestByEmployee: async (employeeId, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employment_orders.findFirst({
      where: { employee_id: Number(employeeId) },
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
      orderBy: { date: "desc" },
    });
  },

  countAll: async (where, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employment_orders.count({ where });
  },

  update: async (id, data, tx = null) => {
    const prisma = tx || prismaContext.get();
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
  },

  delete: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employment_orders.delete({
      where: { id: Number(id) },
    });
  },
};
