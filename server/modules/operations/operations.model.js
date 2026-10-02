import { prismaContext } from "../../utils/prismaContext.js";
import { userNameSelect } from "../../utils/userDisplayName.js";

const addedByInclude = {
  select: userNameSelect,
};

const itemsInclude = {
  orderBy: { sort_order: "asc" },
  include: {
    employee: { select: { id: true, first_name: true, last_name: true } },
    operationType: { select: { id: true, name: true, unit: true } },
  },
};

export const OperationModel = {
  findMany: async ({ where, skip, take, orderBy }) => {
    const prisma = prismaContext.get();
    return prisma.operations.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || { operation_date: "desc" },
      include: {
        addedBy: addedByInclude,
        _count: { select: { items: true } },
        items: { select: { amount: true } },
      },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.operations.count({ where });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.operations.findUnique({
      where: { id: Number(id) },
      include: { addedBy: addedByInclude, items: itemsInclude },
    });
  },

  // document_number — системный, не вводится пользователем. Берём nextval
  // той же последовательности, что и id, и используем его для обоих полей —
  // это гарантирует уникальность без отдельной таблицы счётчиков.
  createWithItems: async (headerData, items) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      const [{ val }] = await tx.$queryRaw`SELECT nextval(pg_get_serial_sequence('operations', 'id')) AS val`;
      const nextId = Number(val);
      const documentNumber = `ОП-${String(nextId).padStart(6, "0")}`;

      return tx.operations.create({
        data: {
          id: nextId,
          document_number: documentNumber,
          ...headerData,
          items: { create: items },
        },
        include: { addedBy: addedByInclude, items: itemsInclude },
      });
    });
  },

  updateWithItems: async (id, headerData, items) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      await tx.operation_items.deleteMany({ where: { operation_id: Number(id) } });
      return tx.operations.update({
        where: { id: Number(id) },
        data: {
          ...headerData,
          items: { create: items },
        },
        include: { addedBy: addedByInclude, items: itemsInclude },
      });
    });
  },

  updateStatus: async (id, status) => {
    const prisma = prismaContext.get();
    return prisma.operations.update({
      where: { id: Number(id) },
      data: { status },
      include: { addedBy: addedByInclude, items: itemsInclude },
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.operations.delete({ where: { id: Number(id) } });
  },
};
