import { prismaContext } from "../../utils/prismaContext.js";
import { userNameSelect } from "../../utils/userDisplayName.js";

const includeFull = {
  batchReceiptItem: {
    select: {
      id: true,
      color: true,
      color_variant: true,
      size: true,
      material: true,
      design: true,
      quantity: true,
      receipt: { select: { id: true, document_number: true, batch_number: true, customer: true } },
    },
  },
  operationType: {
    select: {
      id: true,
      name: true,
      unit: true,
      sort_order: true,
      is_final: true,
      allow_merge: true,
      allow_incomplete: true,
      employees: { select: { employee_id: true } },
      nextOperations: {
        select: { nextOperationType: { select: { id: true, name: true, price: true, is_rework: true } } },
      },
      reworkOperations: {
        select: {
          reworkOperationType: {
            select: { id: true, name: true, price: true, is_rework: true, rework_target_operation_type_id: true },
          },
        },
      },
      incompleteOperations: {
        select: { incompleteOperationType: { select: { id: true, name: true, price: true, is_rework: true } } },
      },
    },
  },
  // Поля для EmployeeCell (фото, ФИО, филиал/отдел, статус) — как в таблице сотрудников.
  employee: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      photo: true,
      status: true,
      branch: { select: { name: true } },
      department: { select: { name: true } },
    },
  },
  addedBy: { select: userNameSelect },
  scannedBy: { select: userNameSelect },
  parent: {
    select: { id: true, sticker_code: true, split_kind: true, operationType: { select: { id: true, name: true } } },
  },
  // Для стикера исправления — операция-виновник, которую вернули на исправление
  // (см. origin_sticker_id): операция и сотрудник, принявший её работу.
  origin: {
    select: {
      id: true,
      sticker_code: true,
      operationType: { select: { id: true, name: true } },
      employee: { select: { id: true, first_name: true, last_name: true, middle_name: true } },
    },
  },
  // split_kind нужен, чтобы отличить стикеры брака/исправления/не выполненного (годное
  // ждёт объединения) от раздачи годного на следующую операцию ("normal").
  children: { select: { id: true, split_kind: true } },
  // Куда ушло годное этого стикера при объединении (см. merged_into_id) — код
  // результата, операция, куда его передали, и остальные источники того же
  // объединения (для "объединён вместе с ..." в карточке).
  mergedInto: {
    select: {
      id: true,
      sticker_code: true,
      planned_quantity: true,
      operationType: { select: { id: true, name: true } },
      mergedSources: { select: { id: true, sticker_code: true } },
    },
  },
  // Если сам этот стикер — результат объединения: из каких стикеров он собран.
  mergedSources: { select: { id: true, sticker_code: true } },
  // Доли других сотрудников, принятые вместе с этим стикером (см. share_of_id в схеме).
  shares: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      sticker_code: true,
      actual_quantity: true,
      amount: true,
      employee: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          middle_name: true,
          photo: true,
          status: true,
          branch: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
  },
};

// sticker_code — системный, берём nextval той же последовательности, что и id
// (по образцу operations/batch_receipts), без отдельной таблицы счётчиков.
// Стикеров могут быть тысячи (по стикеру на штуку) — id берём одним запросом и
// вставляем createMany, а не по 2 запроса на стикер: иначе транзакция не
// укладывается в таймаут. Возвращает id вставленных строк по порядку.
// Префикс латиницей (ST), не кириллицей: код зашивается в QR/DataMatrix и
// сканируется как HID-клавиатура — кириллица там читается по раскладке ОС и
// превращается в мусорные символы вместо "СТ".
const insertRows = async (tx, rows) => {
  const vals = await tx.$queryRaw`
    SELECT nextval(pg_get_serial_sequence('work_stickers', 'id')) AS val
    FROM generate_series(1, ${rows.length}::int)`;
  const ids = vals.map((v) => Number(v.val)).sort((a, b) => a - b);

  await tx.work_stickers.createMany({
    data: rows.map((row, i) => ({
      id: ids[i],
      sticker_code: `ST-${String(ids[i]).padStart(6, "0")}`,
      ...row,
    })),
  });
  return ids;
};

export const WorkStickerModel = {
  findMany: async ({ where, skip, take, orderBy }) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || { added_at: "desc" },
      include: includeFull,
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.count({ where });
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findUnique({
      where: { id: Number(id) },
      include: includeFull,
    });
  },

  findByCode: async (code) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findUnique({
      where: { sticker_code: code },
      include: includeFull,
    });
  },

  findManyByIds: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findMany({
      where: { id: { in: ids.map(Number) } },
      include: includeFull,
    });
  },

  // Вставляем пачку и читаем обратно — по коду не найти, поэтому по id.
  createBatch: async (rows) => {
    if (rows.length === 0) return [];
    const prisma = prismaContext.get();
    return prisma.$transaction(
      async (tx) => {
        const ids = await insertRows(tx, rows);

        return tx.work_stickers.findMany({
          where: { id: { in: ids } },
          orderBy: { id: "asc" },
          include: includeFull,
        });
      },
      { timeout: 120000, maxWait: 10000 },
    );
  },

  // Раздача с "объединить с другими": стикеры брака/исправления/не выполненного
  // (rows, могут быть пусты) и отметка "ждёт объединения" на самом стикере — одной
  // транзакцией, иначе сбой между ними оставил бы напечатанные стикеры без отметки.
  createBatchAwaitingMerge: async (id, rows) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(
      async (tx) => {
        const ids = rows.length > 0 ? await insertRows(tx, rows) : [];
        await tx.work_stickers.update({ where: { id: Number(id) }, data: { awaiting_merge: true } });
        if (ids.length === 0) return [];

        return tx.work_stickers.findMany({
          where: { id: { in: ids } },
          orderBy: { id: "asc" },
          include: includeFull,
        });
      },
      { timeout: 120000, maxWait: 10000 },
    );
  },

  // Сумма planned_quantity всех стикеров по позиции — сколько из quantity позиции уже
  // распределено на работу. С `operationTypeId` — только по этой операции.
  sumPlannedByItem: async (itemId, operationTypeId) => {
    const prisma = prismaContext.get();
    const result = await prisma.work_stickers.aggregate({
      where: {
        batch_receipt_item_id: Number(itemId),
        ...(operationTypeId ? { operation_type_id: Number(operationTypeId) } : {}),
        // Стикер брака — те же штуки, что уже учтены в стикере, где их забраковали.
        OR: [{ split_kind: null }, { split_kind: { not: "scrap" } }],
      },
      _sum: { planned_quantity: true },
    });
    return Number(result._sum.planned_quantity || 0);
  },

  // Приём (или его отмена) вместе с долями сотрудников — одной транзакцией: прежние
  // доли стикера удаляются, вставляются новые (shareRows, пусто при отмене), затем
  // обновляется сам стикер. Иначе сбой посередине оставил бы доли без приёма.
  scanWithShares: async (id, data, shareRows = []) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(
      async (tx) => {
        await tx.work_stickers.deleteMany({ where: { share_of_id: Number(id) } });
        if (shareRows.length > 0) {
          await insertRows(
            tx,
            shareRows.map((row) => ({ ...row, share_of_id: Number(id) })),
          );
        }
        return tx.work_stickers.update({
          where: { id: Number(id) },
          data,
          include: includeFull,
        });
      },
      { timeout: 30000, maxWait: 10000 },
    );
  },

  // Удалили результат объединения — FK merged_into_id (onDelete: SetNull) сам
  // расцепляет источники. Тем из них, у кого стикеры брака/исправления/не выполненного
  // уже напечатаны (есть дети), снова ставим "ждёт объединения": иначе годное такого
  // источника осталось бы без пути дальше (раздать повторно нельзя — дети уже есть).
  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      const sources = await tx.work_stickers.findMany({
        where: { merged_into_id: Number(id) },
        select: { id: true },
      });
      const result = await tx.work_stickers.delete({ where: { id: Number(id) } });
      if (sources.length > 0) {
        await tx.work_stickers.updateMany({
          where: { id: { in: sources.map((source) => source.id) }, children: { some: {} } },
          data: { awaiting_merge: true },
        });
      }
      return result;
    });
  },

  setAwaitingMerge: async (id, value) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.update({
      where: { id: Number(id) },
      data: { awaiting_merge: value },
      include: includeFull,
    });
  },

  // Объединение: extraRows (брак/исправление источников, каждый со своим
  // parent_sticker_id) + mergedRow (общий результат) вставляются одной пачкой —
  // mergedRow всегда последняя строка, поэтому последний id из insertRows её.
  // Источники получают merged_into_id одним updateMany в той же транзакции.
  mergeAdvance: async (sourceIds, extraRows, mergedRow) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(
      async (tx) => {
        const ids = await insertRows(tx, [...extraRows, mergedRow]);
        const mergedId = ids[ids.length - 1];

        await tx.work_stickers.updateMany({
          where: { id: { in: sourceIds.map(Number) } },
          data: { merged_into_id: mergedId, awaiting_merge: false },
        });

        return tx.work_stickers.findMany({
          where: { id: { in: ids } },
          orderBy: { id: "asc" },
          include: includeFull,
        });
      },
      { timeout: 60000, maxWait: 10000 },
    );
  },

  // Узлы цепочки для поиска операции-виновника: стикеры по id — с типом операции и
  // связями вверх (родитель, источники объединения).
  findLineageNodes: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findMany({
      where: { id: { in: ids.map(Number) } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        status: true,
        split_kind: true,
        share_of_id: true,
        parent_sticker_id: true,
        operationType: { select: { id: true, name: true } },
        mergedSources: { select: { id: true } },
      },
    });
  },

  countChildren: async (parentId) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.count({ where: { parent_sticker_id: Number(parentId) } });
  },
};
