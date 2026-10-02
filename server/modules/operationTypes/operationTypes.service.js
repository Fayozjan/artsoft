import { OperationTypeModel } from "./operationTypes.model.js";

const trim = (value, max) =>
  typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;

const toDecimal = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toInt = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
};

const COMPLEXITY_VALUES = ["simple", "medium", "hard"];

const buildData = ({
  name,
  unit,
  price,
  complexity,
  is_active,
  is_final,
  is_rework,
  is_first,
  allow_merge,
  allow_incomplete,
  sort_order,
}) => {
  const trimmedName = trim(name, 100);
  if (!trimmedName) {
    const err = new Error("Не заполнено название типа операции");
    err.code = "NAME_REQUIRED";
    throw err;
  }

  const trimmedComplexity = trim(complexity, 20);
  if (trimmedComplexity && !COMPLEXITY_VALUES.includes(trimmedComplexity)) {
    const err = new Error("Некорректное значение сложности");
    err.code = "INVALID_COMPLEXITY";
    throw err;
  }

  return {
    name: trimmedName,
    unit: trim(unit, 20),
    price: toDecimal(price),
    complexity: trimmedComplexity,
    is_active: is_active === undefined ? true : Boolean(is_active),
    // Форма шлёт строку из input — Number.isInteger("5") дал бы false и сбросил порядок в 0.
    sort_order: toInt(sort_order) ?? 0,
    is_final: Boolean(is_final),
    is_rework: Boolean(is_rework),
    // Операция исправления в распределение партии не попадает — первой быть не может.
    is_first: Boolean(is_first) && !is_rework,
    allow_merge: Boolean(allow_merge),
    allow_incomplete: Boolean(allow_incomplete),
  };
};

// Исправляемая операция — только у операции исправления (у остальных — null): существующий
// обычный тип, не сам тип и не исправление. Пусто — не задана (виновная операция при
// раздаче исправления не определяется).
const parseReworkTargetId = async (value, isRework, selfId) => {
  const targetId = isRework ? toInt(value) : null;
  if (!targetId) return null;

  if (targetId === selfId) {
    const err = new Error("Исправляемая операция: нельзя выбрать саму операцию");
    err.code = "TARGET_SELF";
    throw err;
  }
  const target = await OperationTypeModel.findUnique(targetId);
  if (!target) {
    const err = new Error("Исправляемая операция: тип операции не найден");
    err.code = "TARGET_NOT_FOUND";
    throw err;
  }
  if (target.is_rework) {
    const err = new Error("Исправляемая операция: нельзя выбрать операцию исправления");
    err.code = "TARGET_REWORK_MISMATCH";
    throw err;
  }
  return targetId;
};

// undefined — поле не пришло (на update набор остаётся как есть); [] — очистить
// (следующей нет); иначе уникальные существующие типы, не сам тип и не исправление.
const parseNextOperationIds = async (value, selfId) => {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : [value];
  const ids = [...new Set(list.map(toInt).filter((id) => id))];

  for (const targetId of ids) {
    if (targetId === selfId) {
      const err = new Error("Следующая операция: нельзя выбрать саму операцию");
      err.code = "TARGET_SELF";
      throw err;
    }
    const target = await OperationTypeModel.findUnique(targetId);
    if (!target) {
      const err = new Error("Следующая операция: тип операции не найден");
      err.code = "TARGET_NOT_FOUND";
      throw err;
    }
    if (target.is_rework) {
      const err = new Error("Следующая операция: нельзя выбрать операцию исправления");
      err.code = "TARGET_REWORK_MISMATCH";
      throw err;
    }
  }
  return ids;
};

// undefined — поле не пришло (на update набор остаётся как есть); [] — очистить
// (исправления нет); иначе уникальные существующие типы, не сам тип и обязательно
// помеченные как исправление (is_rework) — иначе раздача выбрала бы не то направление.
const parseReworkOperationIds = async (value, selfId) => {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : [value];
  const ids = [...new Set(list.map(toInt).filter((id) => id))];

  for (const targetId of ids) {
    if (targetId === selfId) {
      const err = new Error("Операция для исправления: нельзя выбрать саму операцию");
      err.code = "TARGET_SELF";
      throw err;
    }
    const target = await OperationTypeModel.findUnique(targetId);
    if (!target) {
      const err = new Error("Операция для исправления: тип операции не найден");
      err.code = "TARGET_NOT_FOUND";
      throw err;
    }
    if (!target.is_rework) {
      const err = new Error("Операция для исправления: можно выбрать только тип, помеченный как исправление");
      err.code = "TARGET_REWORK_MISMATCH";
      throw err;
    }
  }
  return ids;
};

// undefined — поле не пришло (на update набор остаётся как есть); [] — очистить
// (не выполненных нет); иначе уникальные существующие типы, не сам тип и не
// исправление — не выполненное возвращается в обычную цепочку операций.
const parseIncompleteOperationIds = async (value, selfId) => {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : [value];
  const ids = [...new Set(list.map(toInt).filter((id) => id))];

  for (const targetId of ids) {
    if (targetId === selfId) {
      const err = new Error("Операция для не выполненных: нельзя выбрать саму операцию");
      err.code = "TARGET_SELF";
      throw err;
    }
    const target = await OperationTypeModel.findUnique(targetId);
    if (!target) {
      const err = new Error("Операция для не выполненных: тип операции не найден");
      err.code = "TARGET_NOT_FOUND";
      throw err;
    }
    if (target.is_rework) {
      const err = new Error("Операция для не выполненных: нельзя выбрать операцию исправления");
      err.code = "TARGET_REWORK_MISMATCH";
      throw err;
    }
  }
  return ids;
};

// undefined — поле не пришло (на update набор остаётся как есть); [] — очистить
// (допущены все); иначе уникальные существующие сотрудники.
const parseEmployeeIds = async (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    const err = new Error("Некорректный список сотрудников");
    err.code = "INVALID_EMPLOYEES";
    throw err;
  }

  const ids = [...new Set(value.map(toInt))];
  if (ids.some((id) => !id)) {
    const err = new Error("Некорректный список сотрудников");
    err.code = "INVALID_EMPLOYEES";
    throw err;
  }

  if (ids.length > 0 && (await OperationTypeModel.countEmployees(ids)) !== ids.length) {
    const err = new Error("Сотрудник не найден");
    err.code = "EMPLOYEE_NOT_FOUND";
    throw err;
  }
  return ids;
};

const assertUniqueName = async (name, excludeId) => {
  const existing = await OperationTypeModel.findByName(name);
  if (existing && existing.id !== excludeId) {
    const err = new Error("Тип операции с таким названием уже существует");
    err.code = "NAME_TAKEN";
    throw err;
  }
};

export const OperationTypesService = {
  getAll: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search) where.name = { contains: filters.search, mode: "insensitive" };
    if (filters.unit) where.unit = filters.unit;
    if (filters.complexity) where.complexity = filters.complexity;
    if (filters.status === "true") where.is_active = true;
    if (filters.status === "false") where.is_active = false;

    const [data, total] = await Promise.all([
      OperationTypeModel.findMany({ where, skip, take: limit }),
      OperationTypeModel.count(where),
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

  getActive: async () => OperationTypeModel.findActive(),

  getById: async (id) => OperationTypeModel.findWithRelations(id),

  create: async (body, userId) => {
    const data = buildData(body);
    await assertUniqueName(data.name, null);
    const employeeIds = await parseEmployeeIds(body.employee_ids);
    // У последней операции следующей нет — не храним устаревшие цели.
    const nextOperationTypeIds = await parseNextOperationIds(data.is_final ? [] : body.next_operation_type_ids, null);
    const reworkOperationTypeIds = await parseReworkOperationIds(body.rework_operation_type_ids, null);
    // Не выполненные не разрешены — не храним устаревшие цели.
    const incompleteOperationTypeIds = await parseIncompleteOperationIds(
      data.allow_incomplete ? body.incomplete_operation_type_ids : [],
      null,
    );
    const reworkTargetId = await parseReworkTargetId(body.rework_target_operation_type_id, data.is_rework, null);
    return OperationTypeModel.create(
      {
        ...data,
        rework_target_operation_type_id: reworkTargetId,
        next_operation_type_ids: nextOperationTypeIds,
        rework_operation_type_ids: reworkOperationTypeIds,
        incomplete_operation_type_ids: incompleteOperationTypeIds,
        added_by: Number(userId),
      },
      employeeIds,
    );
  },

  update: async (id, body) => {
    const old = await OperationTypeModel.findUnique(id);
    if (!old) return null;

    const data = buildData({ ...old, ...body });
    await assertUniqueName(data.name, old.id);
    const employeeIds = await parseEmployeeIds(body.employee_ids);
    const nextOperationTypeIds = await parseNextOperationIds(
      data.is_final ? [] : body.next_operation_type_ids,
      old.id,
    );
    const reworkOperationTypeIds = await parseReworkOperationIds(body.rework_operation_type_ids, old.id);
    const incompleteOperationTypeIds = await parseIncompleteOperationIds(
      data.allow_incomplete ? body.incomplete_operation_type_ids : [],
      old.id,
    );
    // Поле не пришло (например, правят только сотрудников) — остаётся прежняя цель.
    const reworkTargetId = await parseReworkTargetId(
      body.rework_target_operation_type_id === undefined
        ? old.rework_target_operation_type_id
        : body.rework_target_operation_type_id,
      data.is_rework,
      old.id,
    );
    return OperationTypeModel.update(
      id,
      {
        ...data,
        rework_target_operation_type_id: reworkTargetId,
        next_operation_type_ids: nextOperationTypeIds,
        rework_operation_type_ids: reworkOperationTypeIds,
        incomplete_operation_type_ids: incompleteOperationTypeIds,
      },
      employeeIds,
    );
  },

  delete: async (id) => {
    const old = await OperationTypeModel.findUnique(id);
    if (!old) return null;

    try {
      return await OperationTypeModel.delete(id);
    } catch (e) {
      // FK: тип уже используется в операциях, стикерах или маршрутах
      if (e.code === "P2003") {
        const err = new Error(
          "Тип операции используется и не может быть удалён. Отключите его вместо удаления",
        );
        err.code = "IN_USE";
        throw err;
      }
      throw e;
    }
  },
};
