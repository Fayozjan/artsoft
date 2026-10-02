import { DateTime } from "luxon";
import { ProductionReportModel } from "./productionReport.model.js";
import { UserModel } from "../users/users.model.js";
import { buildEmployeeAccess } from "../employees/employee.helpers.js";
import { ZONE, employeeFullName } from "../canteen/canteen.helpers.js";
import { getProductionAccess, assertCanEditProductionReport } from "../../utils/productionAccess.js";
import { createAuditLogs } from "../../utils/auditLog.js";
import { userDisplayName } from "../../utils/userDisplayName.js";
import { calcAmount } from "../workStickers/workStickers.service.js";

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const toInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Decimal (Prisma) / null → number
const num = (value) => Number(value ?? 0);

const round = (value, digits) => {
  const k = 10 ** digits;
  return Math.round(value * k) / k;
};

// "2026-08-31" → Date для колонки @db.Date (Prisma сравнивает по UTC-полуночи)
const parseDate = (value) => {
  if (!value) return null;
  const dt = DateTime.fromISO(String(value), { zone: ZONE });
  return dt.isValid ? new Date(`${dt.toISODate()}T00:00:00.000Z`) : null;
};

// Границы локальных суток для timestamptz-колонок: [начало from, начало дня после to)
const dayRange = (dateFrom, dateTo) => {
  const from = dateFrom ? DateTime.fromISO(String(dateFrom), { zone: ZONE }) : null;
  const to = dateTo ? DateTime.fromISO(String(dateTo), { zone: ZONE }) : null;
  const range = {};
  if (from?.isValid) range.gte = from.startOf("day").toJSDate();
  if (to?.isValid) range.lt = to.plus({ days: 1 }).startOf("day").toJSDate();
  return Object.keys(range).length > 0 ? range : null;
};

// Суммы (зарплата) по сотрудникам видны только в пределах доступа пользователя —
// так же, как в списке сотрудников: по филиалу/отделу.
const buildAccess = async (userId) => {
  const user = await UserModel.getById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");
  return buildEmployeeAccess(user);
};

// Права логина в меню «Производство» (см. getProductionAccess): доступные типы операций
// (пусто — все) и «только свои» — тогда в отчётах лишь то, что принял сам логин
// (scanned_by). limited — хоть одно из ограничений включено.
const buildScope = async (userId) => {
  const { operationTypeIds, ownOnly } = await getProductionAccess(userId);
  return {
    operationTypeIds,
    ownOnly,
    userId: Number(userId),
    limited: ownOnly || operationTypeIds.length > 0,
  };
};

// Условие по типу операции: выбранная в фильтре, но не шире доступных логину.
const operationCondition = (requestedId, scope) => {
  if (scope.operationTypeIds.length === 0) return requestedId ?? undefined;
  if (!requestedId) return { in: scope.operationTypeIds };
  return scope.operationTypeIds.includes(requestedId) ? requestedId : { in: [] };
};

// Кладёт в where стикеров права логина: тип операции и, если включено «только свои», принявший.
const applyScope = (where, scope, requestedOperationId) => {
  const operation = operationCondition(requestedOperationId, scope);
  if (operation !== undefined) where.operation_type_id = operation;
  if (scope.ownOnly) where.scanned_by = scope.userId;
};

const formatEmployee = (employee) =>
  employee
    ? {
        label: employeeFullName(employee),
        employeeNumber: employee.employee_number || null,
        employeePhoto: employee.photo || null,
        employee_status: employee.status ?? null,
        branchName: employee.branch?.name || null,
        departmentName: employee.department?.name || null,
        positionName: employee.position?.name || null,
      }
    : { label: "—" };

const employeeSearchOr = (search) => {
  const numericId = toInt(search);
  return [
    { first_name: { contains: search, mode: "insensitive" } },
    { last_name: { contains: search, mode: "insensitive" } },
    { middle_name: { contains: search, mode: "insensitive" } },
    { employee_number: { contains: search, mode: "insensitive" } },
    ...(numericId ? [{ id: numericId }] : []),
  ];
};

const batchSearchOr = (search) => [
  { batch_number: { contains: search, mode: "insensitive" } },
  { document_number: { contains: search, mode: "insensitive" } },
  { customer: { contains: search, mode: "insensitive" } },
  { order_number: { contains: search, mode: "insensitive" } },
];

const byOperationOrder = (operationOrder) => (a, b) =>
  (operationOrder.get(a.operation_type_id) ?? 0) - (operationOrder.get(b.operation_type_id) ?? 0);

const emptyBatchTotals = () => ({
  received_qty: 0,
  distributed_qty: 0,
  pending_qty: 0,
  done_qty: 0,
  finished_qty: 0,
  scrap_qty: 0,
  rework_qty: 0,
  amount: 0,
  deduction: 0,
  stickers_done: 0,
  stickers_pending: 0,
});

const emptyOperation = () => ({
  distributed_qty: 0,
  stickers_done: 0,
  stickers_pending: 0,
  done_qty: 0,
  pending_qty: 0,
  scrap_qty: 0,
  rework_qty: 0,
  amount: 0,
  deduction: 0,
  arrived_at: null,
  last_scanned_at: null,
  employees: new Map(),
});

const earlier = (a, b) => (a && b ? (a < b ? a : b) : a || b);
const later = (a, b) => (a && b ? (a > b ? a : b) : a || b);

// Операция позиции завершена, когда принято всё напечатанное и распределение (если по ней
// печатали на «Распределении работы») покрыло всё количество позиции — иначе ещё
// напечатают. Дата завершения — последний приём.
const operationFinishedAt = (operation, receivedQty) => {
  const distributed = round(operation.distributed_qty, 4);
  const distributedAll = distributed === 0 || distributed >= round(receivedQty, 4);
  return operation.stickers_pending === 0 && operation.stickers_done > 0 && distributedAll
    ? operation.last_scanned_at
    : null;
};

const STICKER_STATUSES = ["pending", "done", "scrapped"];

// Правка цены: не больше стикеров за раз (как максимум страницы отчёта) и пределы колонок
// rate/amount — Decimal(15, 2)
const MAX_RATE_EDIT_STICKERS = 1000;
const MAX_STICKER_RATE = 10000000;
const MAX_STICKER_AMOUNT = 9999999999999.99;

// Хронология не должна раздуваться: цепочка стикеров — по числу операций маршрута
const MAX_LINEAGE_DEPTH = 30;
const MAX_LINEAGE_NODES = 500;

// Аудит пишется после приёма, но той же секундой — так сопоставляем запись журнала
// с текущим состоянием стикера
const AUDIT_MATCH_MS = 30000;

const stickerSearchOr = (search) => [
  { sticker_code: { contains: search, mode: "insensitive" } },
  { operationType: { name: { contains: search, mode: "insensitive" } } },
  { batchReceiptItem: { receipt: { OR: batchSearchOr(search) } } },
  { employee: { OR: employeeSearchOr(search) } },
  // Работу могли выполнить несколько сотрудников — ищем и по их долям
  { shares: { some: { employee: { OR: employeeSearchOr(search) } } } },
];

const qty = (value) => round(num(value), 4);

// Сотрудник со своей долей: employee — запись из БД или снимок из журнала аудита
const worker = (employee, quantity, amount) => ({
  employee_id: employee?.id ?? null,
  ...formatEmployee(employee),
  qty: qty(quantity),
  amount: round(num(amount), 2),
});

// Основной сотрудник стикера и доли остальных, принятые вместе с ним
const workersOf = (data) =>
  data.employee
    ? [
        worker(data.employee, data.actual_quantity, data.amount),
        ...(data.shares || []).map((share) =>
          worker(share.employee, share.actual_quantity, share.amount),
        ),
      ]
    : [];

// Кого из сотрудников пользователь вправе видеть (доступ по филиалу/отделу)
const employeeVisibility = async (access, employeeIds) => {
  if (Object.keys(access).length === 0 || employeeIds.length === 0) return () => true;
  const visible = new Set(
    (await ProductionReportModel.findAccessibleEmployeeIds(access, employeeIds)).map(
      (employee) => employee.id,
    ),
  );
  return (id) => id == null || visible.has(id);
};

// Недоступные сотрудники — без ФИО и суммы; сумма записи — только по видимым долям
const applyVisibility = (entity, canSee) => {
  const workers = entity.workers.map((item) =>
    canSee(item.employee_id)
      ? item
      : { employee_id: null, label: "—", qty: item.qty, amount: null, hidden: true },
  );
  return {
    ...entity,
    workers,
    amount:
      workers.length > 0
        ? round(workers.reduce((sum, item) => sum + (item.amount ?? 0), 0), 2)
        : null,
  };
};

// Удержание за возврат на исправление: с сотрудников виновной операции удерживается цена
// операции, которую они сделали, за возвращённое количество — стикер исправления с origin
// (см. work_stickers.origin_sticker_id; только стикеры split_kind = rework, унаследованные
// цепочкой возврата стикеры не считаются). Возвращённое делится между основным сотрудником
// виновного стикера и его долями пропорционально выполненному, по ставке каждого; сверх
// выполненного виновным не удерживаем. Строка удержания ложится на ту же строку отчёта
// (сотрудник × позиция × операция), где начислена сама работа.
const buildDeductions = (returns) => {
  const left = new Map();
  const entries = [];

  for (const ret of returns) {
    const origin = ret.origin;
    if (!origin) continue;

    const workers = [
      { employee_id: origin.employee_id, quantity: num(origin.actual_quantity), rate: num(origin.rate) },
      ...origin.shares.map((share) => ({
        employee_id: share.employee_id,
        quantity: num(share.actual_quantity),
        rate: num(share.rate),
      })),
    ].filter((worker) => worker.employee_id && worker.quantity > 0);
    const total = workers.reduce((sum, worker) => sum + worker.quantity, 0);
    if (total <= 0) continue;

    const available = left.has(origin.id) ? left.get(origin.id) : total;
    const returned = Math.min(num(ret.planned_quantity), available);
    if (returned <= 0) continue;
    left.set(origin.id, available - returned);

    for (const worker of workers) {
      const quantity = (returned * worker.quantity) / total;
      entries.push({
        employee_id: worker.employee_id,
        batch_receipt_item_id: origin.batch_receipt_item_id,
        operation_type_id: origin.operation_type_id,
        amount: calcAmount({
          unit: origin.operationType?.unit,
          size: origin.batchReceiptItem?.size,
          quantity,
          rate: worker.rate,
        }),
      });
    }
  }
  return entries;
};

// Удержания по принятой работе виновника, подходящей под originWhere; employeeWhere —
// доступ и поиск по сотрудникам (пусто — все), как у самих строк отчёта.
const loadDeductions = async (originWhere, employeeWhere = {}) => {
  const entries = buildDeductions(await ProductionReportModel.findReworkReturns(originWhere));
  if (entries.length === 0 || Object.keys(employeeWhere).length === 0) return entries;

  const ids = [...new Set(entries.map((entry) => entry.employee_id))];
  const allowed = new Set(
    (await ProductionReportModel.findAccessibleEmployeeIds(employeeWhere, ids)).map((employee) => employee.id),
  );
  return entries.filter((entry) => allowed.has(entry.employee_id));
};

const workerIds = (entities) =>
  entities.flatMap((entity) => entity.workers.map((item) => item.employee_id).filter(Boolean));

// Строка отчёта по стикерам; workers — ещё без учёта доступа (см. applyVisibility)
const stickerRow = (sticker) => {
  const receipt = sticker.batchReceiptItem?.receipt;
  const workers = workersOf(sticker);
  return {
    key: `sticker-${sticker.id}`,
    id: sticker.id,
    sticker_code: sticker.sticker_code,
    status: sticker.status,
    split_kind: sticker.split_kind,
    operation_type_id: sticker.operation_type_id,
    operation_name: sticker.operationType?.name || `#${sticker.operation_type_id}`,
    batch_number: receipt?.batch_number || null,
    customer: receipt?.customer || null,
    product_name: sticker.batchReceiptItem?.product_name || null,
    size: sticker.batchReceiptItem?.size || null,
    planned_qty: qty(sticker.planned_quantity),
    actual_qty: round(workers.reduce((sum, item) => sum + item.qty, 0), 4),
    defect_qty: qty(sticker.defect_quantity),
    rework_qty: qty(sticker.rework_quantity),
    incomplete_qty: qty(sticker.incomplete_quantity),
    rate: sticker.rate === null ? null : round(num(sticker.rate), 2),
    comment: sticker.comment,
    added_at: sticker.added_at,
    added_by: userDisplayName(sticker.addedBy),
    scanned_at: sticker.scanned_at,
    scanned_by: userDisplayName(sticker.scannedBy),
    workers,
    parent: sticker.parent
      ? {
          id: sticker.parent.id,
          sticker_code: sticker.parent.sticker_code,
          operation_name: sticker.parent.operationType?.name || null,
        }
      : null,
    children_count: sticker._count.children,
  };
};

// Дочерний стикер (из живой строки, снимка advanced_to или удалённой записи аудита)
const childSummary = (child) => ({
  id: child.id,
  sticker_code: child.sticker_code,
  operation_name: child.operationType?.name || null,
  split_kind: child.split_kind,
  status: child.status,
  planned_qty: qty(child.planned_quantity),
});

const stickerEvent = (type, at, user, details = {}) => ({ type, at, user: user || null, ...details });

// Что было принято (или отменено) — по снимку стикера из журнала аудита
const snapshotDetails = (data) => ({
  workers: workersOf(data),
  defect_qty: qty(data.defect_quantity),
  rework_qty: qty(data.rework_quantity),
  incomplete_qty: qty(data.incomplete_quantity),
  rate: data.rate == null ? null : round(num(data.rate), 2),
  comment: data.comment ?? null,
});

const rateOf = (data) => (data?.rate == null ? null : round(num(data.rate), 2));

// Журнал стикера: печать — из самой строки, остальное — из аудита (приёмов и возвратов
// может быть несколько, а в строке остаётся только последний приём).
const stickerEvents = (sticker, row, logs) => {
  const events = [
    stickerEvent("created", sticker.added_at, row.added_by, {
      planned_qty: row.planned_qty,
      rate: row.rate,
      split_kind: row.split_kind,
      parent: row.parent,
    }),
  ];

  for (const log of logs) {
    if (log.action === "update" && log.record_id === sticker.id) {
      const before = log.old_data || {};
      const after = log.new_data || {};
      const user = userDisplayName(log.user);

      if (Array.isArray(after.advanced_to)) {
        events.push(
          stickerEvent("advanced", log.added_at, user, {
            children: after.advanced_to.map(childSummary),
          }),
        );
      } else if (before.status === "pending" && after.status === "done") {
        events.push(stickerEvent("accepted", log.added_at, user, snapshotDetails(after)));
      } else if (before.status === "done" && after.status === "pending") {
        events.push(stickerEvent("returned", log.added_at, user, snapshotDetails(before)));
      } else if ("rate" in after && rateOf(before) !== rateOf(after)) {
        // Правка цены в отчёте: суммы не показываем — они у сотрудников, которых
        // пользователь может не видеть; текущая сумма уже есть в карточке стикера
        events.push(
          stickerEvent("rate_changed", log.added_at, user, {
            old_rate: rateOf(before),
            rate: rateOf(after),
          }),
        );
      } else {
        events.push(stickerEvent("updated", log.added_at, user));
      }
    } else if (log.action === "delete" && log.old_data?.parent_sticker_id === sticker.id) {
      events.push(
        stickerEvent("child_deleted", log.added_at, userDisplayName(log.user), {
          child: childSummary(log.old_data),
        }),
      );
    }
  }

  // Приём, которого нет в аудите (запись не сохранилась) — берём из самой строки
  if (sticker.status === "done" && sticker.scanned_at) {
    const scannedAt = sticker.scanned_at.getTime();
    const logged = events.some(
      (event) =>
        event.type === "accepted" && Math.abs(event.at.getTime() - scannedAt) < AUDIT_MATCH_MS,
    );
    if (!logged) {
      events.push(
        stickerEvent("accepted", sticker.scanned_at, row.scanned_by, {
          workers: row.workers,
          defect_qty: row.defect_qty,
          rework_qty: row.rework_qty,
          rate: row.rate,
          comment: row.comment,
        }),
      );
    }
  }

  return events.sort((a, b) => a.at - b.at);
};

export const ProductionReportService = {
  // Строки отчёта по партиям (с employee_ids — для отчёта по заказам). Период — по дате
  // прихода партии: зарплата и выпуск считаются за всё время жизни партии, а не за окно
  // приёма работы.
  getBatchRows: async ({ userId, filters = {} }) => {
    const access = await buildAccess(userId);
    const scope = await buildScope(userId);
    const restricted = Object.keys(access).length > 0;

    const batchWhere = {};
    const from = parseDate(filters.date_from);
    const to = parseDate(filters.date_to);
    if (from || to) {
      batchWhere.receipt_date = { ...(from && { gte: from }), ...(to && { lte: to }) };
    }
    const search = typeof filters.search === "string" ? filters.search.trim() : "";
    if (search) {
      batchWhere.OR = batchSearchOr(search);
    }

    const batches = await ProductionReportModel.findBatches(batchWhere);
    if (batches.length === 0) {
      return { data: [], totals: { ...emptyBatchTotals(), employees_count: 0 } };
    }

    const itemToBatch = new Map();
    for (const batch of batches) {
      for (const item of batch.items) itemToBatch.set(item.id, batch.id);
    }
    const itemIds = [...itemToBatch.keys()];

    const operationTypeId = toInt(filters.operation_type_id);

    // Ограничение доступа: pending/брак без сотрудника видны всем, а принятая
    // работа — только по доступным пользователю сотрудникам.
    const stickerWhere = { batch_receipt_item_id: { in: itemIds } };
    applyScope(stickerWhere, scope, operationTypeId);
    if (restricted) stickerWhere.OR = [{ employee_id: null }, { employee: access }];

    const [stickerRows, operationTypes] = await Promise.all([
      ProductionReportModel.groupStickers({
        where: stickerWhere,
        by: ["batch_receipt_item_id", "operation_type_id", "employee_id", "status", "split_kind"],
      }),
      ProductionReportModel.findOperationTypes(),
    ]);

    // «Выполнено» партии — только годное последней операции (is_final): иначе одна штука
    // считалась бы на каждой операции маршрута. Нет флага ни у одной операции — 0.
    const finalOperationIds = new Set(
      operationTypes.filter((type) => type.is_final).map((type) => type.id),
    );

    const accByBatch = new Map(
      batches.map((batch) => [
        batch.id,
        {
          ...emptyBatchTotals(),
          received_qty: batch.items.reduce((sum, item) => sum + num(item.quantity), 0),
          employees: new Map(),
          // Позиция партии → операции → сотрудники; итоги позиции считаются так же, как у партии
          items: new Map(
            batch.items.map((item) => [
              item.id,
              {
                ...emptyBatchTotals(),
                received_qty: num(item.quantity),
                operations: new Map(),
                employees: new Set(),
              },
            ]),
          ),
        },
      ]),
    );

    for (const row of stickerRows) {
      const acc = accByBatch.get(itemToBatch.get(row.batch_receipt_item_id));
      const itemAcc = acc?.items.get(row.batch_receipt_item_id);
      if (!itemAcc) continue;

      const count = row._count._all;
      const planned = num(row._sum.planned_quantity);
      const actual = num(row._sum.actual_quantity);
      const amount = num(row._sum.amount);

      // Итог кладём и в партию, и в её позицию
      const targets = [acc, itemAcc];
      const bump = (field, value) => targets.forEach((target) => (target[field] += value));

      if (!itemAcc.operations.has(row.operation_type_id)) {
        itemAcc.operations.set(row.operation_type_id, emptyOperation());
      }
      const operation = itemAcc.operations.get(row.operation_type_id);

      operation.arrived_at = earlier(operation.arrived_at, row._min.added_at);
      if (row.status === "done") {
        operation.last_scanned_at = later(operation.last_scanned_at, row._max.scanned_at);
      }

      // split_kind = null только у стикеров, напечатанных на «Распределении работы»;
      // дочерние (после скана) всегда несут normal/rework/scrap
      if (row.split_kind === null) {
        bump("distributed_qty", planned);
        operation.distributed_qty += planned;
      }
      if (row.split_kind === "rework") {
        bump("rework_qty", planned);
        operation.rework_qty += planned;
      }

      if (row.status === "pending") {
        bump("pending_qty", planned);
        bump("stickers_pending", count);
        operation.pending_qty += planned;
        operation.stickers_pending += count;
      } else if (row.status === "done") {
        bump("done_qty", actual);
        bump("amount", amount);
        bump("stickers_done", count);
        operation.done_qty += actual;
        operation.amount += amount;
        operation.stickers_done += count;

        if (finalOperationIds.has(row.operation_type_id)) bump("finished_qty", actual);

        // Брак, указанный при приёме принятого стикера (actual — только годное).
        const defect = num(row._sum.defect_quantity);
        bump("scrap_qty", defect);
        operation.scrap_qty += defect;

        if (row.employee_id) {
          itemAcc.employees.add(row.employee_id);

          if (!acc.employees.has(row.employee_id)) {
            acc.employees.set(row.employee_id, {
              stickers: 0,
              qty: 0,
              amount: 0,
              operations: new Set(),
            });
          }
          const employee = acc.employees.get(row.employee_id);
          employee.stickers += count;
          employee.qty += actual;
          employee.amount += amount;
          employee.operations.add(row.operation_type_id);

          if (!operation.employees.has(row.employee_id)) {
            operation.employees.set(row.employee_id, { stickers: 0, qty: 0, amount: 0, deduction: 0 });
          }
          const operationEmployee = operation.employees.get(row.employee_id);
          operationEmployee.stickers += count;
          operationEmployee.qty += actual;
          operationEmployee.amount += amount;
        }
      } else if (row.status === "scrapped") {
        bump("scrap_qty", actual);
        operation.scrap_qty += actual;
      }
    }

    // Возвраты на исправление: с виновных удерживается цена их операции (см. buildDeductions).
    // Условие — то же, что у самих стикеров отчёта, поэтому строка сотрудника уже есть.
    const deductions = await loadDeductions({ ...stickerWhere, status: "done" }, restricted ? access : {});
    for (const entry of deductions) {
      const batchAcc = accByBatch.get(itemToBatch.get(entry.batch_receipt_item_id));
      const itemAcc = batchAcc?.items.get(entry.batch_receipt_item_id);
      const operation = itemAcc?.operations.get(entry.operation_type_id);
      const operationEmployee = operation?.employees.get(entry.employee_id);
      if (!operationEmployee) continue;

      for (const target of [batchAcc, itemAcc, operation, operationEmployee]) {
        target.amount -= entry.amount;
        target.deduction += entry.amount;
      }
    }

    const employeeIds = new Set();
    for (const acc of accByBatch.values()) {
      for (const id of acc.employees.keys()) employeeIds.add(id);
    }
    const employeeById = new Map(
      (employeeIds.size > 0
        ? await ProductionReportModel.findEmployees([...employeeIds])
        : []
      ).map((employee) => [employee.id, employee]),
    );

    const operationName = new Map(operationTypes.map((type) => [type.id, type.name]));
    const operationOrder = new Map(operationTypes.map((type, index) => [type.id, index]));
    const totals = emptyBatchTotals();
    const totalEmployees = new Set();

    // Логин с ограничением («доступные операции» / «только свои») видит только партии,
    // в которых есть его стикеры, — иначе весь список был бы строками из нулей.
    const touchedBatches = new Set(stickerRows.map((row) => itemToBatch.get(row.batch_receipt_item_id)));
    const visibleBatches = scope.limited ? batches.filter((batch) => touchedBatches.has(batch.id)) : batches;

    const data = visibleBatches.map((batch) => {
      const acc = accByBatch.get(batch.id);
      const finished = Math.max(acc.finished_qty, 0);

      for (const key of Object.keys(totals)) {
        totals[key] += key === "finished_qty" ? finished : acc[key];
      }
      for (const id of acc.employees.keys()) totalEmployees.add(id);

      return {
        key: `batch-${batch.id}`,
        batch_id: batch.id,
        batch_number: batch.batch_number,
        document_number: batch.document_number,
        receipt_date: batch.receipt_date.toISOString().slice(0, 10),
        order_number: batch.order_number,
        customer: batch.customer,
        status: batch.status,
        received_qty: round(acc.received_qty, 4),
        distributed_qty: round(acc.distributed_qty, 4),
        pending_qty: round(acc.pending_qty, 4),
        done_qty: round(acc.done_qty, 4),
        finished_qty: round(finished, 4),
        scrap_qty: round(acc.scrap_qty, 4),
        rework_qty: round(acc.rework_qty, 4),
        progress: acc.received_qty > 0 ? round((finished / acc.received_qty) * 100, 1) : 0,
        amount: round(acc.amount, 2),
        deduction: round(acc.deduction, 2),
        stickers_done: acc.stickers_done,
        stickers_pending: acc.stickers_pending,
        employees_count: acc.employees.size,
        employee_ids: [...acc.employees.keys()],
        // Позиции партии; логину с ограничением — только те, где есть его стикеры.
        // Готовность позиции — выпуск последней операции от её количества, готовность
        // операции — принятое по ней от количества позиции.
        items: [...batch.items]
          .filter((item) => !scope.limited || acc.items.get(item.id).operations.size > 0)
          .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
          .map((item) => {
            const itemAcc = acc.items.get(item.id);
            const itemFinished = Math.max(itemAcc.finished_qty, 0);
            const itemProgress = (done) =>
              itemAcc.received_qty > 0 ? round((done / itemAcc.received_qty) * 100, 1) : 0;

            return {
              key: `item-${item.id}`,
              item_id: item.id,
              product_name: item.product_name,
              size: item.size,
              color: item.color,
              color_variant: item.color_variant,
              color_tone: item.color_tone,
              yarn_type: item.yarn_type,
              material: item.material,
              design: item.design,
              received_qty: round(itemAcc.received_qty, 4),
              distributed_qty: round(itemAcc.distributed_qty, 4),
              pending_qty: round(itemAcc.pending_qty, 4),
              finished_qty: round(itemFinished, 4),
              scrap_qty: round(itemAcc.scrap_qty, 4),
              rework_qty: round(itemAcc.rework_qty, 4),
              progress: itemProgress(itemFinished),
              amount: round(itemAcc.amount, 2),
              deduction: round(itemAcc.deduction, 2),
              stickers_done: itemAcc.stickers_done,
              employees_count: itemAcc.employees.size,
              operations: [...itemAcc.operations.entries()]
                .map(([operation_type_id, op]) => ({
                  operation_type_id,
                  name: operationName.get(operation_type_id) || `#${operation_type_id}`,
                  distributed_qty: round(op.distributed_qty, 4),
                  stickers_done: op.stickers_done,
                  stickers_pending: op.stickers_pending,
                  done_qty: round(op.done_qty, 4),
                  pending_qty: round(op.pending_qty, 4),
                  scrap_qty: round(op.scrap_qty, 4),
                  rework_qty: round(op.rework_qty, 4),
                  progress: itemProgress(op.done_qty),
                  amount: round(op.amount, 2),
                  deduction: round(op.deduction, 2),
                  arrived_at: op.arrived_at,
                  finished_at: operationFinishedAt(op, itemAcc.received_qty),
                  employees_count: op.employees.size,
                  employees: [...op.employees.entries()]
                    .map(([employee_id, entry]) => ({
                      employee_id,
                      ...formatEmployee(employeeById.get(employee_id)),
                      stickers: entry.stickers,
                      qty: round(entry.qty, 4),
                      amount: round(entry.amount, 2),
                      deduction: round(entry.deduction, 2),
                    }))
                    .sort((a, b) => b.amount - a.amount),
                }))
                .sort(byOperationOrder(operationOrder)),
            };
          }),
      };
    });

    return {
      data,
      totals: {
        received_qty: round(totals.received_qty, 4),
        distributed_qty: round(totals.distributed_qty, 4),
        pending_qty: round(totals.pending_qty, 4),
        done_qty: round(totals.done_qty, 4),
        finished_qty: round(totals.finished_qty, 4),
        scrap_qty: round(totals.scrap_qty, 4),
        rework_qty: round(totals.rework_qty, 4),
        amount: round(totals.amount, 2),
        deduction: round(totals.deduction, 2),
        stickers_done: totals.stickers_done,
        stickers_pending: totals.stickers_pending,
        employees_count: totalEmployees.size,
      },
    };
  },

  // Отчёт по партиям: партия → позиции → операции → сотрудники
  getByBatch: async (params) => {
    const { data, totals } = await ProductionReportService.getBatchRows(params);
    return { data: data.map(({ employee_ids, ...row }) => row), totals };
  },

  // Отчёт по сотрудникам. Период — по дате приёма работы (scanned_at): это
  // «зарплата за период» по сдельным стикерам.
  getByEmployee: async ({ userId, filters = {} }) => {
    const access = await buildAccess(userId);
    const scope = await buildScope(userId);

    const where = { status: "done", employee_id: { not: null } };

    const scanned = dayRange(filters.date_from, filters.date_to);
    if (scanned) where.scanned_at = scanned;

    applyScope(where, scope, toInt(filters.operation_type_id));

    const employeeWhere = { ...access };
    const search = typeof filters.search === "string" ? filters.search.trim() : "";
    if (search) employeeWhere.OR = employeeSearchOr(search);
    if (Object.keys(employeeWhere).length > 0) where.employee = employeeWhere;

    const [rows, operationTypes] = await Promise.all([
      ProductionReportModel.groupStickers({
        where,
        by: ["employee_id", "batch_receipt_item_id", "operation_type_id"],
      }),
      ProductionReportModel.findOperationTypes(),
    ]);

    if (rows.length === 0) {
      return {
        data: [],
        totals: {
          stickers: 0,
          qty: 0,
          amount: 0,
          defect_qty: 0,
          rework_qty: 0,
          employees_count: 0,
          batches_count: 0,
        },
      };
    }

    const itemIds = [...new Set(rows.map((row) => row.batch_receipt_item_id))];
    const employeeIds = [...new Set(rows.map((row) => row.employee_id))];
    const [items, employees] = await Promise.all([
      ProductionReportModel.findItemsWithBatch(itemIds),
      ProductionReportModel.findEmployees(employeeIds),
    ]);

    const batchByItem = new Map(items.map((item) => [item.id, item.receipt]));
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const operationName = new Map(operationTypes.map((type) => [type.id, type.name]));
    const operationOrder = new Map(operationTypes.map((type, index) => [type.id, index]));

    const accByEmployee = new Map();
    for (const row of rows) {
      const batch = batchByItem.get(row.batch_receipt_item_id);
      if (!batch) continue;

      if (!accByEmployee.has(row.employee_id)) {
        accByEmployee.set(row.employee_id, {
          stickers: 0,
          qty: 0,
          amount: 0,
          deduction: 0,
          defect_qty: 0,
          rework_qty: 0,
          batches: new Set(),
          operations: new Set(),
          details: new Map(),
        });
      }
      const acc = accByEmployee.get(row.employee_id);

      const count = row._count._all;
      const actual = num(row._sum.actual_quantity);
      const amount = num(row._sum.amount);
      const defect = num(row._sum.defect_quantity);
      const rework = num(row._sum.rework_quantity);

      acc.stickers += count;
      acc.qty += actual;
      acc.amount += amount;
      acc.defect_qty += defect;
      acc.rework_qty += rework;
      acc.batches.add(batch.id);
      acc.operations.add(row.operation_type_id);

      // Позиции одной партии схлопываем: в отчёте строка — партия × операция
      const detailKey = `${batch.id}:${row.operation_type_id}`;
      if (!acc.details.has(detailKey)) {
        acc.details.set(detailKey, {
          batch_id: batch.id,
          batch_number: batch.batch_number,
          document_number: batch.document_number,
          customer: batch.customer,
          operation_type_id: row.operation_type_id,
          name: operationName.get(row.operation_type_id) || `#${row.operation_type_id}`,
          stickers: 0,
          qty: 0,
          amount: 0,
          deduction: 0,
        });
      }
      const detail = acc.details.get(detailKey);
      detail.stickers += count;
      detail.qty += actual;
      detail.amount += amount;
    }

    // Возвраты на исправление: с виновных удерживается цена их операции (см. buildDeductions).
    // Период — по приёму работы виновника, как у самих строк; avg_rate ниже считается
    // от начисленного (до удержания), «Зарплата» = начислено − удержано.
    const originWhere = { status: "done" };
    if (scanned) originWhere.scanned_at = scanned;
    applyScope(originWhere, scope, toInt(filters.operation_type_id));
    const deductions = await loadDeductions(originWhere, employeeWhere);
    for (const entry of deductions) {
      const batch = batchByItem.get(entry.batch_receipt_item_id);
      const acc = accByEmployee.get(entry.employee_id);
      const detail = batch && acc?.details.get(`${batch.id}:${entry.operation_type_id}`);
      if (!detail) continue;

      acc.deduction += entry.amount;
      detail.deduction += entry.amount;
    }

    const totals = { stickers: 0, qty: 0, amount: 0, deduction: 0, defect_qty: 0, rework_qty: 0 };
    const totalBatches = new Set();

    const data = [...accByEmployee.entries()]
      .map(([employee_id, acc]) => {
        totals.stickers += acc.stickers;
        totals.qty += acc.qty;
        totals.amount += acc.amount - acc.deduction;
        totals.deduction += acc.deduction;
        totals.defect_qty += acc.defect_qty;
        totals.rework_qty += acc.rework_qty;
        for (const id of acc.batches) totalBatches.add(id);

        return {
          key: `employee-${employee_id}`,
          employee_id,
          ...formatEmployee(employeeById.get(employee_id)),
          stickers: acc.stickers,
          qty: round(acc.qty, 4),
          amount: round(acc.amount - acc.deduction, 2),
          deduction: round(acc.deduction, 2),
          defect_qty: round(acc.defect_qty, 4),
          rework_qty: round(acc.rework_qty, 4),
          avg_rate: acc.qty > 0 ? round(acc.amount / acc.qty, 2) : 0,
          batches_count: acc.batches.size,
          operations_count: acc.operations.size,
          details: [...acc.details.values()]
            .map((detail) => ({
              ...detail,
              qty: round(detail.qty, 4),
              amount: round(detail.amount - detail.deduction, 2),
              deduction: round(detail.deduction, 2),
              avg_rate: detail.qty > 0 ? round(detail.amount / detail.qty, 2) : 0,
            }))
            .sort(
              (a, b) =>
                a.batch_number.localeCompare(b.batch_number, "ru") ||
                byOperationOrder(operationOrder)(a, b),
            ),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "ru", { sensitivity: "base" }));

    return {
      data,
      totals: {
        stickers: totals.stickers,
        qty: round(totals.qty, 4),
        amount: round(totals.amount, 2),
        deduction: round(totals.deduction, 2),
        defect_qty: round(totals.defect_qty, 4),
        rework_qty: round(totals.rework_qty, 4),
        employees_count: data.length,
        batches_count: totalBatches.size,
      },
    };
  },

  // Отчёт по операциям. Период — по дате приёма работы (scanned_at), как у отчёта
  // по сотрудникам: выработка и зарплата по каждой операции за период.
  getByOperation: async ({ userId, filters = {} }) => {
    const access = await buildAccess(userId);
    const scope = await buildScope(userId);

    const where = { status: "done", employee_id: { not: null } };

    const scanned = dayRange(filters.date_from, filters.date_to);
    if (scanned) where.scanned_at = scanned;

    applyScope(where, scope, toInt(filters.operation_type_id));

    const search = typeof filters.search === "string" ? filters.search.trim() : "";
    if (search) where.operationType = { name: { contains: search, mode: "insensitive" } };

    if (Object.keys(access).length > 0) where.employee = access;

    const [rows, operationTypes] = await Promise.all([
      ProductionReportModel.groupStickers({
        where,
        by: ["operation_type_id", "employee_id", "batch_receipt_item_id"],
      }),
      ProductionReportModel.findOperationTypes(),
    ]);

    if (rows.length === 0) {
      return {
        data: [],
        totals: { stickers: 0, qty: 0, amount: 0, employees_count: 0, batches_count: 0 },
      };
    }

    const itemIds = [...new Set(rows.map((row) => row.batch_receipt_item_id))];
    const employeeIds = [...new Set(rows.map((row) => row.employee_id))];
    const [items, employees] = await Promise.all([
      ProductionReportModel.findItemsWithBatch(itemIds),
      ProductionReportModel.findEmployees(employeeIds),
    ]);

    const batchByItem = new Map(items.map((item) => [item.id, item.receipt]));
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const operationName = new Map(operationTypes.map((type) => [type.id, type.name]));
    const operationOrder = new Map(operationTypes.map((type, index) => [type.id, index]));

    const accByOperation = new Map();
    for (const row of rows) {
      const batch = batchByItem.get(row.batch_receipt_item_id);
      if (!batch) continue;

      if (!accByOperation.has(row.operation_type_id)) {
        accByOperation.set(row.operation_type_id, {
          stickers: 0,
          qty: 0,
          amount: 0,
          deduction: 0,
          batches: new Map(),
          employees: new Map(),
        });
      }
      const acc = accByOperation.get(row.operation_type_id);

      const count = row._count._all;
      const actual = num(row._sum.actual_quantity);
      const amount = num(row._sum.amount);

      acc.stickers += count;
      acc.qty += actual;
      acc.amount += amount;

      // Позиции одной партии схлопываем: в детализации строка — партия
      if (!acc.batches.has(batch.id)) {
        acc.batches.set(batch.id, {
          batch_id: batch.id,
          batch_number: batch.batch_number,
          document_number: batch.document_number,
          receipt_date: batch.receipt_date.toISOString().slice(0, 10),
          customer: batch.customer,
          stickers: 0,
          qty: 0,
          amount: 0,
          deduction: 0,
        });
      }
      const batchEntry = acc.batches.get(batch.id);
      batchEntry.stickers += count;
      batchEntry.qty += actual;
      batchEntry.amount += amount;

      if (!acc.employees.has(row.employee_id)) {
        acc.employees.set(row.employee_id, { stickers: 0, qty: 0, amount: 0, deduction: 0 });
      }
      const employeeEntry = acc.employees.get(row.employee_id);
      employeeEntry.stickers += count;
      employeeEntry.qty += actual;
      employeeEntry.amount += amount;
    }

    // Возвраты на исправление: с виновных удерживается цена их операции (см. buildDeductions).
    // avg_rate ниже считается от начисленного, «Зарплата» = начислено − удержано.
    const originWhere = { status: "done" };
    if (scanned) originWhere.scanned_at = scanned;
    applyScope(originWhere, scope, toInt(filters.operation_type_id));
    if (search) originWhere.operationType = { name: { contains: search, mode: "insensitive" } };
    const deductions = await loadDeductions(originWhere, access);
    for (const entry of deductions) {
      const batch = batchByItem.get(entry.batch_receipt_item_id);
      const acc = accByOperation.get(entry.operation_type_id);
      const batchEntry = batch && acc?.batches.get(batch.id);
      const employeeEntry = acc?.employees.get(entry.employee_id);
      if (!batchEntry || !employeeEntry) continue;

      acc.deduction += entry.amount;
      batchEntry.deduction += entry.amount;
      employeeEntry.deduction += entry.amount;
    }

    const totals = { stickers: 0, qty: 0, amount: 0, deduction: 0 };
    const totalBatches = new Set();
    const totalEmployees = new Set();

    const data = [...accByOperation.entries()]
      .map(([operation_type_id, acc]) => {
        totals.stickers += acc.stickers;
        totals.qty += acc.qty;
        totals.amount += acc.amount - acc.deduction;
        totals.deduction += acc.deduction;
        for (const id of acc.batches.keys()) totalBatches.add(id);
        for (const id of acc.employees.keys()) totalEmployees.add(id);

        return {
          key: `operation-${operation_type_id}`,
          operation_type_id,
          name: operationName.get(operation_type_id) || `#${operation_type_id}`,
          stickers: acc.stickers,
          qty: round(acc.qty, 4),
          amount: round(acc.amount - acc.deduction, 2),
          deduction: round(acc.deduction, 2),
          avg_rate: acc.qty > 0 ? round(acc.amount / acc.qty, 2) : 0,
          batches_count: acc.batches.size,
          employees_count: acc.employees.size,
          batches: [...acc.batches.values()]
            .map((entry) => ({
              ...entry,
              qty: round(entry.qty, 4),
              amount: round(entry.amount - entry.deduction, 2),
              deduction: round(entry.deduction, 2),
            }))
            .sort((a, b) => a.batch_number.localeCompare(b.batch_number, "ru")),
          employees: [...acc.employees.entries()]
            .map(([employee_id, entry]) => ({
              employee_id,
              ...formatEmployee(employeeById.get(employee_id)),
              stickers: entry.stickers,
              qty: round(entry.qty, 4),
              amount: round(entry.amount - entry.deduction, 2),
              deduction: round(entry.deduction, 2),
            }))
            .sort((a, b) => b.amount - a.amount),
        };
      })
      .sort(byOperationOrder(operationOrder));

    return {
      data,
      totals: {
        stickers: totals.stickers,
        qty: round(totals.qty, 4),
        amount: round(totals.amount, 2),
        deduction: round(totals.deduction, 2),
        employees_count: totalEmployees.size,
        batches_count: totalBatches.size,
      },
    };
  },

  // Отчёт по заказам — то же, что по партиям, но партии сгруппированы по номеру заказа
  // (batch_receipts.order_number; партии без номера — одна группа с order_number = null):
  // заказ → партии → позиции → операции → сотрудники. Период, поиск и фильтр операции —
  // как в отчёте по партиям.
  getByOrder: async (params) => {
    const { data: batches, totals } = await ProductionReportService.getBatchRows(params);

    const groups = new Map();
    for (const batch of batches) {
      const orderNumber = batch.order_number?.trim() || null;
      if (!groups.has(orderNumber)) {
        groups.set(orderNumber, {
          ...emptyBatchTotals(),
          customers: new Set(),
          employees: new Set(),
          batches: [],
        });
      }
      const group = groups.get(orderNumber);

      for (const key of Object.keys(emptyBatchTotals())) group[key] += batch[key];
      if (batch.customer) group.customers.add(batch.customer);
      for (const id of batch.employee_ids) group.employees.add(id);
      group.batches.push(batch);
    }

    const data = [...groups.entries()]
      .map(([order_number, group]) => ({
        key: `order-${order_number ?? "none"}`,
        order_number,
        customers: [...group.customers].sort((a, b) => a.localeCompare(b, "ru")),
        batches_count: group.batches.length,
        employees_count: group.employees.size,
        received_qty: round(group.received_qty, 4),
        distributed_qty: round(group.distributed_qty, 4),
        pending_qty: round(group.pending_qty, 4),
        done_qty: round(group.done_qty, 4),
        finished_qty: round(group.finished_qty, 4),
        scrap_qty: round(group.scrap_qty, 4),
        rework_qty: round(group.rework_qty, 4),
        progress:
          group.received_qty > 0 ? round((group.finished_qty / group.received_qty) * 100, 1) : 0,
        amount: round(group.amount, 2),
        deduction: round(group.deduction, 2),
        stickers_done: group.stickers_done,
        stickers_pending: group.stickers_pending,
        // Партии уже отсортированы: по дате прихода, новые сверху
        batches: group.batches.map(({ employee_ids, ...batch }) => batch),
      }))
      // Заказы по номеру (естественный порядок), «без заказа» — в конце
      .sort((a, b) => {
        if (a.order_number === null) return 1;
        if (b.order_number === null) return -1;
        return a.order_number.localeCompare(b.order_number, "ru", { numeric: true });
      });

    return { data, totals: { ...totals, batches_count: batches.length } };
  },

  // Мониторинг: по элементу на операцию (все операции, в т.ч. без движения за период) —
  // сколько работы (количество) пришло, сколько в процессе, сколько завершено.
  // «Пришло» — стикеры, напечатанные на операцию за период (added_at);
  // «Завершено» — принятые за период (scanned_at), с долями остальных сотрудников;
  // «В процессе» — ещё не принятые стикеры, напечатанные не позже конца периода (на текущий момент).
  getMonitoring: async ({ userId, filters = {} }) => {
    const access = await buildAccess(userId);
    const scope = await buildScope(userId);
    const operationTypeId = toInt(filters.operation_type_id);
    const period = dayRange(filters.date_from, filters.date_to);

    // Как в отчёте по партиям: стикеры без сотрудника видны всем, принятые — по доступу.
    // Доли других сотрудников — часть основного стикера, в счёт стикеров не идут.
    const stickerWhere = ({ withShares = false, ...extra }) => {
      const where = { ...(!withShares && { share_of_id: null }), ...extra };
      applyScope(where, scope, operationTypeId);
      if (Object.keys(access).length > 0) where.OR = [{ employee_id: null }, { employee: access }];
      return where;
    };

    const [arrivedRows, pendingRows, doneRows, operationTypes] = await Promise.all([
      ProductionReportModel.groupStickers({
        where: stickerWhere({
          status: { in: ["pending", "done"] },
          ...(period && { added_at: period }),
        }),
        by: ["operation_type_id", "batch_receipt_item_id"],
      }),
      ProductionReportModel.groupStickers({
        where: stickerWhere({
          status: "pending",
          ...(period?.lt && { added_at: { lt: period.lt } }),
        }),
        by: ["operation_type_id", "batch_receipt_item_id"],
      }),
      ProductionReportModel.groupStickers({
        where: stickerWhere({
          withShares: true,
          status: "done",
          ...(period && { scanned_at: period }),
        }),
        by: ["operation_type_id", "batch_receipt_item_id"],
      }),
      ProductionReportModel.findOperationTypes(),
    ]);

    // Партия (и её заказ) каждой позиции — карточка операции показывает, из каких партий
    // и заказов сложились её цифры
    const itemIds = [
      ...new Set([...arrivedRows, ...pendingRows, ...doneRows].map((row) => row.batch_receipt_item_id)),
    ];
    const items = itemIds.length > 0 ? await ProductionReportModel.findItemsWithBatch(itemIds) : [];
    const batchByItem = new Map(items.map((item) => [item.id, item.receipt]));

    const acc = new Map();
    const entry = (id) => {
      if (!acc.has(id)) acc.set(id, { arrived_qty: 0, pending_qty: 0, done_qty: 0, batches: new Map() });
      return acc.get(id);
    };

    // Итог операции + разбивка по партиям (позиции одной партии схлопываются)
    const bump = (row, field, value) => {
      const operation = entry(row.operation_type_id);
      operation[field] += value;

      const batch = batchByItem.get(row.batch_receipt_item_id);
      if (!batch) return;
      if (!operation.batches.has(batch.id)) {
        operation.batches.set(batch.id, {
          batch_id: batch.id,
          batch_number: batch.batch_number,
          order_number: batch.order_number?.trim() || null,
          arrived_qty: 0,
          pending_qty: 0,
          done_qty: 0,
        });
      }
      operation.batches.get(batch.id)[field] += value;
    };

    for (const row of arrivedRows) bump(row, "arrived_qty", num(row._sum.planned_quantity));
    for (const row of pendingRows) bump(row, "pending_qty", num(row._sum.planned_quantity));
    for (const row of doneRows) bump(row, "done_qty", num(row._sum.actual_quantity));

    const search = typeof filters.search === "string" ? filters.search.trim().toLowerCase() : "";
    const totals = { arrived_qty: 0, pending_qty: 0, done_qty: 0 };

    const data = operationTypes
      .filter((type) => {
        if (scope.operationTypeIds.length > 0 && !scope.operationTypeIds.includes(type.id)) {
          return false;
        }
        if (operationTypeId && type.id !== operationTypeId) return false;
        if (search && !type.name.toLowerCase().includes(search)) return false;
        // Выключенная операция — только если по ней было движение
        return type.is_active || acc.has(type.id);
      })
      .map((type) => {
        const item = entry(type.id);
        for (const key of Object.keys(totals)) totals[key] += item[key];
        return {
          key: `operation-${type.id}`,
          operation_type_id: type.id,
          name: type.name,
          arrived_qty: qty(item.arrived_qty),
          pending_qty: qty(item.pending_qty),
          done_qty: qty(item.done_qty),
          batches: [...item.batches.values()]
            .map((batch) => ({
              ...batch,
              arrived_qty: qty(batch.arrived_qty),
              pending_qty: qty(batch.pending_qty),
              done_qty: qty(batch.done_qty),
            }))
            .filter((batch) => batch.arrived_qty || batch.pending_qty || batch.done_qty)
            .sort((a, b) => a.batch_number.localeCompare(b.batch_number, "ru", { numeric: true })),
        };
      });

    return {
      data,
      totals: {
        arrived_qty: qty(totals.arrived_qty),
        pending_qty: qty(totals.pending_qty),
        done_qty: qty(totals.done_qty),
      },
    };
  },

  // Отчёт по стикерам: по строке на стикер (в т.ч. ещё не принятые и брак), с постраничной
  // выдачей — стикеров тысячи. Период — по дате печати (added_at): у не принятого стикера
  // даты приёма ещё нет. Хронология конкретного стикера — getStickerChronology.
  getStickers: async ({ userId, filters = {}, page, pageSize }) => {
    const access = await buildAccess(userId);
    const scope = await buildScope(userId);
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 1000);

    // Доли других сотрудников — часть приёма основного стикера: приходят в его workers
    const where = { share_of_id: null };

    const printed = dayRange(filters.date_from, filters.date_to);
    if (printed) where.added_at = printed;

    applyScope(where, scope, toInt(filters.operation_type_id));

    if (STICKER_STATUSES.includes(filters.status)) where.status = filters.status;

    // Размер/дизайн/материал/граммаж — точные значения позиции партии (свободный текст,
    // варианты берёт с сервера — см. getStickerItemAttributes)
    const itemWhere = {};
    if (typeof filters.size === "string" && filters.size) itemWhere.size = filters.size;
    if (typeof filters.design === "string" && filters.design) itemWhere.design = filters.design;
    if (typeof filters.material === "string" && filters.material) itemWhere.material = filters.material;
    if (filters.grammage !== undefined && filters.grammage !== null && filters.grammage !== "") {
      const grammage = Number(filters.grammage);
      if (Number.isFinite(grammage)) itemWhere.grammage = grammage;
    }
    if (Object.keys(itemWhere).length > 0) where.batchReceiptItem = itemWhere;

    // Как в отчёте по партиям: стикеры без сотрудника видны всем, принятые — по доступу
    const and = [];
    if (Object.keys(access).length > 0) {
      and.push({ OR: [{ employee_id: null }, { employee: access }] });
    }
    const search = typeof filters.search === "string" ? filters.search.trim() : "";
    if (search) and.push({ OR: stickerSearchOr(search) });
    if (and.length > 0) where.AND = and;

    const [stickers, total, byStatus] = await Promise.all([
      ProductionReportModel.findStickers({ where, skip: (currentPage - 1) * limit, take: limit }),
      ProductionReportModel.countStickers(where),
      ProductionReportModel.countStickersByStatus(where),
    ]);

    const rows = stickers.map(stickerRow);
    const canSee = await employeeVisibility(access, workerIds(rows));
    const countOf = (status) => byStatus.find((entry) => entry.status === status)?._count._all ?? 0;

    return {
      data: rows.map((row) => applyVisibility(row, canSee)),
      totals: {
        stickers: total,
        pending: countOf("pending"),
        done: countOf("done"),
        scrapped: countOf("scrapped"),
      },
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  },

  // Значения размера/дизайна/материала/граммажа для фильтра «По стикерам» — только те,
  // что реально встречаются у позиций со стикерами (не весь справочник).
  getStickerItemAttributes: async () => {
    const { sizes, designs, materials, grammages } = await ProductionReportModel.findStickerItemAttributes();
    return { sizes, designs, materials, grammages: grammages.map((value) => round(num(value), 2)) };
  },

  // Правка цены принятых стикеров — одного или пачки: мастер исправляет ошибочную цену без
  // возврата стикера (возврат невозможен, если стикер уже роздан дальше). У стикера и у долей
  // других сотрудников меняются rate и amount; количества не трогаем. Правятся только принятые
  // основные стикеры в пределах доступа логина — остальные из ids пропускаются.
  updateStickerRates: async ({ userId, ids, rate }) => {
    await assertCanEditProductionReport(userId);

    const newRate = rate === "" || rate == null ? NaN : Number(rate);
    if (!Number.isFinite(newRate) || newRate < 0 || newRate > MAX_STICKER_RATE) {
      throw badRequest(`Укажите цену от 0 до ${MAX_STICKER_RATE}`);
    }
    const nextRate = round(newRate, 2);

    const stickerIds = [...new Set((Array.isArray(ids) ? ids : []).map(toInt).filter(Boolean))];
    if (stickerIds.length === 0) throw badRequest("Не выбраны стикеры");
    if (stickerIds.length > MAX_RATE_EDIT_STICKERS) {
      throw badRequest(`За раз можно изменить не больше ${MAX_RATE_EDIT_STICKERS} стикеров`);
    }

    const access = await buildAccess(userId);
    const scope = await buildScope(userId);
    const where = { id: { in: stickerIds }, share_of_id: null, status: "done" };
    applyScope(where, scope, undefined);
    if (Object.keys(access).length > 0) where.employee = access;

    const stickers = await ProductionReportModel.findStickersForRateEdit(where);

    const changed = [];
    for (const sticker of stickers) {
      const unit = sticker.operationType?.unit;
      const size = sticker.batchReceiptItem?.size;
      const rows = [sticker, ...sticker.shares].map((row) => ({
        id: row.id,
        rate: nextRate,
        amount: calcAmount({ unit, size, quantity: num(row.actual_quantity), rate: nextRate }),
        current: row,
      }));

      if (rows.some((row) => row.amount > MAX_STICKER_AMOUNT)) {
        throw badRequest(`Сумма стикера ${sticker.sticker_code} слишком велика для такой цены`);
      }

      const unchanged = rows.every(
        (row) =>
          row.current.rate !== null &&
          num(row.current.rate) === row.rate &&
          num(row.current.amount) === row.amount,
      );
      if (!unchanged) changed.push({ sticker, rows });
    }

    if (changed.length > 0) {
      await ProductionReportModel.updateStickerRates(
        changed.flatMap(({ rows }) => rows.map(({ id, rate: rowRate, amount }) => ({ id, rate: rowRate, amount }))),
      );

      // Итоги по стикеру вместе с долями — как в его строке отчёта
      const totalOf = (list) => round(list.reduce((sum, amount) => sum + amount, 0), 2);
      await createAuditLogs(
        changed.map(({ sticker, rows }) => ({
          userId,
          action: "update",
          entity: "work_stickers",
          recordId: sticker.id,
          oldData: {
            rate: sticker.rate === null ? null : round(num(sticker.rate), 2),
            amount: totalOf(rows.map((row) => num(row.current.amount))),
          },
          newData: { rate: nextRate, amount: totalOf(rows.map((row) => row.amount)) },
        })),
      );
    }

    return {
      requested: stickerIds.length,
      updated: changed.length,
      unchanged: stickers.length - changed.length,
      skipped: stickerIds.length - stickers.length,
    };
  },

  // Хронология стикера: цепочка предыдущих стикеров от первого до выбранного, сам стикер и всё,
  // что из него выросло (дочерние стикеры). У каждого — журнал: печать, приёмы, возвраты,
  // раздача дальше, удаление дочерних. Список плоский, по порядку обхода дерева, с depth.
  getStickerChronology: async ({ userId, stickerId }) => {
    const access = await buildAccess(userId);

    const id = toInt(stickerId);
    const [selected] = id ? await ProductionReportModel.findStickersByIds([id]) : [];
    if (!selected) {
      const err = new Error("Стикер не найден");
      err.statusCode = 404;
      throw err;
    }

    // Права логина: стикер чужой операции или (при «только свои») принятый не им не открываем.
    const scope = await buildScope(userId);
    const operationAllowed = (sticker) =>
      scope.operationTypeIds.length === 0 || scope.operationTypeIds.includes(sticker.operation_type_id);
    if (!operationAllowed(selected) || (scope.ownOnly && selected.scanned_by !== scope.userId)) {
      const err = new Error("Эта операция вам недоступна");
      err.statusCode = 403;
      throw err;
    }

    const ancestors = [];
    let cursor = selected;
    while (cursor.parent_sticker_id && ancestors.length < MAX_LINEAGE_DEPTH) {
      const [parent] = await ProductionReportModel.findStickersByIds([cursor.parent_sticker_id]);
      if (!parent) break;
      ancestors.unshift(parent);
      cursor = parent;
    }

    const childrenOf = new Map();
    let count = ancestors.length + 1;
    let frontier = [selected.id];
    for (let level = 0; frontier.length > 0 && level < MAX_LINEAGE_DEPTH; level++) {
      const children = (await ProductionReportModel.findStickerChildren(frontier)).slice(
        0,
        Math.max(MAX_LINEAGE_NODES - count, 0),
      );
      for (const child of children) {
        if (!childrenOf.has(child.parent_sticker_id)) childrenOf.set(child.parent_sticker_id, []);
        childrenOf.get(child.parent_sticker_id).push(child);
      }
      count += children.length;
      frontier = children.map((child) => child.id);
    }

    const ordered = [
      ...ancestors.map((sticker, depth) => ({ sticker, depth, relation: "ancestor" })),
      { sticker: selected, depth: ancestors.length, relation: "selected" },
    ];
    const walk = (parent, depth) => {
      for (const child of childrenOf.get(parent.id) || []) {
        ordered.push({ sticker: child, depth, relation: "descendant" });
        walk(child, depth + 1);
      }
    };
    walk(selected, ancestors.length + 1);

    const logs = await ProductionReportModel.findStickerAuditLogs(
      ordered.map((entry) => entry.sticker.id),
    );

    // Стикеры цепочки из недоступных логину операций в хронологии не показываем.
    const nodes = ordered
      .filter(({ sticker }) => operationAllowed(sticker))
      .map(({ sticker, depth, relation }) => {
        const row = stickerRow(sticker);
        return { ...row, depth, relation, events: stickerEvents(sticker, row, logs) };
      });

    const canSee = await employeeVisibility(
      access,
      nodes.flatMap((node) =>
        workerIds([node, ...node.events.filter((event) => event.workers)]),
      ),
    );

    return {
      selected_id: selected.id,
      nodes: nodes.map((node) => ({
        ...applyVisibility(node, canSee),
        events: node.events.map((event) =>
          event.workers ? applyVisibility(event, canSee) : event,
        ),
      })),
    };
  },
};
