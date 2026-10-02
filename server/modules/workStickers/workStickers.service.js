import { WorkStickerModel } from "./workStickers.model.js";
import { prismaContext } from "../../utils/prismaContext.js";
import { createAuditLog } from "../../utils/auditLog.js";
import {
  assertOperationAllowed,
  assertAnyOperationAllowed,
  getProductionAccess,
} from "../../utils/productionAccess.js";

const trim =(value, max) =>
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

// Большая сторона размера в метрах: "30х60" → 60 см → 0.6. Разделитель — латинская
// x, кириллическая х, ×, *. Размер в см. Нет распознаваемого размера → null.
const longestSideMeters = (size) => {
  if (typeof size !== "string") return null;
  const sides = size
    .split(/[xх×*]/i)
    .map((part) => Number(part.replace(",", ".").replace(/[^\d.]/g, "")))
    .filter((num) => Number.isFinite(num) && num > 0);
  return sides.length > 0 ? Math.max(...sides) / 100 : null;
};

// Цена за метр (unit = "m"): сумма = длина изделия (большая сторона размера) ×
// количество × цена. Остальные единицы и позиции без размера — количество × цена.
export const calcAmount = ({ unit, size, quantity, rate }) => {
  const length = unit === "m" ? longestSideMeters(size) : null;
  return Math.round(quantity * (length ?? 1) * rate * 100) / 100;
};

const MAX_STICKERS_PER_CREATE = 50000;

// Сколько сотрудников можно добавить к основному при приёме одного стикера.
const MAX_CO_WORKERS = 20;

const round4 = (value) => Math.round(value * 10000) / 10000;

// Выполнено (годное) целиком: доля основного сотрудника + доли остальных.
const goodQuantityOf = (sticker) =>
  round4(
    Number(sticker.actual_quantity || 0) +
      (sticker.shares || []).reduce((sum, share) => sum + Number(share.actual_quantity || 0), 0),
  );

// Доля другого сотрудника — не самостоятельный стикер: раздавать и возвращать
// нужно основной, к которому она относится.
const assertNotShare = (sticker) => {
  if (sticker.share_of_id) {
    const err = new Error("Это доля другого сотрудника — действие выполняется с основным стикером");
    err.code = "STICKER_IS_SHARE";
    throw err;
  }
};

// Годное этого стикера уже объединено в другой (merged_into_id) — раздавать/
// возвращать/объединять его отдельно больше нельзя, дубли количества иначе.
const assertNotMerged = (sticker) => {
  if (sticker.merged_into_id) {
    const err = new Error("Стикер уже объединён с другими и передан дальше — действие недоступно");
    err.code = "ALREADY_ADVANCED";
    throw err;
  }
};

// Отмечен для объединения — раздавать/возвращать одиночно нельзя, пока флаг не
// снят (см. WorkStickersService.setAwaitingMerge).
const assertNotAwaitingMerge = (sticker) => {
  if (sticker.awaiting_merge) {
    const err = new Error("Стикер отмечен для объединения — сначала снимите отметку");
    err.code = "AWAITING_MERGE";
    throw err;
  }
};

const SPLIT_KINDS = ["next", "rework", "incomplete"];

const assertNotAdvanced = async (stickerId) => {
  if ((await WorkStickerModel.countChildren(stickerId)) > 0) {
    const err = new Error("Стикер уже разделён на следующий шаг");
    err.code = "ALREADY_ADVANCED";
    throw err;
  }
};

const getSplits = (body) => {
  const splits = Array.isArray(body.splits) && body.splits.length > 0 ? body.splits : null;
  if (!splits) {
    const err = new Error("Не указано распределение по следующим операциям");
    err.code = "SPLITS_REQUIRED";
    throw err;
  }
  return splits;
};

// Количества > 0, путь входит в allowedKinds, сумма равна факту стикера.
const assertSplits = (splits, actualQuantity, allowedKinds, notAllowedMessage) => {
  let sum = 0;
  for (const split of splits) {
    const qty = toDecimal(split.quantity);
    if (!qty || qty <= 0) {
      const err = new Error("Некорректное количество в распределении");
      err.code = "INVALID_SPLIT_QUANTITY";
      throw err;
    }
    const kind = split.kind || "next";
    if (!SPLIT_KINDS.includes(kind)) {
      const err = new Error("Некорректный путь распределения");
      err.code = "INVALID_SPLIT_KIND";
      throw err;
    }
    if (!allowedKinds.includes(kind)) {
      const err = new Error(notAllowedMessage);
      err.code = "INVALID_SPLIT_KIND";
      throw err;
    }
    sum += qty;
  }
  if (Math.abs(sum - actualQuantity) > 0.0001) {
    const err = new Error(`Сумма распределения (${sum}) должна быть равна количеству (${actualQuantity})`);
    err.code = "SPLIT_SUM_MISMATCH";
    throw err;
  }
};

// Настроенные у типа варианты следующей операции (см. AddOperationType — поле
// "Следующая операция по умолчанию", теперь мультивыбор). Последняя операция
// ("is_final") следующей не имеет, даже если варианты остались в базе.
// Операции исправления в следующие не попадают — даже если остались в базе.
const getNextCandidates = (operationType) => {
  if (operationType?.is_final) return [];
  return (operationType?.nextOperations || [])
    .map((rel) => rel.nextOperationType)
    .filter((target) => target && !target.is_rework);
};

// Настроенные у типа варианты операции для исправления (см. AddOperationType —
// поле "Операция для исправления", мультивыбор). Заданная у типа остаётся
// доступной, даже если её потом отключили.
const getReworkCandidates = (operationType) =>
  (operationType?.reworkOperations || []).map((rel) => rel.reworkOperationType).filter(Boolean);

// Настроенные у типа варианты операции для не выполненных (см. AddOperationType —
// поле "Операция для не выполненных", мультивыбор). Не разрешены у типа
// (allow_incomplete) — вариантов нет, даже если они остались в базе.
const getIncompleteCandidates = (operationType) => {
  if (!operationType?.allow_incomplete) return [];
  return (operationType?.incompleteOperations || [])
    .map((rel) => rel.incompleteOperationType)
    .filter((target) => target && !target.is_rework);
};

// Выбранная операция: активная из базы; заданная по умолчанию у типа остаётся
// доступной, даже если её потом отключили. `isRework` — какой тип операции нужен:
// исправление или обычная (не исправление). `allowedIds` — сузить выбор до
// настроенного у типа списка (см. resolveNextTarget); null — без ограничения.
const pickOperationType = async (raw, defaultTarget, notFoundMessage, isRework, allowedIds = null) => {
  const targetId = toInt(raw);
  if (targetId && targetId === defaultTarget?.id) return defaultTarget;
  if (allowedIds && !allowedIds.includes(targetId)) {
    const err = new Error(notFoundMessage);
    err.code = "OPERATION_TYPE_NOT_FOUND";
    throw err;
  }

  const target = targetId
    ? await prismaContext.get().operation_types.findUnique({ where: { id: targetId } })
    : null;
  if (!target || !target.is_active || Boolean(target.is_rework) !== isRework) {
    const err = new Error(notFoundMessage);
    err.code = "OPERATION_TYPE_NOT_FOUND";
    throw err;
  }
  return target;
};

// У типа настроен один вариант следующей операции — он же подсказка по умолчанию;
// несколько — вариантов без явного выбора нет (defaultTarget = null), приёмщик
// выбирает сам, а сервер принимает только один из настроенных (allowedIds). Не
// настроено ни одного — прежнее поведение: подсказки нет, приёмщик вправе выбрать
// любую активную операцию (allowedIds = null). Ключа next_operation_type_id нет в
// теле — берётся операция по умолчанию. У последней операции ("is_final") следующей
// нет, выбрать нельзя.
const resolveNextTarget = async (sticker, body) => {
  const candidates = getNextCandidates(sticker.operationType);
  const defaultTarget = candidates.length === 1 ? candidates[0] : null;
  const raw = body.next_operation_type_id;
  if (raw === undefined) return defaultTarget;
  if (raw === null || raw === "") return null;

  if (sticker.operationType?.is_final) {
    const err = new Error("У последней операции нет следующей");
    err.code = "NO_NEXT_OPERATION";
    throw err;
  }

  return pickOperationType(
    raw,
    defaultTarget,
    "Следующая операция не найдена, отключена, является исправлением или не входит в список у типа",
    false,
    candidates.length > 0 ? candidates.map((c) => c.id) : null,
  );
};

// Операция для исправления — так же, как следующая: настроен один вариант — он
// же подставляется сам; несколько — вариантов без явного выбора нет, приёмщик
// выбирает сам, а сервер принимает только один из настроенных (allowedIds). Не
// настроено ни одного — прежнее поведение: приёмщик вправе выбрать любую активную
// операцию исправления (allowedIds = null).
const resolveReworkTarget = async (sticker, body) => {
  const candidates = getReworkCandidates(sticker.operationType);
  const defaultTarget = candidates.length === 1 ? candidates[0] : null;
  const raw = body.rework_operation_type_id;
  if (raw === undefined) return defaultTarget;
  if (raw === null || raw === "") return null;

  return pickOperationType(
    raw,
    defaultTarget,
    "Операция для исправления не найдена, отключена, не является исправлением или не входит в список у типа",
    true,
    candidates.length > 0 ? candidates.map((c) => c.id) : null,
  );
};

// Цепочка от стикера не глубже числа операций маршрута — предохранитель от цикла.
const MAX_ANCESTOR_DEPTH = 30;

// Предки стикера — операции, через которые прошла эта работа: по parent_sticker_id
// вверх, а у результата объединения — ещё и через его источники (merged_into_id),
// у которых родителя-то и нет. Ближайшие первыми. Раздача исправления (rework)
// тоже цепляется по parent_sticker_id, поэтому цепочка идёт и через неё.
const collectAncestors = async (sticker) => {
  const seen = new Set([sticker.id]);
  const nodes = [];
  let frontier = [sticker.parent_sticker_id, ...(sticker.mergedSources || []).map((source) => source.id)];

  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth++) {
    const ids = [...new Set(frontier.filter((id) => id && !seen.has(id)))];
    if (ids.length === 0) break;
    ids.forEach((id) => seen.add(id));

    const level = await WorkStickerModel.findLineageNodes(ids);
    frontier = [];
    for (const node of level) {
      nodes.push(node);
      frontier.push(node.parent_sticker_id, ...node.mergedSources.map((source) => source.id));
    }
  }
  return nodes;
};

// Виновной может быть только принятая операция: у неё есть сотрудник и выполненная
// работа. Долей нет (они часть основного стикера), стикер брака — не работа.
const isReworkOriginCandidate = (node) =>
  node.status === "done" && !node.share_of_id && node.split_kind !== "scrap";

// Операция-виновник исправления определяется сама, приёмщик её не выбирает: у типа
// операции исправления задана исправляемая операция (rework_target_operation_type_id,
// например «Исправление пошива» → «Пошив»), виновной считается ближайший принятый
// стикер этого типа — сам стикер, где брак нашли (если исправляют его же операцию),
// иначе среди предков цепочки. Не задана или такой операции в цепочке нет — null.
const findReworkOrigin = async (sticker, reworkTarget) => {
  const targetTypeId = reworkTarget?.rework_target_operation_type_id;
  if (!targetTypeId) return null;
  if (sticker.operation_type_id === targetTypeId) return sticker.id;

  const ancestors = (await collectAncestors(sticker)).filter(isReworkOriginCandidate);
  return ancestors.find((node) => node.operationType?.id === targetTypeId)?.id ?? null;
};

// Тип операции, где брак нашли и откуда стикер ушёл на исправление, — конец цепочки
// возврата: голова цепочки — ближайший стикер исправления (split_kind = rework) вверх
// по родителям, а искомая операция — тип его родителя. Стикер не на цепочке возврата — null.
const findReturnDetectorTypeId = async (sticker) => {
  let node = sticker;
  for (let depth = 0; node && depth < MAX_ANCESTOR_DEPTH; depth++) {
    if (node.split_kind === "rework") return node.parent?.operationType?.id ?? null;
    node = node.parent_sticker_id ? await WorkStickerModel.findUnique(node.parent_sticker_id) : null;
  }
  return null;
};

// Не выполненные — так же, как следующая: настроен один вариант — он же
// подставляется сам; несколько — приёмщик выбирает, сервер принимает только один из
// настроенных. Не настроено ни одного — любая активная обычная операция. Не
// разрешены у типа — выбрать нельзя.
const resolveIncompleteTarget = async (sticker, body) => {
  const candidates = getIncompleteCandidates(sticker.operationType);
  const defaultTarget = candidates.length === 1 ? candidates[0] : null;
  const raw = body.incomplete_operation_type_id;
  if (raw === undefined) return defaultTarget;
  if (raw === null || raw === "") return null;

  if (!sticker.operationType?.allow_incomplete) {
    const err = new Error("У этой операции не разрешены не выполненные");
    err.code = "INCOMPLETE_NOT_ALLOWED";
    throw err;
  }

  return pickOperationType(
    raw,
    defaultTarget,
    "Операция для не выполненных не найдена, отключена, является исправлением или не входит в список у типа",
    false,
    candidates.length > 0 ? candidates.map((c) => c.id) : null,
  );
};

// "Объединить с другими" вместо следующей операции (await_merge): годное стикера
// не раздаётся, а ждёт объединения — разрешено только там, где у типа есть
// объединение, у не последней операции и при наличии годного.
const assertCanAwaitMerge = (sticker) => {
  if (!sticker.operationType?.allow_merge) {
    const err = new Error("Для этой операции объединение стикеров не разрешено");
    err.code = "MERGE_NOT_ALLOWED";
    throw err;
  }
  if (sticker.operationType?.is_final) {
    const err = new Error("У последней операции нет следующей");
    err.code = "NO_NEXT_OPERATION";
    throw err;
  }
  if (goodQuantityOf(sticker) <= 0) {
    const err = new Error("Нет годного количества для объединения — только брак, исправление и/или не выполненное");
    err.code = "MERGE_EMPTY";
    throw err;
  }
};

const advanceSticker = async (sticker, body, userId) => {
  await assertNotAdvanced(sticker.id);
  // Годное уходит в объединение, а не на следующую операцию: брак, исправление и не
  // выполненное при этом раздаются как обычно — их стикеры нужно печатать сразу.
  const awaitMerge = Boolean(body.await_merge);
  if (awaitMerge) assertCanAwaitMerge(sticker);
  const targets = {
    next: awaitMerge ? null : await resolveNextTarget(sticker, body),
    rework: await resolveReworkTarget(sticker, body),
    incomplete: await resolveIncompleteTarget(sticker, body),
  };
  // Операция-виновник нужна только стикеру исправления: нет исправления — не ищем.
  const reworkOriginId = targets.rework ? await findReworkOrigin(sticker, targets.rework) : null;
  // Цепочка возврата: после «Ремонта» работа может пойти через другие операции (например,
  // «Утюжка после ремонта») и вернуться туда, где брак нашли. Пока стикер на цепочке
  // (у него есть origin_sticker_id), следующие стикеры наследуют того же виновника — вся
  // цепочка возврата относится к одной исправляемой операции. Возврат на операцию, где
  // брак нашли (например, «Контроль»), цепочку заканчивает: там работа снова обычная.
  const returnOriginId = sticker.origin_sticker_id || null;
  const returnDetectorTypeId = returnOriginId ? await findReturnDetectorTypeId(sticker) : null;

  // Раздаётся выполненное (годное) дальше, количество на исправление, указанное
  // при приёме, — на операцию исправления, и не выполненное — на операцию для не
  // выполненных. Целиком бракованный стикер раздавать нечего — тогда создаётся
  // только стикер брака. Годное, ждущее объединения, не раздаётся.
  const distributable = round4(
    (awaitMerge ? 0 : goodQuantityOf(sticker)) +
      Number(sticker.rework_quantity || 0) +
      Number(sticker.incomplete_quantity || 0),
  );
  const splits = distributable > 0 ? getSplits(body) : [];
  if (distributable > 0) {
    assertSplits(
      splits,
      distributable,
      [
        ...(awaitMerge ? [] : ["next"]),
        ...(targets.rework ? ["rework"] : []),
        ...(targets.incomplete ? ["incomplete"] : []),
      ],
      "«Исправление» и «Не выполнено» доступны, только если выбрана соответствующая операция",
    );
  }

  // Новое исправление — свой виновник; следующая операция и не выполненное остаются на цепочке возврата.
  const originIdFor = (kind, target) => {
    if (kind === "rework") return reworkOriginId;
    return returnOriginId && target.id !== returnDetectorTypeId ? returnOriginId : null;
  };

  const rows = splits
    .filter((split) => targets[split.kind || "next"])
    .map((split) => {
      const kind = split.kind || "next";
      const target = targets[kind];
      const originId = originIdFor(kind, target);
      return {
        batch_receipt_item_id: sticker.batch_receipt_item_id,
        operation_type_id: target.id,
        planned_quantity: toDecimal(split.quantity),
        rate: target.price,
        status: "pending",
        split_kind: kind === "rework" || kind === "incomplete" ? kind : "normal",
        parent_sticker_id: sticker.id,
        ...(originId ? { origin_sticker_id: originId } : {}),
        comment: trim(split.comment, 2000),
        added_by: Number(userId),
      };
    });

  // Брак, указанный при приёме, тоже получает стикер — его печатают и маркируют
  // физически. Операция — та, где забраковали; оплаты и количества "выполнено"
  // у него нет (брак уже учтён в defect_quantity принятого стикера).
  const defectQuantity = Number(sticker.defect_quantity) || 0;
  if (defectQuantity > 0) {
    rows.push({
      batch_receipt_item_id: sticker.batch_receipt_item_id,
      operation_type_id: sticker.operation_type_id,
      planned_quantity: defectQuantity,
      status: "scrapped",
      split_kind: "scrap",
      parent_sticker_id: sticker.id,
      added_by: Number(userId),
    });
  }

  const result = awaitMerge
    ? await WorkStickerModel.createBatchAwaitingMerge(sticker.id, rows)
    : rows.length > 0
      ? await WorkStickerModel.createBatch(rows)
      : [];

  await createAuditLog({
    userId,
    action: "update",
    entity: "work_stickers",
    recordId: sticker.id,
    oldData: sticker,
    newData: { advanced_to: result, ...(awaitMerge ? { awaiting_merge: true } : {}) },
  });

  return result;
};

export const WorkStickersService = {
  getAll: async ({ page, pageSize, filters = {}, userId }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    // Доли сотрудников (share_of_id) — часть приёма основного стикера: в списках их
    // не показываем, они приходят вместе с основным в поле shares.
    const where = { share_of_id: null };
    if (filters.status) where.status = filters.status;
    if (filters.awaiting_merge) where.awaiting_merge = true;
    if (filters.batch_receipt_item_id) where.batch_receipt_item_id = Number(filters.batch_receipt_item_id);
    // Стикеры, на которые разделён принятый стикер (по порядку создания — как раздавали).
    if (filters.parent_sticker_id) where.parent_sticker_id = Number(filters.parent_sticker_id);
    // История приёма и список ожидающих скана: только операции, доступные логину
    // (пусто — все). «Только свои» — ещё и принятые им самим, но лишь для истории:
    // у ожидающих скана stikerов scanned_by ещё не проставлен, фильтр их бы обнулил.
    // Права берём из сессии, а не из запроса, — чужую историю через фильтр не запросить.
    if (filters.by_production_access) {
      const { operationTypeIds, ownOnly } = await getProductionAccess(userId);
      if (operationTypeIds.length > 0) where.operation_type_id = { in: operationTypeIds };
      if (ownOnly && where.status !== "pending") where.scanned_by = Number(userId);
    }

    const search = trim(filters.search, 100);
    if (search) {
      const contains = (value) => ({ contains: value, mode: "insensitive" });
      // ФИО: каждое слово запроса должно встретиться в фамилии, имени или отчестве
      // ("Iraliyeva Dilbarxon" найдёт сотрудника целиком).
      const nameTokens = search.split(/\s+/);
      const employeeNameMatch = {
        AND: nameTokens.map((token) => ({
          OR: [
            { last_name: contains(token) },
            { first_name: contains(token) },
            { middle_name: contains(token) },
          ],
        })),
      };
      // Число в скобках у сотрудника в таблице — его id (int4: больше — Prisma упадёт).
      const employeeId = /^\d{1,9}$/.test(search) ? Number(search) : null;

      where.OR = [
        { sticker_code: contains(search) },
        { batchReceiptItem: { receipt: { batch_number: contains(search) } } },
        { batchReceiptItem: { receipt: { document_number: contains(search) } } },
        { operationType: { name: contains(search) } },
        { employee: employeeNameMatch },
        { employee: { employee_number: contains(search) } },
        ...(employeeId !== null ? [{ employee: { id: employeeId } }] : []),
        // Работу могли выполнить несколько сотрудников — ищем и по их долям.
        { shares: { some: { employee: employeeNameMatch } } },
        { shares: { some: { employee: { employee_number: contains(search) } } } },
        ...(employeeId !== null ? [{ shares: { some: { employee: { id: employeeId } } } }] : []),
      ];
    }

    const [data, total] = await Promise.all([
      WorkStickerModel.findMany({
        where,
        skip,
        take: limit,
        orderBy: filters.parent_sticker_id ? { id: "asc" } : undefined,
      }),
      WorkStickerModel.count(where),
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

  getById: async (id) => WorkStickerModel.findUnique(id),

  getByCode: async (code) => WorkStickerModel.findByCode(trim(code, 50)),

  // Остаток по позиции партии: сколько ещё можно раздать на работу. Каждая операция
  // проходит позицию целиком, поэтому с `operationTypeId` остаток считается по
  // этой операции, без него — по всем операциям сразу.
  getItemRemaining: async (itemId, operationTypeId) => {
    const prisma = prismaContext.get();
    const item = await prisma.batch_receipt_items.findUnique({ where: { id: Number(itemId) } });
    if (!item) {
      const err = new Error("Позиция партии не найдена");
      err.code = "BATCH_ITEM_NOT_FOUND";
      throw err;
    }

    const distributed = await WorkStickerModel.sumPlannedByItem(itemId, toInt(operationTypeId));
    const quantity = Number(item.quantity);
    return { quantity, distributed, remaining: Math.max(quantity - distributed, 0) };
  },

  // Распределение работы: печатает `count` стикеров под одну позицию партии+операцию.
  // Нельзя раздать больше, чем осталось от quantity этой позиции по этой операции
  // (каждая операция проходит позицию целиком, лимиты операций независимы). Сотрудник ещё
  // не известен — заполняется позже, при приёме работы (scan).
  create: async (body, userId) => {
    const batchReceiptItemId = toInt(body.batch_receipt_item_id);
    const operationTypeId = toInt(body.operation_type_id);
    const plannedQuantity = toDecimal(body.planned_quantity);
    const count = Math.max(toInt(body.count) || 1, 1);
    const comment = trim(body.comment, 2000);

    // Предохранитель от опечатки: количество на стикер дробное (до 0.0001), так что
    // без потолка count мог бы дойти до миллионов строк.
    if (count > MAX_STICKERS_PER_CREATE) {
      const err = new Error(`За один раз можно создать не больше ${MAX_STICKERS_PER_CREATE} стикеров`);
      err.code = "COUNT_TOO_LARGE";
      throw err;
    }

    if (!batchReceiptItemId) {
      const err = new Error("Не выбрана позиция партии");
      err.code = "BATCH_ITEM_REQUIRED";
      throw err;
    }

    if (!operationTypeId) {
      const err = new Error("Не выбран тип операции");
      err.code = "OPERATION_TYPE_REQUIRED";
      throw err;
    }
    await assertOperationAllowed(userId, operationTypeId);
    if (!plannedQuantity || plannedQuantity <= 0) {
      const err = new Error("Не заполнено количество на стикер");
      err.code = "PLANNED_QUANTITY_REQUIRED";
      throw err;
    }

    const prisma = prismaContext.get();
    const [batchReceiptItem, operationType] = await Promise.all([
      prisma.batch_receipt_items.findUnique({ where: { id: batchReceiptItemId } }),
      prisma.operation_types.findUnique({ where: { id: operationTypeId } }),
    ]);
    if (!batchReceiptItem) {
      const err = new Error("Позиция партии не найдена");
      err.code = "BATCH_ITEM_NOT_FOUND";
      throw err;
    }
    if (!operationType) {
      const err = new Error("Тип операции не найден");
      err.code = "OPERATION_TYPE_NOT_FOUND";
      throw err;
    }

    const totalRequested = plannedQuantity * count;
    const distributed = await WorkStickerModel.sumPlannedByItem(batchReceiptItemId, operationTypeId);
    const remaining = Number(batchReceiptItem.quantity) - distributed;
    if (totalRequested > remaining) {
      const err = new Error(
        `Превышен остаток позиции по операции: осталось ${remaining}, запрошено ${totalRequested}`,
      );
      err.code = "EXCEEDS_ITEM_QUANTITY";
      throw err;
    }

    const rows = Array.from({ length: count }, () => ({
      batch_receipt_item_id: batchReceiptItemId,
      operation_type_id: operationTypeId,
      planned_quantity: plannedQuantity,
      rate: operationType.price,
      comment,
      added_by: Number(userId),
    }));

    const result = await WorkStickerModel.createBatch(rows);

    await createAuditLog({
      userId,
      action: "create",
      entity: "work_stickers",
      recordId: result[0]?.id,
      // Тысячи стикеров со вложенными связями раздули бы audit_logs на десятки МБ.
      newData: result.length > 50 ? { count: result.length, ids: result.map((s) => s.id) } : result,
    });

    return result;
  },

  // Приём работы: сканируется sticker_code, вписывается кто выполнил и факт.
  scan: async (code, body, userId) => {
    const sticker = await WorkStickerModel.findByCode(trim(code, 50));
    if (!sticker) {
      const err = new Error("Стикер не найден");
      err.code = "STICKER_NOT_FOUND";
      throw err;
    }
    await assertOperationAllowed(userId, sticker.operation_type_id);
    if (sticker.status !== "pending") {
      const err = new Error("Стикер уже принят");
      err.code = "ALREADY_DONE";
      throw err;
    }

    const employeeId = toInt(body.employee_id);
    // Стикер делится на части: actual_quantity — выполнено (это и есть годное,
    // по нему оплата и раздача дальше), defect_quantity — брак, rework_quantity —
    // на исправление, incomplete_quantity — не выполнено (только если у типа
    // разрешено; операции для исправления и не выполненных выбирают при раздаче).
    // Вместе не больше количества на самом стикере.
    const actualQuantity = toDecimal(body.actual_quantity) ?? 0;
    const defectQuantity = toDecimal(body.defect_quantity) ?? 0;
    const reworkQuantity = toDecimal(body.rework_quantity) ?? 0;
    const incompleteQuantity = toDecimal(body.incomplete_quantity) ?? 0;
    if (!employeeId) {
      const err = new Error("Не выбран сотрудник");
      err.code = "EMPLOYEE_REQUIRED";
      throw err;
    }
    // Пустой список допущенных = тип операции доступен всем.
    const allowedEmployees = sticker.operationType?.employees || [];
    if (allowedEmployees.length > 0 && !allowedEmployees.some((e) => e.employee_id === employeeId)) {
      const err = new Error("Сотрудник не допущен к этому типу операции");
      err.code = "EMPLOYEE_NOT_ALLOWED";
      throw err;
    }
    if (actualQuantity < 0) {
      const err = new Error("Некорректное количество выполненного");
      err.code = "ACTUAL_QUANTITY_REQUIRED";
      throw err;
    }
    if (defectQuantity < 0) {
      const err = new Error("Некорректное количество брака");
      err.code = "INVALID_DEFECT_QUANTITY";
      throw err;
    }
    if (reworkQuantity < 0) {
      const err = new Error("Некорректное количество на исправление");
      err.code = "INVALID_REWORK_QUANTITY";
      throw err;
    }
    // Целиком бракованный стикер (выполнено 0, брак > 0) допустим: оплачивать
    // и раздавать нечего.
    if (incompleteQuantity < 0) {
      const err = new Error("Некорректное количество не выполненного");
      err.code = "INVALID_INCOMPLETE_QUANTITY";
      throw err;
    }
    if (incompleteQuantity > 0 && !sticker.operationType?.allow_incomplete) {
      const err = new Error("У этой операции не разрешены не выполненные");
      err.code = "INCOMPLETE_NOT_ALLOWED";
      throw err;
    }
    if (actualQuantity + defectQuantity + reworkQuantity + incompleteQuantity <= 0) {
      const err = new Error("Не заполнено количество выполненного");
      err.code = "ACTUAL_QUANTITY_REQUIRED";
      throw err;
    }
    // Больше количества на стикере принять нельзя.
    const maxQuantity = Number(sticker.planned_quantity);
    if (actualQuantity + defectQuantity + reworkQuantity + incompleteQuantity - maxQuantity > 0.0001) {
      const err = new Error(
        `Выполнено, брак, исправление и не выполнено вместе не могут быть больше количества на стикере (${maxQuantity})`,
      );
      err.code = "QUANTITY_EXCEEDS_MAX";
      throw err;
    }
    // Остатка быть не должно: всё количество стикера разложено на выполнено,
    // брак, исправление и не выполнено.
    const remainder =
      Math.round((maxQuantity - actualQuantity - defectQuantity - reworkQuantity - incompleteQuantity) * 10000) / 10000;
    if (remainder > 0.0001) {
      const err = new Error(
        `Остаток ${remainder}: выполнено, брак, исправление и не выполнено вместе должны равняться количеству на стикере (${maxQuantity})`,
      );
      err.code = "QUANTITY_REMAINDER";
      throw err;
    }

    // Работу могли выполнить несколько сотрудников: employee_id — основной, co_workers —
    // остальные с их долей выполненного. Доли не пересекаются и в сумме меньше
    // выполненного — основному остаётся своя часть (actual_quantity − доли остальных).
    const coWorkersRaw = Array.isArray(body.co_workers) ? body.co_workers : [];
    if (coWorkersRaw.length > MAX_CO_WORKERS) {
      const err = new Error(`Сотрудников на один стикер — не больше ${MAX_CO_WORKERS + 1}`);
      err.code = "WORKERS_INVALID";
      throw err;
    }
    const coWorkers = coWorkersRaw.map((worker) => ({
      employeeId: toInt(worker?.employee_id),
      quantity: toDecimal(worker?.quantity),
    }));
    const usedEmployees = new Set([employeeId]);
    for (const worker of coWorkers) {
      if (!worker.employeeId || !(worker.quantity > 0)) {
        const err = new Error("Для каждой доли укажите сотрудника и количество");
        err.code = "WORKERS_INVALID";
        throw err;
      }
      if (usedEmployees.has(worker.employeeId)) {
        const err = new Error("Сотрудник указан больше одного раза");
        err.code = "WORKERS_INVALID";
        throw err;
      }
      usedEmployees.add(worker.employeeId);
      if (allowedEmployees.length > 0 && !allowedEmployees.some((e) => e.employee_id === worker.employeeId)) {
        const err = new Error("Сотрудник не допущен к этому типу операции");
        err.code = "EMPLOYEE_NOT_ALLOWED";
        throw err;
      }
    }
    if (coWorkers.length > 0) {
      const found = await prismaContext.get().employees.findMany({
        where: { id: { in: coWorkers.map((worker) => worker.employeeId) } },
        select: { id: true },
      });
      if (found.length !== coWorkers.length) {
        const err = new Error("Сотрудник не найден");
        err.code = "WORKERS_INVALID";
        throw err;
      }
    }
    const coTotal = round4(coWorkers.reduce((sum, worker) => sum + worker.quantity, 0));
    const primaryQuantity = round4(actualQuantity - coTotal);
    if (coWorkers.length > 0 && !(primaryQuantity > 0.0001)) {
      const err = new Error(`Доли других сотрудников (${coTotal}) должны быть меньше выполненного (${actualQuantity})`);
      err.code = "WORKERS_INVALID";
      throw err;
    }

    // Цена по умолчанию — снимок с типа операции (rate стикера), но приёмщик
    // может скорректировать её прямо при приёме (сдельная ставка меняется).
    const bodyRate = toDecimal(body.rate);
    const rate = bodyRate !== null && bodyRate >= 0 ? bodyRate : sticker.rate ? Number(sticker.rate) : 0;
    const amountOf = (quantity) =>
      calcAmount({
        unit: sticker.operationType?.unit,
        size: sticker.batchReceiptItem?.size,
        quantity,
        rate,
      });

    const comment = trim(body.comment, 2000) ?? sticker.comment;
    const scannedAt = new Date();
    // Доли остальных — обычные принятые стикеры со своим сотрудником и суммой
    // (planned_quantity = 0: сами штуки уже посчитаны в основном стикере).
    const shareRows = coWorkers.map((worker) => ({
      batch_receipt_item_id: sticker.batch_receipt_item_id,
      operation_type_id: sticker.operation_type_id,
      planned_quantity: 0,
      rate,
      status: "done",
      split_kind: "share",
      employee_id: worker.employeeId,
      actual_quantity: worker.quantity,
      amount: amountOf(worker.quantity),
      comment,
      added_by: Number(userId),
      scanned_by: Number(userId),
      scanned_at: scannedAt,
    }));

    const ownQuantity = coWorkers.length > 0 ? primaryQuantity : actualQuantity;
    const result = await WorkStickerModel.scanWithShares(
      sticker.id,
      {
        employee_id: employeeId,
        actual_quantity: ownQuantity,
        defect_quantity: defectQuantity > 0 ? defectQuantity : null,
        rework_quantity: reworkQuantity > 0 ? reworkQuantity : null,
        incomplete_quantity: incompleteQuantity > 0 ? incompleteQuantity : null,
        rate,
        amount: amountOf(ownQuantity),
        comment,
        status: "done",
        scanned_by: Number(userId),
        scanned_at: scannedAt,
      },
      shareRows,
    );

    await createAuditLog({
      userId,
      action: "update",
      entity: "work_stickers",
      recordId: sticker.id,
      oldData: sticker,
      newData: result,
    });

    return result;
  },

  // Раздача принятого стикера дальше. Годное (actual_quantity) со сканированного
  // стикера делится на splits: "next" — на выбранную следующую операцию (по
  // умолчанию — заданную у типа), "rework" — на операцию исправления (если она
  // задана у типа операции).
  advance: async (code, body, userId) => {
    const sticker = await WorkStickerModel.findByCode(trim(code, 50));
    if (!sticker) {
      const err = new Error("Стикер не найден");
      err.code = "STICKER_NOT_FOUND";
      throw err;
    }
    await assertOperationAllowed(userId, sticker.operation_type_id);
    if (sticker.status !== "done") {
      const err = new Error("Стикер ещё не принят — сначала скан приёма работы");
      err.code = "STICKER_NOT_DONE";
      throw err;
    }
    assertNotShare(sticker);
    assertNotMerged(sticker);
    assertNotAwaitingMerge(sticker);
    // Следующую операцию выбирают при раздаче, так что задана она у типа или нет —
    // не важно; раздавать некуда только у последней операции без выбранной
    // операции для исправления и без брака (стикер брака создаётся при раздаче).
    if (
      sticker.operationType?.is_final &&
      !(Number(sticker.defect_quantity) > 0) &&
      !(await resolveReworkTarget(sticker, body)) &&
      !(Number(sticker.incomplete_quantity) > 0 && (await resolveIncompleteTarget(sticker, body)))
    ) {
      const err = new Error(
        "У последней операции нет следующей и не выбрана операция для исправления или не выполненных",
      );
      err.code = "NO_NEXT_OPERATION";
      throw err;
    }

    return advanceSticker(sticker, body, userId);
  },

  // Отметка "ждёт объединения" — раздача одиночно блокируется (assertNotAwaitingMerge),
  // а режим объединения на "Приёме работы" подтягивает такие стикеры сам, без
  // повторного скана. Снять отметку можно всегда; поставить — только пока не
  // разослан/не объединён и операция это разрешает.
  setAwaitingMerge: async (code, value, userId) => {
    const sticker = await WorkStickerModel.findByCode(trim(code, 50));
    if (!sticker) {
      const err = new Error("Стикер не найден");
      err.code = "STICKER_NOT_FOUND";
      throw err;
    }
    await assertOperationAllowed(userId, sticker.operation_type_id);
    assertNotShare(sticker);
    if (sticker.status !== "done") {
      const err = new Error("Стикер ещё не принят");
      err.code = "STICKER_NOT_DONE";
      throw err;
    }

    const hasChildren = (sticker.children?.length || 0) > 0;
    if (value) {
      assertNotMerged(sticker);
      // Дети у уже отмеченного — стикеры брака/исправления, напечатанные при раздаче с
      // "объединить с другими": это то же состояние, а не раздача дальше.
      if (hasChildren && !sticker.awaiting_merge) {
        const err = new Error("Стикер уже распределён дальше");
        err.code = "ALREADY_ADVANCED";
        throw err;
      }
      if (!sticker.operationType?.allow_merge) {
        const err = new Error("Для этой операции объединение стикеров не разрешено");
        err.code = "MERGE_NOT_ALLOWED";
        throw err;
      }
    } else if (hasChildren && sticker.awaiting_merge) {
      // Стикеры брака/исправления уже напечатаны — снять отметку значит оставить годное
      // без пути дальше. Сначала откатывают распределение ("Назад к распределению").
      const err = new Error("Стикеры брака/исправления уже напечатаны — сначала верните распределение");
      err.code = "ALREADY_ADVANCED";
      throw err;
    }

    const result = await WorkStickerModel.setAwaitingMerge(sticker.id, Boolean(value));

    await createAuditLog({
      userId,
      action: "update",
      entity: "work_stickers",
      recordId: sticker.id,
      oldData: sticker,
      newData: result,
    });

    return result;
  },

  // Объединение неск. принятых стикеров одной операции (с allow_merge у типа),
  // партии и размера в один — перед раздачей на следующую операцию. В общий пул
  // идёт только годное каждого источника; брак/исправление источника уходит как
  // при обычной раздаче — отдельным дочерним стикером на сам источник.
  merge: async (body, userId) => {
    const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(toInt).filter(Boolean))];
    if (ids.length < 2) {
      const err = new Error("Нужно выбрать минимум 2 стикера для объединения");
      err.code = "MERGE_MIN_TWO";
      throw err;
    }

    const stickers = await WorkStickerModel.findManyByIds(ids);
    if (stickers.length !== ids.length) {
      const err = new Error("Часть стикеров не найдена");
      err.code = "STICKER_NOT_FOUND";
      throw err;
    }

    for (const sticker of stickers) {
      assertNotShare(sticker);
      assertNotMerged(sticker);
      if (sticker.status !== "done") {
        const err = new Error(`Стикер ${sticker.sticker_code} ещё не принят`);
        err.code = "STICKER_NOT_DONE";
        throw err;
      }
      // Дети допустимы только у ждущего объединения — это уже напечатанные стикеры
      // брака/исправления/не выполненного (раздача с "объединить с другими"). Раздача
      // годного на следующую операцию ("normal") — уже распределён дальше.
      const children = sticker.children || [];
      if (children.length > 0 && (!sticker.awaiting_merge || children.some((c) => c.split_kind === "normal"))) {
        const err = new Error(`Стикер ${sticker.sticker_code} уже распределён дальше`);
        err.code = "ALREADY_ADVANCED";
        throw err;
      }
    }

    const [first, ...rest] = stickers;
    if (rest.some((s) => s.operation_type_id !== first.operation_type_id)) {
      const err = new Error("Объединять можно только стикеры одной операции");
      err.code = "MERGE_OPERATION_MISMATCH";
      throw err;
    }

    await assertOperationAllowed(userId, first.operation_type_id);

    if (!first.operationType?.allow_merge) {
      const err = new Error("Для этой операции объединение стикеров не разрешено");
      err.code = "MERGE_NOT_ALLOWED";
      throw err;
    }
    if (rest.some((s) => s.batchReceiptItem?.receipt?.id !== first.batchReceiptItem?.receipt?.id)) {
      const err = new Error("Объединять можно только стикеры одной партии");
      err.code = "MERGE_BATCH_MISMATCH";
      throw err;
    }
    if (rest.some((s) => (s.batchReceiptItem?.size || "") !== (first.batchReceiptItem?.size || ""))) {
      const err = new Error("Объединять можно только стикеры одного размера");
      err.code = "MERGE_SIZE_MISMATCH";
      throw err;
    }
    if (first.operationType?.is_final) {
      const err = new Error("У последней операции нет следующей");
      err.code = "NO_NEXT_OPERATION";
      throw err;
    }

    // Как resolveNextTarget при обычной раздаче: не пришло поле — берём заданную
    // у типа (если вариант один), пусто — явно "не выбрано", иначе — выбор
    // приёмщика, сервер принимает только один из настроенных.
    const candidates = getNextCandidates(first.operationType);
    const defaultTarget = candidates.length === 1 ? candidates[0] : null;
    const raw = body.next_operation_type_id;
    const target =
      raw === undefined
        ? defaultTarget
        : raw === null || raw === ""
          ? null
          : await pickOperationType(
              raw,
              defaultTarget,
              "Следующая операция не найдена, отключена, является исправлением или не входит в список у типа",
              false,
              candidates.length > 0 ? candidates.map((c) => c.id) : null,
            );
    if (!target) {
      const err = new Error("Не выбрана следующая операция");
      err.code = "NO_NEXT_OPERATION";
      throw err;
    }

    // Как в обычной раздаче: настроен один вариант — он подставляется сам;
    // несколько или ни одного — при объединении выбора нет, только автоподстановка.
    const reworkCandidates = getReworkCandidates(first.operationType);
    const reworkTarget = reworkCandidates.length === 1 ? reworkCandidates[0] : null;
    const incompleteCandidates = getIncompleteCandidates(first.operationType);
    const incompleteTarget = incompleteCandidates.length === 1 ? incompleteCandidates[0] : null;

    // Брак/исправление/не выполненное каждого источника — своим дочерним стикером на источник,
    // в общий пул попадает только годное (см. advanceSticker — та же логика,
    // только "next"-часть годного здесь одна общая на всех источников).
    const extraRows = [];
    for (const sticker of stickers) {
      // Стикеры брака/исправления/не выполненного уже напечатаны при раздаче — второй
      // раз не создаём (дубли количества).
      if ((sticker.children?.length || 0) > 0) continue;

      const defectQuantity = Number(sticker.defect_quantity) || 0;
      if (defectQuantity > 0) {
        extraRows.push({
          batch_receipt_item_id: sticker.batch_receipt_item_id,
          operation_type_id: sticker.operation_type_id,
          planned_quantity: defectQuantity,
          status: "scrapped",
          split_kind: "scrap",
          parent_sticker_id: sticker.id,
          added_by: Number(userId),
        });
      }

      const reworkQuantity = Number(sticker.rework_quantity) || 0;
      if (reworkQuantity > 0) {
        if (!reworkTarget) {
          const err = new Error(
            `У стикера ${sticker.sticker_code} есть количество на исправление, а операция для исправления не задана`,
          );
          err.code = "NO_REWORK_OPERATION";
          throw err;
        }
        const originId = await findReworkOrigin(sticker, reworkTarget);
        extraRows.push({
          batch_receipt_item_id: sticker.batch_receipt_item_id,
          operation_type_id: reworkTarget.id,
          planned_quantity: reworkQuantity,
          rate: reworkTarget.price,
          status: "pending",
          split_kind: "rework",
          parent_sticker_id: sticker.id,
          ...(originId ? { origin_sticker_id: originId } : {}),
          added_by: Number(userId),
        });
      }

      const incompleteQuantity = Number(sticker.incomplete_quantity) || 0;
      if (incompleteQuantity > 0) {
        if (!incompleteTarget) {
          const err = new Error(
            `У стикера ${sticker.sticker_code} есть не выполненное количество, а операция для не выполненных не задана`,
          );
          err.code = "NO_INCOMPLETE_OPERATION";
          throw err;
        }
        extraRows.push({
          batch_receipt_item_id: sticker.batch_receipt_item_id,
          operation_type_id: incompleteTarget.id,
          planned_quantity: incompleteQuantity,
          rate: incompleteTarget.price,
          status: "pending",
          split_kind: "incomplete",
          parent_sticker_id: sticker.id,
          added_by: Number(userId),
        });
      }
    }

    const mergedQuantity = round4(stickers.reduce((sum, sticker) => sum + goodQuantityOf(sticker), 0));
    if (mergedQuantity <= 0) {
      const err = new Error("Нет годного количества для объединения — только брак, исправление и/или не выполненное");
      err.code = "MERGE_EMPTY";
      throw err;
    }

    const mergedRow = {
      batch_receipt_item_id: first.batch_receipt_item_id,
      operation_type_id: target.id,
      planned_quantity: mergedQuantity,
      rate: target.price,
      status: "pending",
      split_kind: "normal",
      added_by: Number(userId),
    };

    const result = await WorkStickerModel.mergeAdvance(ids, extraRows, mergedRow);

    await createAuditLog({
      userId,
      action: "update",
      entity: "work_stickers",
      recordId: first.id,
      oldData: { merged_source_ids: ids },
      newData: { merged_to: result },
    });

    return result;
  },

  // Возврат принятого стикера в pending — отмена скана приёма (если ошиблись
  // сотрудником/фактом), только пока не раздан дальше (нет детей).
  revert: async (code, userId) => {
    const sticker = await WorkStickerModel.findByCode(trim(code, 50));
    if (!sticker) {
      const err = new Error("Стикер не найден");
      err.code = "STICKER_NOT_FOUND";
      throw err;
    }
    await assertOperationAllowed(userId, sticker.operation_type_id);
    if (sticker.status !== "done") {
      const err = new Error("Стикер ещё не принят");
      err.code = "STICKER_NOT_DONE";
      throw err;
    }
    assertNotShare(sticker);
    assertNotMerged(sticker);
    assertNotAwaitingMerge(sticker);

    const advanced = await WorkStickerModel.countChildren(sticker.id);
    if (advanced > 0) {
      const err = new Error("Стикер уже распределён дальше — вернуть нельзя");
      err.code = "ALREADY_ADVANCED";
      throw err;
    }

    // Доли других сотрудников удаляются вместе с приёмом (scanWithShares без долей).
    const result = await WorkStickerModel.scanWithShares(sticker.id, {
      employee_id: null,
      actual_quantity: null,
      defect_quantity: null,
      rework_quantity: null,
      incomplete_quantity: null,
      amount: null,
      status: "pending",
      scanned_by: null,
      scanned_at: null,
    });

    await createAuditLog({
      userId,
      action: "update",
      entity: "work_stickers",
      recordId: sticker.id,
      oldData: sticker,
      newData: result,
    });

    return result;
  },

  // Удаление стикера: pending (ещё не принят) или scrapped (брак — физического
  // стикера и оплаты по нему нет). Так при ошибке в распределении можно убрать
  // все дочерние стикеры, включая брак, и раздать заново. Принятый (done) —
  // история выполненной работы (по нему начислена оплата), удалять нельзя.
  remove: async (id, userId) => {
    const old = await WorkStickerModel.findUnique(id);
    if (!old) return null;
    // Дочерний стикер создан раздачей родителя (следующая операция, исправление):
    // "Назад к распределению" удаляет его у того, кто раздавал, а следующая
    // операция ему может быть недоступна — хватает права на операцию родителя.
    const parent = old.parent_sticker_id ? await WorkStickerModel.findUnique(old.parent_sticker_id) : null;
    await assertAnyOperationAllowed(userId, [old.operation_type_id, parent?.operation_type_id]);
    if (!["pending", "scrapped"].includes(old.status)) {
      const err = new Error("Стикер уже принят — удалить нельзя");
      err.code = "NOT_DELETABLE";
      throw err;
    }

    const result = await WorkStickerModel.delete(id);

    await createAuditLog({
      userId,
      action: "delete",
      entity: "work_stickers",
      recordId: id,
      oldData: old,
    });

    return result;
  },
};
