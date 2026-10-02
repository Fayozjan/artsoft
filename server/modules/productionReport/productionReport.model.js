import { prismaContext } from "../../utils/prismaContext.js";
import { userNameSelect } from "../../utils/userDisplayName.js";

// Поля сотрудника для EmployeeCell (фото, ФИО, филиал/отдел, статус).
const employeeSelect = {
  id: true,
  first_name: true,
  last_name: true,
  middle_name: true,
  employee_number: true,
  photo: true,
  status: true,
  branch: { select: { name: true } },
  department: { select: { name: true } },
  position: { select: { name: true } },
};

// Стикер для отчёта по стикерам: сам стикер, откуда он получен (parent) и доли
// остальных сотрудников, принятые вместе с ним (share_of_id).
const stickerSelect = {
  id: true,
  sticker_code: true,
  operation_type_id: true,
  status: true,
  split_kind: true,
  planned_quantity: true,
  actual_quantity: true,
  defect_quantity: true,
  rework_quantity: true,
  incomplete_quantity: true,
  rate: true,
  amount: true,
  comment: true,
  added_at: true,
  scanned_at: true,
  parent_sticker_id: true,
  employee_id: true,
  scanned_by: true,
  operationType: { select: { name: true } },
  batchReceiptItem: {
    select: {
      product_name: true,
      size: true,
      receipt: { select: { batch_number: true, customer: true } },
    },
  },
  employee: { select: employeeSelect },
  addedBy: { select: userNameSelect },
  scannedBy: { select: userNameSelect },
  parent: {
    select: { id: true, sticker_code: true, operationType: { select: { name: true } } },
  },
  shares: {
    orderBy: { id: "asc" },
    select: { id: true, actual_quantity: true, amount: true, employee: { select: employeeSelect } },
  },
  _count: { select: { children: true } },
};

export const ProductionReportModel = {
  findStickers: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findMany({
      where,
      skip,
      take,
      orderBy: [{ added_at: "desc" }, { id: "desc" }],
      select: stickerSelect,
    });
  },

  countStickers: async (where) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.count({ where });
  },

  countStickersByStatus: async (where) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.groupBy({ by: ["status"], where, _count: { _all: true } });
  },

  findStickersByIds: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findMany({
      where: { id: { in: ids } },
      select: stickerSelect,
    });
  },

  // Стикеры для правки цены: всё, что нужно пересчитать сумму — количество, единица
  // операции, размер позиции — и доли других сотрудников.
  findStickersForRateEdit: async (where) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findMany({
      where,
      orderBy: { id: "asc" },
      select: {
        id: true,
        sticker_code: true,
        rate: true,
        amount: true,
        actual_quantity: true,
        operationType: { select: { unit: true } },
        batchReceiptItem: { select: { size: true } },
        shares: {
          orderBy: { id: "asc" },
          select: { id: true, rate: true, amount: true, actual_quantity: true },
        },
      },
    });
  },

  // Цена и сумма строк (стикеры и их доли) одной транзакцией: при сбое посередине у одной
  // работы не должно остаться две разные цены.
  updateStickerRates: async (rows) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(
      async (tx) => {
        for (const { id, rate, amount } of rows) {
          await tx.work_stickers.update({ where: { id }, data: { rate, amount } });
        }
      },
      { timeout: 120000, maxWait: 10000 },
    );
  },

  // Стикеры, полученные разделением стикеров parentIds (по порядку создания)
  findStickerChildren: async (parentIds) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findMany({
      where: { parent_sticker_id: { in: parentIds } },
      orderBy: { id: "asc" },
      select: stickerSelect,
    });
  },

  // Журнал действий по стикерам: их собственные записи + удаления их дочерних стикеров
  // (удалённого стикера в work_stickers уже нет — от него остался только аудит).
  // «create» пишется один на всю напечатанную пачку, поэтому печать берём из самих строк.
  findStickerAuditLogs: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.audit_logs.findMany({
      where: {
        entity: "work_stickers",
        action: { in: ["update", "delete"] },
        OR: [
          { record_id: { in: ids } },
          {
            action: "delete",
            OR: ids.map((id) => ({ old_data: { path: ["parent_sticker_id"], equals: id } })),
          },
        ],
      },
      orderBy: [{ added_at: "asc" }, { id: "asc" }],
      select: {
        id: true,
        record_id: true,
        action: true,
        old_data: true,
        new_data: true,
        added_at: true,
        user: { select: userNameSelect },
      },
    });
  },

  // Возвраты на исправление, чей виновник (origin) подходит под условие: стикер исправления
  // с количеством к возврату и принятая работа виновника — по ней считается удержание
  // (основной сотрудник, его доли, цена операции, единица и размер для «цены за метр»).
  findReworkReturns: async (originWhere) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.findMany({
      where: { split_kind: "rework", origin_sticker_id: { not: null }, origin: originWhere },
      orderBy: { id: "asc" },
      select: {
        planned_quantity: true,
        origin: {
          select: {
            id: true,
            batch_receipt_item_id: true,
            operation_type_id: true,
            employee_id: true,
            actual_quantity: true,
            rate: true,
            operationType: { select: { unit: true } },
            batchReceiptItem: { select: { size: true } },
            shares: { select: { employee_id: true, actual_quantity: true, rate: true } },
          },
        },
      },
    });
  },

  // Сотрудники из ids, попадающие в доступ пользователя (access — where по employees)
  findAccessibleEmployeeIds: async (access, ids) => {
    const prisma = prismaContext.get();
    return prisma.employees.findMany({
      where: { ...access, id: { in: ids } },
      select: { id: true },
    });
  },

  findBatches: async (where) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipts.findMany({
      where,
      orderBy: [{ receipt_date: "desc" }, { id: "desc" }],
      select: {
        id: true,
        document_number: true,
        batch_number: true,
        receipt_date: true,
        order_number: true,
        customer: true,
        status: true,
        items: {
          select: {
            id: true,
            quantity: true,
            product_name: true,
            size: true,
            color: true,
            color_variant: true,
            color_tone: true,
            yarn_type: true,
            material: true,
            design: true,
            sort_order: true,
          },
        },
      },
    });
  },

  findItemsWithBatch: async (itemIds) => {
    const prisma = prismaContext.get();
    return prisma.batch_receipt_items.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        product_name: true,
        size: true,
        color: true,
        color_variant: true,
        color_tone: true,
        yarn_type: true,
        material: true,
        design: true,
        sort_order: true,
        receipt: {
          select: {
            id: true,
            batch_number: true,
            document_number: true,
            receipt_date: true,
            order_number: true,
            customer: true,
          },
        },
      },
    });
  },

  // Агрегат по стикерам: в БД схлопываем до (позиция × операция × сотрудник ×
  // статус × путь), а не тянем каждый стикер — у партии их тысячи.
  groupStickers: async ({ where, by }) => {
    const prisma = prismaContext.get();
    return prisma.work_stickers.groupBy({
      by,
      where,
      _count: { _all: true },
      _sum: {
        planned_quantity: true,
        actual_quantity: true,
        defect_quantity: true,
        rework_quantity: true,
        amount: true,
      },
      // Печать первого и приём последнего стикера группы — даты операции в отчёте по заказам
      _min: { added_at: true },
      _max: { scanned_at: true },
    });
  },

  findOperationTypes: async () => {
    const prisma = prismaContext.get();
    return prisma.operation_types.findMany({
      select: { id: true, name: true, unit: true, sort_order: true, is_final: true, is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
  },

  findEmployees: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.employees.findMany({
      where: { id: { in: ids } },
      select: employeeSelect,
    });
  },

  // Отдельные значения размера/дизайна/материала/граммажа — для выпадающих списков
  // фильтра «По стикерам». Только из позиций, по которым реально есть стикеры.
  findStickerItemAttributes: async () => {
    const prisma = prismaContext.get();
    const where = { workStickers: { some: {} } };
    const [sizes, designs, materials, grammages] = await Promise.all([
      prisma.batch_receipt_items.findMany({
        where: { ...where, size: { not: null } },
        distinct: ["size"],
        select: { size: true },
        orderBy: { size: "asc" },
      }),
      prisma.batch_receipt_items.findMany({
        where: { ...where, design: { not: null } },
        distinct: ["design"],
        select: { design: true },
        orderBy: { design: "asc" },
      }),
      prisma.batch_receipt_items.findMany({
        where: { ...where, material: { not: null } },
        distinct: ["material"],
        select: { material: true },
        orderBy: { material: "asc" },
      }),
      prisma.batch_receipt_items.findMany({
        where: { ...where, grammage: { not: null } },
        distinct: ["grammage"],
        select: { grammage: true },
        orderBy: { grammage: "asc" },
      }),
    ]);
    return {
      sizes: sizes.map((row) => row.size).filter(Boolean),
      designs: designs.map((row) => row.design).filter(Boolean),
      materials: materials.map((row) => row.material).filter(Boolean),
      grammages: grammages.map((row) => row.grammage),
    };
  },
};
