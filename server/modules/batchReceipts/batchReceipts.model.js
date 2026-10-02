import { prismaContext } from "../../utils/prismaContext.js";
import { userNameSelect } from "../../utils/userDisplayName.js";

const addedByInclude = {
  select: userNameSelect,
};

// У позиции свой автор: её могут дописать в партию другим пользователем.
// _count.workStickers > 0 — по позиции уже начата работа (печатались стикеры).
const itemsInclude = {
  orderBy: { sort_order: "asc" },
  include: { addedBy: addedByInclude, _count: { select: { workStickers: true } } },
};

export const BatchReceiptModel = {
  findMany: async ({ where, skip, take, orderBy }) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipts.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || { receipt_date: "desc" },
      include: { addedBy: addedByInclude, _count: { select: { items: true } } },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipts.count({ where });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipts.findUnique({
      where: { id: Number(id) },
      include: {
        addedBy: addedByInclude,
        items: itemsInclude,
      },
    });
  },

  findByBatchNumber: async (batchNumber) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipts.findUnique({ where: { batch_number: batchNumber } });
  },

  // document_number — системный, не вводится пользователем. Берём nextval
  // той же последовательности, что и id, и используем его для обоих полей —
  // это гарантирует уникальность без отдельной таблицы счётчиков.
  createWithItems: async (headerData, items) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      const [{ val }] = await tx.$queryRaw`SELECT nextval(pg_get_serial_sequence('batch_receipts', 'id')) AS val`;
      const nextId = Number(val);
      const documentNumber = String(nextId);

      return tx.batch_receipts.create({
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

  // Позиции правятся точечно (а не пересоздаются): у позиции с начатой работой
  // есть стикеры, а они каскадно удаляются вместе с позицией.
  updateWithItems: async (id, headerData, { toCreate, toUpdate, deleteIds }) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      if (deleteIds.length > 0) {
        await tx.batch_receipt_items.deleteMany({
          where: { id: { in: deleteIds }, receipt_id: Number(id) },
        });
      }
      for (const { id: itemId, data } of toUpdate) {
        await tx.batch_receipt_items.update({ where: { id: itemId }, data });
      }
      return tx.batch_receipts.update({
        where: { id: Number(id) },
        data: {
          ...headerData,
          items: { create: toCreate },
        },
        include: { addedBy: addedByInclude, items: itemsInclude },
      });
    });
  },

  // Добавление позиций в уже существующую партию — разрешено независимо от
  // статуса (draft/accepted), не трогает шапку и старые позиции.
  appendItems: async (id, items) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipts.update({
      where: { id: Number(id) },
      data: { items: { create: items } },
      include: { addedBy: addedByInclude, items: itemsInclude },
    });
  },

  // Условие "стикеров нет" — прямо в deleteMany: между проверкой в сервисе и
  // удалением кто-то мог напечатать стикер, а он каскадно удалился бы вместе с позицией.
  deleteItemIfNotStarted: async (id, itemId) => {
    const prisma = prismaContext.get();
    const { count } = await prisma.batch_receipt_items.deleteMany({
      where: { id: Number(itemId), receipt_id: Number(id), workStickers: { none: {} } },
    });
    return count > 0;
  },

  countItems: async (id) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipt_items.count({ where: { receipt_id: Number(id) } });
  },

  updateStatus: async (id, status) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipts.update({
      where: { id: Number(id) },
      data: { status },
      include: { addedBy: addedByInclude, items: itemsInclude },
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipts.delete({ where: { id: Number(id) } });
  },
};
