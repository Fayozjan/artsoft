import { prismaContext } from "../../utils/prismaContext.js";

const membersInclude = { select: { employee_id: true } };

const membersWrite = (employeeIds) =>
  employeeIds
    ? {
        members: {
          deleteMany: {},
          create: employeeIds.map((employee_id) => ({ employee_id })),
        },
      }
    : {};

export const EmployeeTeamModel = {
  findByOperationType: async (operationTypeId) => {
    const prisma = prismaContext.get();
    return prisma.employee_teams.findMany({
      where: { operation_type_id: Number(operationTypeId) },
      orderBy: { name: "asc" },
      include: { members: membersInclude },
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.employee_teams.findUnique({ where: { id: Number(id) } });
  },

  // Допущенные к типу операции сотрудники: пустой список = допущены все,
  // тогда участником команды может быть любой существующий сотрудник.
  findAllowedEmployeeIds: async (operationTypeId) => {
    const prisma = prismaContext.get();
    const rows = await prisma.operation_type_employees.findMany({
      where: { operation_type_id: Number(operationTypeId) },
      select: { employee_id: true },
    });
    return rows.map((r) => r.employee_id);
  },

  countEmployees: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.employees.count({ where: { id: { in: ids } } });
  },

  create: async (data, employeeIds) => {
    const prisma = prismaContext.get();
    return prisma.employee_teams.create({
      data: {
        ...data,
        ...(employeeIds?.length ? { members: { create: employeeIds.map((employee_id) => ({ employee_id })) } } : {}),
      },
      include: { members: membersInclude },
    });
  },

  update: async (id, data, employeeIds) => {
    const prisma = prismaContext.get();
    return prisma.employee_teams.update({
      where: { id: Number(id) },
      data: { ...data, ...membersWrite(employeeIds) },
      include: { members: membersInclude },
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.employee_teams.delete({ where: { id: Number(id) } });
  },
};
