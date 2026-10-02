import { StockReportModel } from "./stockReport.model.js";

const toInt = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
};

const paginate = (page, pageSize) => {
  const currentPage = Math.max(parseInt(page || 1), 1);
  const limit = Math.max(parseInt(pageSize || 50), 1);
  return { currentPage, limit, skip: (currentPage - 1) * limit };
};

const paginationMeta = (total, currentPage, limit) => ({
  totalItems: total,
  currentPage,
  pageSize: limit,
  totalPages: Math.ceil(total / limit) || 1,
});

const productSearchWhere = (search) => ({
  OR: [
    { name: { contains: search, mode: "insensitive" } },
    { sku: { contains: search, mode: "insensitive" } },
    { barcode: { contains: search, mode: "insensitive" } },
  ],
});

// Остаток на начало (всё до periodStart) + приход/расход за период → остаток на
// конец. sumFn/keyField параметризуют группировку — по товару (оборотная
// ведомость) или по партии (разбивка одного товара на лоты).
const computeTurnoverMaps = async ({ sumFn, keyField, baseWhere, locationId, periodStart, periodEnd }) => {
  const [inBefore, outBefore, inPeriod, outPeriod] = await Promise.all([
    sumFn({ ...baseWhere, location_dest_id: locationId, picking: { date_done: { lt: periodStart } } }),
    sumFn({ ...baseWhere, location_src_id: locationId, picking: { date_done: { lt: periodStart } } }),
    sumFn({ ...baseWhere, location_dest_id: locationId, picking: { date_done: { gte: periodStart, lte: periodEnd } } }),
    sumFn({ ...baseWhere, location_src_id: locationId, picking: { date_done: { gte: periodStart, lte: periodEnd } } }),
  ]);

  const toMap = (rows) => new Map(rows.map((row) => [row[keyField], Number(row._sum.qty_done || 0)]));
  return {
    inBeforeMap: toMap(inBefore),
    outBeforeMap: toMap(outBefore),
    inPeriodMap: toMap(inPeriod),
    outPeriodMap: toMap(outPeriod),
  };
};

const turnoverRow = (key, maps) => {
  const opening = (maps.inBeforeMap.get(key) || 0) - (maps.outBeforeMap.get(key) || 0);
  const incoming = maps.inPeriodMap.get(key) || 0;
  const outgoing = maps.outPeriodMap.get(key) || 0;
  return { opening, incoming, outgoing, closing: opening + incoming - outgoing };
};

export const StockReportService = {
  // Остатки — только физические (internal) локации: только там считается stock_quants
  // (см. applyQuantDelta в stockPickings.model.js). По умолчанию нулевые строки
  // скрыты — show_zero включает их обратно.
  getBalances: async ({ page, pageSize, filters = {} }) => {
    const { currentPage, limit, skip } = paginate(page, pageSize);

    const params = {
      locationId: toInt(filters.location_id),
      branchId: toInt(filters.branch_id),
      search: filters.search || null,
      showZero: filters.show_zero === true || filters.show_zero === "true",
    };

    const [data, total] = await Promise.all([
      StockReportModel.findBalances({ ...params, skip, take: limit }),
      StockReportModel.countBalances(params),
    ]);

    return { data, pagination: paginationMeta(total, currentPage, limit) };
  },

  // Разбивка строки остатка по партиям — отдельная цена/описание/характеристики
  // на партию (см. stock_lots). Партия без лота (старые данные до бэкофилла) —
  // одна безликая строка.
  getBalanceLots: async ({ product_id, location_id }) => {
    const productId = toInt(product_id);
    const locationId = toInt(location_id);
    if (!productId || !locationId) return [];

    const rows = await StockReportModel.findBalanceLots({ productId, locationId });
    return rows.map((row) => ({
      quant_id: row.id,
      qty: Number(row.qty),
      lot_id: row.lot_id,
      price_unit: row.lot?.price_unit !== undefined && row.lot?.price_unit !== null ? Number(row.lot.price_unit) : null,
      note: row.lot?.note || null,
      attributes: (row.lot?.attributeValues || []).map((av) => ({
        attribute: av.attribute.name,
        value: av.attributeValue.value,
      })),
    }));
  },

  // Движения — только проведённые (done) строки документов, т.к. именно они
  // отражены в остатках; дата — дата проведения документа (date_done).
  getMovements: async ({ page, pageSize, filters = {} }) => {
    const { currentPage, limit, skip } = paginate(page, pageSize);

    const where = { state: "done" };
    if (filters.search) where.product = productSearchWhere(filters.search);

    const locationId = toInt(filters.location_id);
    if (locationId) where.OR = [{ location_src_id: locationId }, { location_dest_id: locationId }];

    if (filters.picking_type_id) where.picking = { type_id: toInt(filters.picking_type_id) };
    if (filters.date_from || filters.date_to) {
      where.picking = { ...where.picking, date_done: {} };
      if (filters.date_from) where.picking.date_done.gte = new Date(`${filters.date_from}T00:00:00`);
      if (filters.date_to) where.picking.date_done.lte = new Date(`${filters.date_to}T23:59:59`);
    }

    const [data, total] = await Promise.all([
      StockReportModel.findMovements({ where, skip, take: limit }),
      StockReportModel.countMovements(where),
    ]);

    return { data, pagination: paginationMeta(total, currentPage, limit) };
  },

  // Оборотная ведомость по складу за период: остаток на начало (всё до date_from) +
  // приход/расход за период (date_from..date_to) = остаток на конец. Считается по
  // stock_moves (done), а не по stock_quants — quants это только текущий снимок,
  // прошлый остаток из него не восстановить.
  getTurnover: async ({ page, pageSize, filters = {} }) => {
    const { currentPage, limit, skip } = paginate(page, pageSize);
    const locationId = toInt(filters.location_id);

    if (!locationId || !filters.date_from || !filters.date_to) {
      return { data: [], location: null, pagination: paginationMeta(0, currentPage, limit) };
    }

    const periodStart = new Date(`${filters.date_from}T00:00:00`);
    const periodEnd = new Date(`${filters.date_to}T23:59:59`);

    const [maps, location] = await Promise.all([
      computeTurnoverMaps({
        sumFn: StockReportModel.sumMovesByProduct,
        keyField: "product_id",
        baseWhere: { state: "done" },
        locationId,
        periodStart,
        periodEnd,
      }),
      StockReportModel.findLocationById(locationId),
    ]);

    const productIds = [
      ...new Set([
        ...maps.inBeforeMap.keys(),
        ...maps.outBeforeMap.keys(),
        ...maps.inPeriodMap.keys(),
        ...maps.outPeriodMap.keys(),
      ]),
    ];
    const products = productIds.length > 0 ? await StockReportModel.findProductsByIds(productIds) : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    let rows = productIds.map((productId) => ({
      product_id: productId,
      product: productMap.get(productId) || null,
      ...turnoverRow(productId, maps),
    }));

    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.product?.name?.toLowerCase().includes(q) ||
          row.product?.sku?.toLowerCase().includes(q) ||
          row.product?.barcode?.toLowerCase().includes(q),
      );
    }

    if (!(filters.show_zero === true || filters.show_zero === "true"))
      rows = rows.filter((row) => row.opening || row.incoming || row.outgoing || row.closing);

    rows.sort((a, b) => (a.product?.name || "").localeCompare(b.product?.name || "", "ru"));

    const total = rows.length;
    const data = rows.slice(skip, skip + limit);

    return { data, location, pagination: paginationMeta(total, currentPage, limit) };
  },

  // Разбивка строки оборотной ведомости по партиям одного товара — тот же
  // расчёт (начало/приход/расход/конец), но сгруппированный по lot_id вместо
  // product_id. Подгружается лениво при раскрытии строки.
  getTurnoverLots: async ({ location_id, date_from, date_to, product_id }) => {
    const locationId = toInt(location_id);
    const productId = toInt(product_id);
    if (!locationId || !productId || !date_from || !date_to) return [];

    const periodStart = new Date(`${date_from}T00:00:00`);
    const periodEnd = new Date(`${date_to}T23:59:59`);

    const maps = await computeTurnoverMaps({
      sumFn: StockReportModel.sumMovesByProductLot,
      keyField: "lot_id",
      baseWhere: { state: "done", product_id: productId },
      locationId,
      periodStart,
      periodEnd,
    });

    const lotIds = [
      ...new Set([...maps.inBeforeMap.keys(), ...maps.outBeforeMap.keys(), ...maps.inPeriodMap.keys(), ...maps.outPeriodMap.keys()]),
    ];
    const realLotIds = lotIds.filter((id) => id !== null);
    const lots = realLotIds.length > 0 ? await StockReportModel.findLotsByIds(realLotIds) : [];
    const lotMap = new Map(lots.map((l) => [l.id, l]));

    const rows = lotIds.map((lotId) => {
      const lot = lotId !== null ? lotMap.get(lotId) : null;
      return {
        lot_id: lotId,
        price_unit: lot?.price_unit !== undefined && lot?.price_unit !== null ? Number(lot.price_unit) : null,
        note: lot?.note || null,
        attributes: (lot?.attributeValues || []).map((av) => ({
          attribute: av.attribute.name,
          value: av.attributeValue.value,
        })),
        ...turnoverRow(lotId, maps),
      };
    });

    rows.sort((a, b) => b.closing - a.closing);
    return rows;
  },
};
