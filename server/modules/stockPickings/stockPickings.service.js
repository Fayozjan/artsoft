import { StockPickingModel } from "./stockPickings.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

const trim = (value, max) =>
  typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;

const PAYMENT_METHODS = ["cash", "card", "transfer"];
const FUTURE_DATE_TOLERANCE_MS = 60 * 1000; // запас на рассинхрон часов/задержку запроса

const toDecimal = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toInt = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
};

const buildHeaderData = ({
  type_id,
  src_partner_id,
  dest_partner_id,
  location_src_id,
  location_dest_id,
  origin,
  scheduled_date,
  note,
  currency_id,
  rate,
  payment_method,
  manager_id,
  transport,
  driver,
  vehicle_number,
}) => {
  const typeId = toInt(type_id);
  const locationSrcId = toInt(location_src_id);
  const locationDestId = toInt(location_dest_id);
  const scheduledDate = scheduled_date ? new Date(scheduled_date) : null;
  const currencyId = toInt(currency_id);
  const rateNum = toDecimal(rate) ?? 1;
  const paymentMethod = payment_method || null;
  const managerId = toInt(manager_id);

  if (!typeId) {
    const err = new Error("Не выбран тип документа");
    err.code = "TYPE_REQUIRED";
    throw err;
  }
  if (!locationSrcId || !locationDestId) {
    const err = new Error("Не выбраны локации отправления и назначения");
    err.code = "LOCATIONS_REQUIRED";
    throw err;
  }
  if (locationSrcId === locationDestId) {
    const err = new Error("Локация отправления и назначения не могут совпадать");
    err.code = "SAME_LOCATION";
    throw err;
  }
  if (scheduled_date && isNaN(scheduledDate.getTime())) {
    const err = new Error("Некорректная дата документа");
    err.code = "INVALID_DATE";
    throw err;
  }
  // Проверка по часам сервера, а не клиента — иначе достаточно перевести
  // время на телефоне/ПК вперёд, чтобы обойти запрет.
  if (scheduled_date && scheduledDate.getTime() > Date.now() + FUTURE_DATE_TOLERANCE_MS) {
    const err = new Error("Дата документа не может быть в будущем");
    err.code = "FUTURE_DATE";
    throw err;
  }
  if (!currencyId) {
    const err = new Error("Не выбрана валюта документа");
    err.code = "CURRENCY_REQUIRED";
    throw err;
  }
  if (!(rateNum > 0)) {
    const err = new Error("Некорректный курс валюты");
    err.code = "INVALID_RATE";
    throw err;
  }
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    const err = new Error("Некорректный способ оплаты");
    err.code = "INVALID_PAYMENT_METHOD";
    throw err;
  }

  return {
    type_id: typeId,
    src_partner_id: toInt(src_partner_id),
    dest_partner_id: toInt(dest_partner_id),
    location_src_id: locationSrcId,
    location_dest_id: locationDestId,
    origin: trim(origin, 255),
    scheduled_date: scheduledDate,
    note: trim(note, 2000),
    currency_id: currencyId,
    rate: rateNum,
    payment_method: paymentMethod,
    manager_id: managerId,
    transport: trim(transport, 100),
    driver: trim(driver, 100),
    vehicle_number: trim(vehicle_number, 20),
  };
};

// Характеристики строки (напр. "Цвет") выбираются из значений, уже заведённых
// на самом атрибуте — здесь просто принимаем пары id, без создания новых значений.
const buildMoveAttributes = (attributes) =>
  (Array.isArray(attributes) ? attributes : [])
    .filter((a) => a && a.attribute_id && a.attribute_value_id)
    .map((a) => ({
      attribute_id: Number(a.attribute_id),
      attribute_value_id: Number(a.attribute_value_id),
    }));

const buildMoveData = (item, locationSrcId, locationDestId) => ({
  product_id: Number(item.product_id),
  lot_id: toInt(item.lot_id),
  unit_id: toInt(item.unit_id),
  qty_demand: toDecimal(item.qty_demand) ?? 0,
  qty_packages: toDecimal(item.qty_packages),
  price_unit: toDecimal(item.price_unit),
  location_src_id: locationSrcId,
  location_dest_id: locationDestId,
  note: trim(item.note, 500),
  attributeValues: { create: buildMoveAttributes(item.attributes) },
});

const buildMoves = (items, locationSrcId, locationDestId) => {
  const valid = (Array.isArray(items) ? items : []).filter(
    (item) => item && item.product_id && Number(item.qty_demand) > 0,
  );
  if (valid.length === 0) {
    const err = new Error("Не заполнено ни одной строки товара");
    err.code = "NO_ITEMS";
    throw err;
  }
  return valid.map((item) => buildMoveData(item, locationSrcId, locationDestId));
};

const assertEditable = (picking) => {
  if (picking.state !== "draft") {
    const err = new Error("Редактировать можно только черновик");
    err.code = "NOT_EDITABLE";
    throw err;
  }
};

// incoming/outgoing — виртуальная локация (Поставщики/Клиенты) общая на все
// документы типа, конкретный контрагент задаётся отдельно партнёром; без него
// в карточке документа был бы виден только общий "Поставщики"/"Клиенты".
const assertPartnerRequired = (typeCode, headerData) => {
  if (typeCode === "incoming" && !headerData.src_partner_id) {
    const err = new Error("Не выбран поставщик");
    err.code = "PARTNER_REQUIRED";
    throw err;
  }
  if (typeCode === "outgoing" && !headerData.dest_partner_id) {
    const err = new Error("Не выбран клиент");
    err.code = "PARTNER_REQUIRED";
    throw err;
  }
};

// Расход/перемещение со склада (location_src физический) — партия обязательна
// на каждой строке: выбирает её пользователь в пикере (см. AddStockPicking.jsx),
// сервер её не резолвит сам — resolveOrCreateLot в validate() отрабатывает
// только для прихода (lot_id пуст). Без проверки здесь расход при проведении
// списался бы "в пустоту" — непонятно с какой партии.
const assertLotsRequired = async (locationSrcId, moves) => {
  const srcType = await StockPickingModel.findLocationType(locationSrcId);
  if (srcType !== "internal") return;
  if (moves.some((m) => !m.lot_id)) {
    const err = new Error("Не выбрана партия товара для одной или нескольких строк");
    err.code = "LOT_REQUIRED";
    throw err;
  }
};

export const StockPickingsService = {
  getAll: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.state) where.state = filters.state;
    if (filters.type_id) where.type_id = Number(filters.type_id);
    if (filters.search)
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { origin: { contains: filters.search, mode: "insensitive" } },
      ];
    if (filters.date_from || filters.date_to) {
      where.created_at = {};
      if (filters.date_from) where.created_at.gte = new Date(filters.date_from);
      if (filters.date_to) where.created_at.lte = new Date(filters.date_to);
    }

    const [data, total] = await Promise.all([
      StockPickingModel.findMany({ where, skip, take: limit }),
      StockPickingModel.count(where),
    ]);

    return {
      data,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getById: async (id) => StockPickingModel.findUnique(id),

  getOrigins: async () => StockPickingModel.findDistinctOrigins(),

  getStockBalance: async (locationId) => {
    if (!locationId) return [];
    return StockPickingModel.findStockBalance(locationId);
  },

  create: async (body, userId) => {
    const headerData = buildHeaderData(body);
    const moves = buildMoves(body.moves, headerData.location_src_id, headerData.location_dest_id);

    const type = await StockPickingModel.findType(headerData.type_id);
    if (!type) {
      const err = new Error("Тип документа не найден");
      err.code = "TYPE_NOT_FOUND";
      throw err;
    }
    assertPartnerRequired(type.code, headerData);
    await assertLotsRequired(headerData.location_src_id, moves);

    const result = await StockPickingModel.createWithMoves(
      { ...headerData, added_by: Number(userId) },
      moves,
      type.sequence_prefix,
    );

    await createAuditLog({ userId, action: "create", entity: "stock_pickings", recordId: result.id, newData: result });
    return result;
  },

  update: async (id, body, userId) => {
    const old = await StockPickingModel.findUnique(id);
    if (!old) return null;
    assertEditable(old);

    const headerData = buildHeaderData(body);
    const moves = buildMoves(body.moves, headerData.location_src_id, headerData.location_dest_id);
    assertPartnerRequired(old.type.code, headerData);
    await assertLotsRequired(headerData.location_src_id, moves);

    const result = await StockPickingModel.updateWithMoves(
      id,
      { ...headerData, edited_by: Number(userId), edited_at: new Date() },
      moves,
    );
    await createAuditLog({ userId, action: "update", entity: "stock_pickings", recordId: id, oldData: old, newData: result });
    return result;
  },

  confirm: async (id, userId) => {
    const old = await StockPickingModel.findUnique(id);
    if (!old) return null;
    if (old.state !== "draft") {
      const err = new Error("Подтвердить можно только черновик");
      err.code = "NOT_DRAFT";
      throw err;
    }

    const result = await StockPickingModel.updateState(id, "confirmed", {
      confirmed_by: Number(userId),
      confirmed_at: new Date(),
    });
    await createAuditLog({ userId, action: "update", entity: "stock_pickings", recordId: id, oldData: old, newData: result });
    return result;
  },

  // 3 этапа строго по цепочке: draft -> confirmed -> done. Провести можно
  // только после подтверждения, минуя confirmed нельзя.
  validate: async (id, userId) => {
    const old = await StockPickingModel.findUnique(id);
    if (!old) return null;
    if (old.state !== "confirmed") {
      const err = new Error("Провести можно только подтверждённый документ");
      err.code = "NOT_CONFIRMED";
      throw err;
    }
    if (old.moves.length === 0) {
      const err = new Error("Нельзя провести документ без строк товара");
      err.code = "NO_ITEMS";
      throw err;
    }

    const result = await StockPickingModel.validate(id, userId);
    await createAuditLog({ userId, action: "update", entity: "stock_pickings", recordId: id, oldData: old, newData: result });
    return result;
  },

  // Отмена — только на шаг назад по цепочке draft -> confirmed -> done,
  // симметрично подтверждению/проведению: done -> confirmed, confirmed -> draft.
  // Прыжок через этап (напр. done сразу в draft) запрещён.
  cancel: async (id, userId) => {
    const old = await StockPickingModel.findUnique(id);
    if (!old) return null;
    if (!["confirmed", "done"].includes(old.state)) {
      const err = new Error("Отменить можно только подтверждённый или проведённый документ (на шаг назад)");
      err.code = "NOT_CANCELLABLE";
      throw err;
    }

    const result = await StockPickingModel.cancel(id, old.state);
    await createAuditLog({ userId, action: "update", entity: "stock_pickings", recordId: id, oldData: old, newData: result });
    return result;
  },

  remove: async (id, userId) => {
    const old = await StockPickingModel.findUnique(id);
    if (!old) return null;
    if (old.state !== "draft") {
      const err = new Error("Удалить можно только черновик");
      err.code = "NOT_DRAFT";
      throw err;
    }

    const result = await StockPickingModel.delete(id);
    await createAuditLog({ userId, action: "delete", entity: "stock_pickings", recordId: id, oldData: old });
    return result;
  },
};
