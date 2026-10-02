import { BatchReceiptModel } from "./batchReceipts.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

const trim = (value, max) =>
  typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;

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

const buildItemData = (item, index, addedBy) => ({
  product_name: trim(item.product_name, 255),
  color: trim(item.color, 100),
  color_variant: trim(item.color_variant, 100),
  color_tone: trim(item.color_tone, 100),
  size: trim(item.size, 50),
  yarn_type: trim(item.yarn_type, 100),
  material: trim(item.material, 100),
  design: trim(item.design, 100),
  quantity: toDecimal(item.quantity) ?? 0,
  gross_weight_kg: toDecimal(item.gross_weight_kg),
  roll_count: toInt(item.roll_count),
  grammage: toDecimal(item.grammage),
  sort_order: index,
  added_by: addedBy,
});

const filterValidItems = (items) =>
  (Array.isArray(items) ? items : []).filter((item) => item && Number(item.quantity) > 0);

// allowEmpty — партию можно создать без позиций: их добавляют уже внутри партии.
const validateItems = (items, userId, { sortOrderOffset = 0, allowEmpty = false } = {}) => {
  const valid = filterValidItems(items);
  if (valid.length === 0 && !allowEmpty) {
    const err = new Error("Не заполнено ни одной позиции");
    err.code = "NO_ITEMS";
    throw err;
  }
  return valid.map((item, i) => buildItemData(item, sortOrderOffset + i, Number(userId)));
};

// Позиция "стартовала", если по ней уже печатались стикеры распределения работы.
const isStarted = (item) => (item._count?.workStickers ?? 0) > 0;

const buildHeaderData = ({ batch_number, receipt_date, order_number, customer, comment }) => {
  const batchNumber = trim(batch_number, 100);
  const receiptDate = receipt_date ? new Date(receipt_date) : null;

  if (!batchNumber) {
    const err = new Error("Не заполнен номер партии");
    err.code = "BATCH_NUMBER_REQUIRED";
    throw err;
  }
  if (!receiptDate || isNaN(receiptDate.getTime())) {
    const err = new Error("Не заполнена дата прихода");
    err.code = "RECEIPT_DATE_REQUIRED";
    throw err;
  }

  return {
    batch_number: batchNumber,
    receipt_date: receiptDate,
    order_number: trim(order_number, 100),
    customer: trim(customer, 255),
    comment: trim(comment, 2000),
  };
};

const assertDraft = (receipt) => {
  if (receipt.status !== "draft") {
    const err = new Error("Изменять можно только черновик");
    err.code = "NOT_DRAFT";
    throw err;
  }
};

export const BatchReceiptsService = {
  getAll: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.status) where.status = filters.status;

    if (filters.search) {
      const search = filters.search;
      where.OR = [
        { document_number: { contains: search, mode: "insensitive" } },
        { batch_number: { contains: search, mode: "insensitive" } },
        { order_number: { contains: search, mode: "insensitive" } },
        { customer: { contains: search, mode: "insensitive" } },
      ];
    }

    if (filters.date_from || filters.date_to) {
      where.receipt_date = {};
      if (filters.date_from) where.receipt_date.gte = new Date(filters.date_from);
      if (filters.date_to) where.receipt_date.lte = new Date(filters.date_to);
    }

    const [data, total] = await Promise.all([
      BatchReceiptModel.findMany({ where, skip, take: limit }),
      BatchReceiptModel.count(where),
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

  getStats: async () => {
    const [total, draft, accepted] = await Promise.all([
      BatchReceiptModel.count({}),
      BatchReceiptModel.count({ status: "draft" }),
      BatchReceiptModel.count({ status: "accepted" }),
    ]);

    return { total, draft, accepted };
  },

  getById: async (id) => BatchReceiptModel.findUnique(id),

  create: async (body, userId) => {
    const headerData = buildHeaderData(body);
    const items = validateItems(body.items, userId, { allowEmpty: true });

    const existing = await BatchReceiptModel.findByBatchNumber(headerData.batch_number);
    if (existing) {
      const err = new Error("Партия с таким номером уже существует");
      err.code = "DUPLICATE_BATCH_NUMBER";
      err.existing = {
        id: existing.id,
        document_number: existing.document_number,
        status: existing.status,
      };
      throw err;
    }

    const result = await BatchReceiptModel.createWithItems(
      { ...headerData, added_by: Number(userId) },
      items,
    );

    await createAuditLog({
      userId,
      action: "create",
      entity: "batch_receipts",
      recordId: result.id,
      newData: result,
    });

    return result;
  },

  update: async (id, body, userId) => {
    const old = await BatchReceiptModel.findUnique(id);
    if (!old) return null;
    assertDraft(old);

    const headerData = buildHeaderData(body);

    // Позиции со стартовавшей работой заблокированы: не меняются и не удаляются,
    // даже если пришли изменёнными или не пришли вовсе. Остальные — обновляются
    // на месте (автор сохраняется), отсутствующие в запросе — удаляются.
    const oldById = new Map(old.items.map((it) => [it.id, it]));
    const keptIds = new Set();
    const toCreate = [];
    const toUpdate = [];
    filterValidItems(body.items).forEach((item, index) => {
      const existing = oldById.get(Number(item.id));
      if (!existing || keptIds.has(existing.id)) {
        toCreate.push(buildItemData(item, index, Number(userId)));
        return;
      }
      keptIds.add(existing.id);
      if (isStarted(existing)) return;
      const { added_by, ...data } = buildItemData(item, index, existing.added_by);
      toUpdate.push({ id: existing.id, data });
    });
    const deleteIds = old.items
      .filter((it) => !keptIds.has(it.id) && !isStarted(it))
      .map((it) => it.id);

    if (headerData.batch_number !== old.batch_number) {
      const existing = await BatchReceiptModel.findByBatchNumber(headerData.batch_number);
      if (existing) {
        const err = new Error("Партия с таким номером уже существует");
        err.code = "DUPLICATE_BATCH_NUMBER";
        throw err;
      }
    }

    const result = await BatchReceiptModel.updateWithItems(id, headerData, {
      toCreate,
      toUpdate,
      deleteIds,
    });

    await createAuditLog({
      userId,
      action: "update",
      entity: "batch_receipts",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  // Добавление позиций в уже существующую партию (в т.ч. принятую) — старые
  // позиции и шапку не трогает, только дописывает новые.
  appendItems: async (id, body, userId) => {
    const old = await BatchReceiptModel.findUnique(id);
    if (!old) return null;

    const existingCount = await BatchReceiptModel.countItems(id);
    const items = validateItems(body.items, userId, { sortOrderOffset: existingCount });

    const result = await BatchReceiptModel.appendItems(id, items);

    await createAuditLog({
      userId,
      action: "update",
      entity: "batch_receipts",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  // Удаление одной позиции черновика; позиция со стартовавшей работой не удаляется.
  removeItem: async (id, itemId, userId) => {
    const old = await BatchReceiptModel.findUnique(id);
    if (!old) return null;
    assertDraft(old);

    const item = old.items.find((it) => it.id === Number(itemId));
    if (!item) {
      const err = new Error("Позиция не найдена");
      err.code = "ITEM_NOT_FOUND";
      throw err;
    }

    const deleted = !isStarted(item) && (await BatchReceiptModel.deleteItemIfNotStarted(id, itemId));
    if (!deleted) {
      const err = new Error("Нельзя удалить позицию: по ней уже начата работа");
      err.code = "HAS_STARTED_ITEMS";
      throw err;
    }

    const result = await BatchReceiptModel.findUnique(id);

    await createAuditLog({
      userId,
      action: "update",
      entity: "batch_receipts",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  accept: async (id, userId) => {
    const old = await BatchReceiptModel.findUnique(id);
    if (!old) return null;
    if (old.status !== "draft") {
      const err = new Error("Принять можно только черновик");
      err.code = "NOT_DRAFT";
      throw err;
    }
    if (old.items.length === 0) {
      const err = new Error("Нельзя принять партию без позиций");
      err.code = "NO_ITEMS";
      throw err;
    }

    const result = await BatchReceiptModel.updateStatus(id, "accepted");

    await createAuditLog({
      userId,
      action: "update",
      entity: "batch_receipts",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  revert: async (id, userId) => {
    const old = await BatchReceiptModel.findUnique(id);
    if (!old) return null;
    if (old.status !== "accepted") {
      const err = new Error("Вернуть в черновик можно только принятый документ");
      err.code = "NOT_ACCEPTED";
      throw err;
    }

    const result = await BatchReceiptModel.updateStatus(id, "draft");

    await createAuditLog({
      userId,
      action: "update",
      entity: "batch_receipts",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  remove: async (id, userId) => {
    const old = await BatchReceiptModel.findUnique(id);
    if (!old) return null;
    assertDraft(old);
    // Удаление партии каскадно удалило бы стикеры стартовавших позиций.
    if (old.items.some(isStarted)) {
      const err = new Error("Нельзя удалить партию: по её позициям уже начата работа");
      err.code = "HAS_STARTED_ITEMS";
      throw err;
    }

    const result = await BatchReceiptModel.delete(id);

    await createAuditLog({
      userId,
      action: "delete",
      entity: "batch_receipts",
      recordId: id,
      oldData: old,
    });

    return result;
  },
};
