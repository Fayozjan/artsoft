import { OperationModel } from "./operations.model.js";
import { createAuditLog } from "../../utils/auditLog.js";
import { assertOperationAllowed } from "../../utils/productionAccess.js";

const trim =(value, max) =>
  typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;

const toDecimal = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toInt = (value) => {
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
};

const buildItemData = (item, index) => {
  const employeeId = toInt(item.employee_id);
  const operationTypeId = toInt(item.operation_type_id);
  const quantity = toDecimal(item.quantity) ?? 0;
  const rate = toDecimal(item.rate) ?? 0;

  if (!employeeId) {
    const err = new Error("Не выбран сотрудник в строке");
    err.code = "EMPLOYEE_REQUIRED";
    throw err;
  }
  if (!operationTypeId) {
    const err = new Error("Не выбран тип операции в строке");
    err.code = "OPERATION_TYPE_REQUIRED";
    throw err;
  }

  return {
    employee_id: employeeId,
    operation_type_id: operationTypeId,
    quantity,
    rate,
    amount: Math.round(quantity * rate * 100) / 100,
    comment: trim(item.comment, 2000),
    sort_order: index,
  };
};

const validateItems = (items) => {
  const list = Array.isArray(items) ? items : [];
  const valid = list.filter((item) => item && Number(item.quantity) > 0);
  if (valid.length === 0) {
    const err = new Error("Не заполнено ни одной позиции");
    err.code = "NO_ITEMS";
    throw err;
  }
  return valid.map(buildItemData);
};

const buildHeaderData = ({ operation_date, order_number, comment }) => {
  const operationDate = operation_date ? new Date(operation_date) : null;

  if (!operationDate || isNaN(operationDate.getTime())) {
    const err = new Error("Не заполнена дата операции");
    err.code = "OPERATION_DATE_REQUIRED";
    throw err;
  }

  return {
    operation_date: operationDate,
    order_number: trim(order_number, 100),
    comment: trim(comment, 2000),
  };
};

const assertDraft = (operation) => {
  if (operation.status !== "draft") {
    const err = new Error("Изменять можно только черновик");
    err.code = "NOT_DRAFT";
    throw err;
  }
};

export const OperationsService = {
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
        { order_number: { contains: search, mode: "insensitive" } },
      ];
    }

    if (filters.date_from || filters.date_to) {
      where.operation_date = {};
      if (filters.date_from) where.operation_date.gte = new Date(filters.date_from);
      if (filters.date_to) where.operation_date.lte = new Date(filters.date_to);
    }

    const [rows, total] = await Promise.all([
      OperationModel.findMany({ where, skip, take: limit }),
      OperationModel.count(where),
    ]);

    const data = rows.map(({ items, ...row }) => ({
      ...row,
      total_amount: items.reduce((sum, item) => sum + Number(item.amount), 0),
    }));

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

  getById: async (id) => OperationModel.findUnique(id),

  create: async (body, userId) => {
    const headerData = buildHeaderData(body);
    const items = validateItems(body.items);
    await assertOperationAllowed(userId, items.map((item) => item.operation_type_id));

    const result = await OperationModel.createWithItems(
      { ...headerData, added_by: Number(userId) },
      items,
    );

    await createAuditLog({
      userId,
      action: "create",
      entity: "operations",
      recordId: result.id,
      newData: result,
    });

    return result;
  },

  update: async (id, body, userId) => {
    const old = await OperationModel.findUnique(id);
    if (!old) return null;
    assertDraft(old);

    const headerData = buildHeaderData(body);
    const items = validateItems(body.items);
    await assertOperationAllowed(userId, items.map((item) => item.operation_type_id));

    const result = await OperationModel.updateWithItems(id, headerData, items);

    await createAuditLog({
      userId,
      action: "update",
      entity: "operations",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  accept: async (id, userId) => {
    const old = await OperationModel.findUnique(id);
    if (!old) return null;
    if (old.status !== "draft") {
      const err = new Error("Принять можно только черновик");
      err.code = "NOT_DRAFT";
      throw err;
    }

    const result = await OperationModel.updateStatus(id, "accepted");

    await createAuditLog({
      userId,
      action: "update",
      entity: "operations",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  revert: async (id, userId) => {
    const old = await OperationModel.findUnique(id);
    if (!old) return null;
    if (old.status !== "accepted") {
      const err = new Error("Вернуть в черновик можно только принятый документ");
      err.code = "NOT_ACCEPTED";
      throw err;
    }

    const result = await OperationModel.updateStatus(id, "draft");

    await createAuditLog({
      userId,
      action: "update",
      entity: "operations",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  remove: async (id, userId) => {
    const old = await OperationModel.findUnique(id);
    if (!old) return null;
    assertDraft(old);

    const result = await OperationModel.delete(id);

    await createAuditLog({
      userId,
      action: "delete",
      entity: "operations",
      recordId: id,
      oldData: old,
    });

    return result;
  },
};
