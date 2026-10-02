import { prismaContext } from "../../utils/prismaContext.js";
import { userNameSelect } from "../../utils/userDisplayName.js";

const employeesInclude = { select: { employee_id: true } };

const addedByInclude = { select: userNameSelect };

const nextOperationsInclude = {
  select: { nextOperationType: { select: { id: true, name: true, is_rework: true } } },
};

const reworkOperationsInclude = {
  select: { reworkOperationType: { select: { id: true, name: true, is_rework: true } } },
};

const incompleteOperationsInclude = {
  select: { incompleteOperationType: { select: { id: true, name: true, is_rework: true } } },
};

// Исправляемая операция — цель операции исправления (для формы и списка).
const reworkTargetInclude = { select: { id: true, name: true, is_rework: true } };

// Полная замена набора допущенных сотрудников: deleteMany + create в одном
// update — Prisma выполняет вложенные записи в одной транзакции.
const employeesWrite = (employeeIds) =>
  employeeIds
    ? {
        employees: {
          deleteMany: {},
          create: employeeIds.map((employee_id) => ({ employee_id })),
        },
      }
    : {};

// Полная замена набора "следующих операций по умолчанию" — так же, deleteMany + create.
const nextOperationsWrite = (nextOperationTypeIds) =>
  nextOperationTypeIds
    ? {
        nextOperations: {
          deleteMany: {},
          create: nextOperationTypeIds.map((next_operation_type_id) => ({ next_operation_type_id })),
        },
      }
    : {};

// То же для набора "операций для исправления".
const reworkOperationsWrite = (reworkOperationTypeIds) =>
  reworkOperationTypeIds
    ? {
        reworkOperations: {
          deleteMany: {},
          create: reworkOperationTypeIds.map((rework_operation_type_id) => ({ rework_operation_type_id })),
        },
      }
    : {};

// То же для набора "операций для не выполненных".
const incompleteOperationsWrite = (incompleteOperationTypeIds) =>
  incompleteOperationTypeIds
    ? {
        incompleteOperations: {
          deleteMany: {},
          create: incompleteOperationTypeIds.map((incomplete_operation_type_id) => ({ incomplete_operation_type_id })),
        },
      }
    : {};

export const OperationTypeModel = {
  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.operation_types.findMany({
      where,
      skip,
      take,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { items: true } },
        nextOperations: nextOperationsInclude,
        reworkOperations: reworkOperationsInclude,
        incompleteOperations: incompleteOperationsInclude,
        reworkTarget: reworkTargetInclude,
        employees: employeesInclude,
        addedBy: addedByInclude,
      },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.operation_types.count({ where });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.operation_types.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.operation_types.findUnique({ where: { id: Number(id) } });
  },

  findWithRelations: async (id) => {
    const prisma = prismaContext.get();
    return prisma.operation_types.findUnique({
      where: { id: Number(id) },
      include: {
        nextOperations: nextOperationsInclude,
        reworkOperations: reworkOperationsInclude,
        incompleteOperations: incompleteOperationsInclude,
        reworkTarget: reworkTargetInclude,
        employees: employeesInclude,
        addedBy: addedByInclude,
      },
    });
  },

  findByName: async (name) => {
    const prisma = prismaContext.get();
    return prisma.operation_types.findUnique({ where: { name } });
  },

  countEmployees: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.employees.count({ where: { id: { in: ids } } });
  },

  // Первой операцией может быть один тип: новый "первый" снимает флаг с остальных
  // в той же транзакции.
  create: async ({ next_operation_type_ids, rework_operation_type_ids, incomplete_operation_type_ids, ...data }, employeeIds) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      if (data.is_first) await tx.operation_types.updateMany({ where: { is_first: true }, data: { is_first: false } });
      return tx.operation_types.create({
        data: {
          ...data,
          ...(next_operation_type_ids?.length
            ? { nextOperations: { create: next_operation_type_ids.map((next_operation_type_id) => ({ next_operation_type_id })) } }
            : {}),
          ...(rework_operation_type_ids?.length
            ? { reworkOperations: { create: rework_operation_type_ids.map((rework_operation_type_id) => ({ rework_operation_type_id })) } }
            : {}),
          ...(incomplete_operation_type_ids?.length
            ? {
                incompleteOperations: {
                  create: incomplete_operation_type_ids.map((incomplete_operation_type_id) => ({ incomplete_operation_type_id })),
                },
              }
            : {}),
          ...(employeeIds?.length
            ? { employees: { create: employeeIds.map((employee_id) => ({ employee_id })) } }
            : {}),
        },
        include: {
          employees: employeesInclude,
          nextOperations: nextOperationsInclude,
          reworkOperations: reworkOperationsInclude,
          incompleteOperations: incompleteOperationsInclude,
        },
      });
    });
  },

  update: async (id, { next_operation_type_ids, rework_operation_type_ids, incomplete_operation_type_ids, ...data }, employeeIds) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      if (data.is_first) {
        await tx.operation_types.updateMany({
          where: { is_first: true, id: { not: Number(id) } },
          data: { is_first: false },
        });
      }
      return tx.operation_types.update({
        where: { id: Number(id) },
        data: {
          ...data,
          ...nextOperationsWrite(next_operation_type_ids),
          ...reworkOperationsWrite(rework_operation_type_ids),
          ...incompleteOperationsWrite(incomplete_operation_type_ids),
          ...employeesWrite(employeeIds),
        },
        include: {
          employees: employeesInclude,
          nextOperations: nextOperationsInclude,
          reworkOperations: reworkOperationsInclude,
          incompleteOperations: incompleteOperationsInclude,
        },
      });
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.operation_types.delete({ where: { id: Number(id) } });
  },
};
