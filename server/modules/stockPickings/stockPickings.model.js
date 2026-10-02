import { prismaContext } from "../../utils/prismaContext.js";
import { userNameSelect } from "../../utils/userDisplayName.js";

const addedByInclude = { select: userNameSelect };
const locationSelect = { select: { id: true, name: true, complete_name: true, type: true, branch: { select: { name: true } } } };
const partnerSelect = { select: { id: true, name: true } };
const currencySelect = { select: { id: true, code: true, name: true, symbol: true, is_base: true } };
const managerSelect = { select: { id: true, first_name: true, last_name: true } };

const lotAttributeValuesInclude = {
  include: {
    attribute: { select: { id: true, name: true } },
    attributeValue: { select: { id: true, value: true } },
  },
};

const movesInclude = {
  orderBy: { id: "asc" },
  include: {
    product: { select: { id: true, name: true, sku: true, description: true } },
    unit: { select: { id: true, name: true, short_name: true } },
    locationSrc: locationSelect,
    locationDest: locationSelect,
    attributeValues: {
      include: {
        attribute: { select: { id: true, name: true } },
        attributeValue: { select: { id: true, value: true } },
      },
    },
    // Партия, с которой реально списано/на которую оприходовано (см.
    // applyQuantDelta) — нужна карточке документа и форме редактирования,
    // чтобы показать и заблокировать цену/описание/характеристики партии.
    lot: {
      select: {
        id: true,
        price_unit: true,
        note: true,
        attributeValues: lotAttributeValuesInclude,
      },
    },
  },
};

const fullInclude = {
  type: true,
  srcPartner: partnerSelect,
  destPartner: partnerSelect,
  locationSrc: locationSelect,
  locationDest: locationSelect,
  currency: currencySelect,
  manager: managerSelect,
  addedBy: addedByInclude,
  confirmedBy: addedByInclude,
  doneBy: addedByInclude,
  moves: movesInclude,
};

// Виртуальные локации (поставщики/клиенты/цех/расходы/…) — бесконечный
// источник/приёмник, остатки по ним не считаем. Только type=internal.
// lotId — обязательный параметр на стороне приложения (см. комментарий у
// stock_quants в схеме): для расхода/перемещения он выбран пользователем в
// UI, для прихода — резолвится resolveOrCreateLot() в validate() ниже.
// qtyPackagesDelta — отдельный параллельный остаток "кол-во упаковок" (тоже
// вводится вручную на приходе, как и qty) — решили трекать его так же честно,
// как qty, а не оценочным коэффициентом (нет поля "единиц в упаковке" у товара).
export const applyQuantDelta = async (tx, productId, locationId, lotId, qtyDelta, qtyPackagesDelta = 0) => {
  if (qtyDelta === 0 && qtyPackagesDelta === 0) return;
  const location = await tx.stock_locations.findUnique({ where: { id: locationId }, select: { type: true } });
  if (location?.type !== "internal") return;

  await tx.stock_quants.upsert({
    where: { product_id_location_id_lot_id: { product_id: productId, location_id: locationId, lot_id: lotId } },
    create: { product_id: productId, location_id: locationId, lot_id: lotId, qty: qtyDelta, qty_packages: qtyPackagesDelta },
    update: { qty: { increment: qtyDelta }, qty_packages: { increment: qtyPackagesDelta } },
  });
};

// Партия = связка (товар, цена, описание, набор характеристик). Приход ищет
// среди партий этого товара совпадение по цене+описанию, затем сверяет точный
// набор характеристик (не просто пересечение) — находит, если да, иначе
// создаёт новую. Пустые price_unit/note/атрибуты — тоже валидная, общая для
// всех "неразличимых" поступлений связка.
const resolveOrCreateLot = async (tx, { product_id, price_unit, note, attributeValues }) => {
  const normPrice = price_unit === null || price_unit === undefined || price_unit === "" ? null : Number(price_unit);
  const normNote = note && String(note).trim() !== "" ? String(note).trim() : null;
  const pairs = (attributeValues || []).map((a) => ({
    attribute_id: a.attribute_id,
    attribute_value_id: a.attribute_value_id,
  }));
  const sortedKey = [...pairs]
    .sort((a, b) => a.attribute_id - b.attribute_id)
    .map((p) => `${p.attribute_id}:${p.attribute_value_id}`)
    .join(",");

  const candidates = await tx.stock_lots.findMany({
    where: { product_id, price_unit: normPrice, note: normNote },
    include: { attributeValues: { select: { attribute_id: true, attribute_value_id: true } } },
  });
  const match = candidates.find((lot) => {
    const key = [...lot.attributeValues]
      .sort((a, b) => a.attribute_id - b.attribute_id)
      .map((p) => `${p.attribute_id}:${p.attribute_value_id}`)
      .join(",");
    return key === sortedKey;
  });
  if (match) return match.id;

  const created = await tx.stock_lots.create({
    data: { product_id, price_unit: normPrice, note: normNote, attributeValues: { create: pairs } },
  });
  return created.id;
};

// Остаток "на момент документа", а не текущий snapshot: считаем по всем
// проведённым (done) документам с эффективной датой <= даты этого документа
// (кроме самого себя — иначе повторное проведение после отмены упрётся в
// собственные старые движения). Эффективная дата — scheduled_date, а если не
// задана — created_at. Так не-реальный остаток ("пришло в 09:00, расход в 08:00
// того же дня") не засчитывается, даже если оба документа проводятся сейчас.
// Считаем по конкретной партии (lotId) — у разных партий одного товара остаток
// не общий.
const getAvailableQtyAsOf = async (tx, productId, locationId, lotId, asOf, excludePickingId) => {
  const rows = await tx.$queryRaw`
    SELECT
      COALESCE(SUM(CASE WHEN m.location_dest_id = ${locationId} THEN m.qty_done ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN m.location_src_id = ${locationId} THEN m.qty_done ELSE 0 END), 0) AS qty,
      COALESCE(SUM(CASE WHEN m.location_dest_id = ${locationId} THEN m.qty_packages ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN m.location_src_id = ${locationId} THEN m.qty_packages ELSE 0 END), 0) AS qty_packages
    FROM stock_moves m
    JOIN stock_pickings p ON p.id = m.picking_id
    WHERE m.product_id = ${productId}
      AND m.lot_id = ${lotId}
      AND p.state = 'done'
      AND p.id != ${excludePickingId}
      AND (m.location_dest_id = ${locationId} OR m.location_src_id = ${locationId})
      AND COALESCE(p.scheduled_date, p.created_at) <= ${asOf}
  `;
  return { qty: Number(rows[0]?.qty ?? 0), qtyPackages: Number(rows[0]?.qty_packages ?? 0) };
};

// Виртуальный источник (поставщик/производство/...) — бесконечный, остатки по
// нему не считаем (см. applyQuantDelta). Проверяем только физические (internal)
// локации-источники, и суммарно по строкам документа (две строки одного товара
// из одного склада должны вместе уложиться в остаток, а не каждая по отдельности).
const assertStockAvailable = async (tx, picking) => {
  const asOf = picking.scheduled_date || picking.created_at;
  const required = new Map();
  for (const move of picking.moves) {
    const key = `${move.product_id}:${move.lot_id}:${move.location_src_id}`;
    const entry = required.get(key) || {
      product_id: move.product_id,
      lot_id: move.lot_id,
      location_src_id: move.location_src_id,
      qty: 0,
      qtyPackages: 0,
    };
    entry.qty += Number(move.qty_demand);
    entry.qtyPackages += Number(move.qty_packages) || 0;
    required.set(key, entry);
  }

  for (const { product_id, lot_id, location_src_id, qty, qtyPackages } of required.values()) {
    const location = await tx.stock_locations.findUnique({ where: { id: location_src_id }, select: { type: true } });
    if (location?.type !== "internal") continue;

    const available = await getAvailableQtyAsOf(tx, product_id, location_src_id, lot_id, asOf, picking.id);
    if (qty > available.qty) {
      const product = await tx.products.findUnique({ where: { id: product_id }, select: { name: true } });
      const err = new Error(
        `Недостаточно остатка «${product?.name ?? product_id}» на складе (доступно: ${available.qty}, требуется: ${qty})`,
      );
      err.code = "INSUFFICIENT_STOCK";
      throw err;
    }
    if (qtyPackages > available.qtyPackages) {
      const product = await tx.products.findUnique({ where: { id: product_id }, select: { name: true } });
      const err = new Error(
        `Недостаточно упаковок «${product?.name ?? product_id}» на складе (доступно: ${available.qtyPackages}, требуется: ${qtyPackages})`,
      );
      err.code = "INSUFFICIENT_STOCK";
      throw err;
    }
  }
};

export const StockPickingModel = {
  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    const rows = await prisma.stock_pickings.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: "desc" },
      include: {
        type: { select: { id: true, name: true, code: true } },
        srcPartner: partnerSelect,
        destPartner: partnerSelect,
        locationSrc: locationSelect,
        locationDest: locationSelect,
        currency: currencySelect,
        manager: managerSelect,
        addedBy: addedByInclude,
        confirmedBy: addedByInclude,
        doneBy: addedByInclude,
        editedBy: addedByInclude,
        _count: { select: { moves: true } },
        moves: { select: { qty_demand: true, qty_packages: true, price_unit: true } },
      },
    });

    // Итоги по строкам считаем тут же, чтобы не гонять сами строки на клиент
    // ради одной суммы в списке — детально они видны на карточке документа.
    return rows.map(({ moves, ...row }) => ({
      ...row,
      total_qty: moves.reduce((sum, m) => sum + Number(m.qty_demand || 0), 0),
      total_packages: moves.reduce((sum, m) => sum + Number(m.qty_packages || 0), 0),
      amount: moves.reduce((sum, m) => sum + Number(m.qty_demand || 0) * Number(m.price_unit || 0), 0),
    }));
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.stock_pickings.count({ where });
  },

  findDistinctOrigins: async () => {
    const prisma = prismaContext.get();
    const rows = await prisma.stock_pickings.findMany({
      where: { origin: { not: null } },
      distinct: ["origin"],
      select: { origin: true },
      orderBy: { origin: "asc" },
      take: 100,
    });
    return rows.map((r) => r.origin);
  },

  findUnique: async (id) => {
    const prisma = prismaContext.get();
    return prisma.stock_pickings.findUnique({ where: { id: Number(id) }, include: fullInclude });
  },

  findType: async (typeId) => {
    const prisma = prismaContext.get();
    return prisma.stock_picking_types.findUnique({ where: { id: typeId } });
  },

  findLocationType: async (locationId) => {
    const prisma = prismaContext.get();
    const location = await prisma.stock_locations.findUnique({ where: { id: locationId }, select: { type: true } });
    return location?.type ?? null;
  },

  // Остаток на складе прямо сейчас — по партиям (не свёрнуто по товару): для
  // выбора конкретной партии на расход (только то, что реально есть; qty > 0
  // отсекает нулевые/отрицательные строки кэша).
  findStockBalance: async (locationId) => {
    const prisma = prismaContext.get();
    return prisma.stock_quants.findMany({
      where: { location_id: Number(locationId), qty: { gt: 0 } },
      select: {
        product_id: true,
        lot_id: true,
        qty: true,
        qty_packages: true,
        lot: { select: { price_unit: true, note: true, attributeValues: lotAttributeValuesInclude } },
      },
    });
  },

  // Номер документа — тот же приём, что и в batchReceipts: nextval сиквенса
  // id используем и как PK, и как часть номера (PREFIX-id) — уникальность без
  // отдельной таблицы счётчиков и без гонки при параллельном создании.
  createWithMoves: async (headerData, moves, prefix) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      const [{ val }] = await tx.$queryRaw`SELECT nextval(pg_get_serial_sequence('stock_pickings', 'id')) AS val`;
      const nextId = Number(val);
      const name = `${prefix}-${nextId}`;

      return tx.stock_pickings.create({
        data: {
          id: nextId,
          name,
          ...headerData,
          moves: { create: moves },
        },
        include: fullInclude,
      });
    });
  },

  updateWithMoves: async (id, headerData, moves) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      await tx.stock_moves.deleteMany({ where: { picking_id: Number(id) } });
      return tx.stock_pickings.update({
        where: { id: Number(id) },
        data: { ...headerData, moves: { create: moves } },
        include: fullInclude,
      });
    });
  },

  updateState: async (id, state, extra = {}) => {
    const prisma = prismaContext.get();
    return prisma.stock_pickings.update({
      where: { id: Number(id) },
      data: { state, ...extra },
      include: fullInclude,
    });
  },

  // Проводит документ: каждая строка получает qty_done = qty_demand, остатки
  // на физических складах (src -qty, dest +qty) обновляются в той же транзакции.
  // Партия (lot_id): для расхода/перемещения уже выбрана пользователем на
  // строке, для прихода (lot_id пуст) резолвится/создаётся здесь по
  // price_unit+note+характеристикам строки и фиксируется на move навсегда.
  validate: async (id, userId) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      const picking = await tx.stock_pickings.findUnique({
        where: { id: Number(id) },
        include: { moves: { include: { attributeValues: true } } },
      });
      await assertStockAvailable(tx, picking);
      for (const move of picking.moves) {
        const qty = Number(move.qty_demand);
        const qtyPackages = Number(move.qty_packages) || 0;
        const lotId =
          move.lot_id ??
          (await resolveOrCreateLot(tx, {
            product_id: move.product_id,
            price_unit: move.price_unit,
            note: move.note,
            attributeValues: move.attributeValues,
          }));
        await tx.stock_moves.update({ where: { id: move.id }, data: { qty_done: qty, state: "done", lot_id: lotId } });
        await applyQuantDelta(tx, move.product_id, move.location_src_id, lotId, -qty, -qtyPackages);
        await applyQuantDelta(tx, move.product_id, move.location_dest_id, lotId, qty, qtyPackages);
      }
      return tx.stock_pickings.update({
        where: { id: Number(id) },
        data: { state: "done", date_done: new Date(), done_by: Number(userId) },
        include: fullInclude,
      });
    });
  },

  // Откатывает остатки, применённые в validate — используется в cancel() при
  // отмене проведённого документа (done -> confirmed). Партия уже зафиксирована
  // на move в validate(), здесь не пересчитывается — откатываем на ту же.
  rollbackQuants: async (tx, moves) => {
    for (const move of moves) {
      const qty = Number(move.qty_done);
      const qtyPackages = Number(move.qty_packages) || 0;
      if (qty === 0 && qtyPackages === 0) continue;
      await applyQuantDelta(tx, move.product_id, move.location_src_id, move.lot_id, qty, qtyPackages);
      await applyQuantDelta(tx, move.product_id, move.location_dest_id, move.lot_id, -qty, -qtyPackages);
    }
  },

  // Отмена на шаг назад: done -> confirmed откатывает остатки и qty_done,
  // confirmed -> draft просто снимает отметку о подтверждении.
  cancel: async (id, fromState) => {
    const prisma = prismaContext.get();
    return prisma.$transaction(async (tx) => {
      if (fromState === "done") {
        const picking = await tx.stock_pickings.findUnique({ where: { id: Number(id) }, include: { moves: true } });
        await StockPickingModel.rollbackQuants(tx, picking.moves);
        await tx.stock_moves.updateMany({ where: { picking_id: Number(id) }, data: { qty_done: 0, state: "draft" } });
        return tx.stock_pickings.update({
          where: { id: Number(id) },
          data: { state: "confirmed", date_done: null, done_by: null },
          include: fullInclude,
        });
      }

      return tx.stock_pickings.update({
        where: { id: Number(id) },
        data: { state: "draft", confirmed_by: null, confirmed_at: null },
        include: fullInclude,
      });
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.stock_pickings.delete({ where: { id: Number(id) } });
  },
};
