import { prismaContext } from "../../utils/prismaContext.js";
import { Prisma } from "../../prisma-clients/client/index.js";

const productSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  unit: { select: { id: true, name: true, short_name: true } },
};

const locationSelect = {
  id: true,
  name: true,
  complete_name: true,
  branch: { select: { id: true, name: true } },
};

// Остатки хранятся по партиям (stock_quants.lot_id, см. stock_lots) — для
// этого отчёта партии не важны, сворачиваем обратно SUM(qty) по
// product_id+location_id, чтобы строка осталась одна на товар+склад, как и до
// появления партий (клиент/контракт API не меняется).
const buildBalancesWhere = ({ locationId, branchId, search }) => {
  const conditions = [Prisma.sql`l.type = 'internal'`];
  if (locationId) conditions.push(Prisma.sql`l.id = ${locationId}`);
  if (branchId) conditions.push(Prisma.sql`l.branch_id = ${branchId}`);
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      Prisma.sql`(p.name ILIKE ${like} OR p.sku ILIKE ${like} OR p.barcode ILIKE ${like})`,
    );
  }
  return Prisma.join(conditions, " AND ");
};

export const StockReportModel = {
  findBalances: async ({ locationId, branchId, search, showZero, skip, take }) => {
    const prisma = prismaContext.get();
    const where = buildBalancesWhere({ locationId, branchId, search });
    const having = showZero ? Prisma.empty : Prisma.sql`HAVING SUM(q.qty) != 0`;

    const rows = await prisma.$queryRaw`
      SELECT
        p.id AS product_id, p.name AS product_name, p.sku, p.barcode,
        u.id AS unit_id, u.name AS unit_name, u.short_name AS unit_short_name,
        l.id AS location_id, l.name AS location_name, l.complete_name AS location_complete_name,
        b.id AS branch_id, b.name AS branch_name,
        SUM(q.qty) AS qty
      FROM stock_quants q
      JOIN products p ON p.id = q.product_id
      JOIN units u ON u.id = p.unit_id
      JOIN stock_locations l ON l.id = q.location_id
      LEFT JOIN branches b ON b.id = l.branch_id
      WHERE ${where}
      GROUP BY p.id, p.name, p.sku, p.barcode, u.id, u.name, u.short_name, l.id, l.name, l.complete_name, b.id, b.name
      ${having}
      ORDER BY p.name ASC, l.complete_name ASC
      LIMIT ${take} OFFSET ${skip}
    `;

    return rows.map((r) => ({
      product_id: r.product_id,
      location_id: r.location_id,
      qty: Number(r.qty),
      product: { id: r.product_id, name: r.product_name, sku: r.sku, barcode: r.barcode, unit: { id: r.unit_id, name: r.unit_name, short_name: r.unit_short_name } },
      location: { id: r.location_id, name: r.location_name, complete_name: r.location_complete_name, branch: r.branch_id ? { id: r.branch_id, name: r.branch_name } : null },
    }));
  },

  countBalances: async ({ locationId, branchId, search, showZero }) => {
    const prisma = prismaContext.get();
    const where = buildBalancesWhere({ locationId, branchId, search });
    const having = showZero ? Prisma.empty : Prisma.sql`HAVING SUM(q.qty) != 0`;

    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM (
        SELECT q.product_id
        FROM stock_quants q
        JOIN products p ON p.id = q.product_id
        JOIN stock_locations l ON l.id = q.location_id
        WHERE ${where}
        GROUP BY q.product_id, q.location_id
        ${having}
      ) t
    `;
    return rows[0]?.count ?? 0;
  },

  findMovements: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.stock_moves.findMany({
      where,
      skip,
      take,
      orderBy: { id: "desc" },
      include: {
        product: { select: productSelect },
        unit: { select: { id: true, name: true, short_name: true } },
        locationSrc: { select: locationSelect },
        locationDest: { select: locationSelect },
        picking: {
          select: {
            id: true,
            name: true,
            date_done: true,
            type: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  },

  countMovements: async (where) => {
    const prisma = prismaContext.get();
    return prisma.stock_moves.count({ where });
  },

  // Сумма qty_done по товару — приход/расход по складу за период (для оборотной ведомости)
  sumMovesByProduct: async (where) => {
    const prisma = prismaContext.get();
    return prisma.stock_moves.groupBy({
      by: ["product_id"],
      where,
      _sum: { qty_done: true },
    });
  },

  // То же, но с разбивкой по партии (lot_id) — для раскрытия строки оборотной
  // ведомости: товар в where уже сужен до одного product_id.
  sumMovesByProductLot: async (where) => {
    const prisma = prismaContext.get();
    return prisma.stock_moves.groupBy({
      by: ["lot_id"],
      where,
      _sum: { qty_done: true },
    });
  },

  findProductsByIds: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.products.findMany({ where: { id: { in: ids } }, select: productSelect });
  },

  findLotsByIds: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.stock_lots.findMany({
      where: { id: { in: ids } },
      include: {
        attributeValues: {
          include: {
            attribute: { select: { id: true, name: true } },
            attributeValue: { select: { id: true, value: true } },
          },
        },
      },
    });
  },

  findLocationById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.stock_locations.findUnique({ where: { id }, select: locationSelect });
  },

  // Разбивка остатка товар+склад по партиям (цена/описание/характеристики) —
  // подгружается лениво при раскрытии строки в отчёте.
  findBalanceLots: async ({ productId, locationId }) => {
    const prisma = prismaContext.get();
    return prisma.stock_quants.findMany({
      where: { product_id: productId, location_id: locationId, qty: { not: 0 } },
      orderBy: { id: "asc" },
      include: {
        lot: {
          include: {
            attributeValues: {
              include: {
                attribute: { select: { id: true, name: true } },
                attributeValue: { select: { id: true, value: true } },
              },
            },
          },
        },
      },
    });
  },
};
