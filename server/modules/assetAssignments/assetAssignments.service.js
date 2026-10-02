import ExcelJS from "exceljs";
import { AssetAssignmentModel } from "./assetAssignments.model.js";
import { UserModel } from "../users/users.model.js";
import { buildEmployeeAccess } from "../employees/employee.helpers.js";
import { createAuditLog } from "../../utils/auditLog.js";
import { prismaContext } from "../../utils/prismaContext.js";

const STATES = ["assigned", "returned", "scrapped"];

// поля, по которым разрешена сортировка на сервере (кнопка сортировки)
const buildOrderBy = (sortBy, sortOrder) => {
  const dir = sortOrder === "asc" ? "asc" : "desc";
  switch (sortBy) {
    case "last_name":
      return [{ employee: { last_name: dir } }, { employee: { first_name: dir } }];
    case "asset_name":
      return { asset_name: dir };
    case "asset_spec":
      return { asset_spec: dir };
    case "asset_condition":
      return { asset_condition: dir };
    case "quantity":
      return { quantity: dir };
    case "state":
      return { state: dir };
    case "assigned_date":
    default:
      return { assigned_date: dir };
  }
};

const toDate = (value) => (value ? new Date(value) : null);

// выдача не может быть позже возврата
const assertDateOrder = (assignedDate, returnDate) => {
  if (!assignedDate || !returnDate) return;
  if (new Date(assignedDate) > new Date(returnDate)) {
    const err = new Error("Дата выдачи не может быть позже даты возврата");
    err.code = "ASSIGNED_AFTER_RETURN";
    throw err;
  }
};

const trim = (value, max) =>
  typeof value === "string" && value.trim() !== ""
    ? value.trim().slice(0, max)
    : null;

// Произвольные доп. поля: [{ label, value }]. Пустые пары отбрасываем.
const sanitizeCustomFields = (fields) => {
  if (!Array.isArray(fields)) return null;
  const cleaned = fields
    .map((f) => ({
      label: trim(f?.label, 100),
      value: trim(f?.value, 500),
    }))
    .filter((f) => f.label || f.value);
  return cleaned.length > 0 ? cleaned : null;
};

const buildItemData = (item, employeeId, userId) => ({
  employee_id: Number(employeeId),
  asset_name: String(item.asset_name).trim().slice(0, 255),
  asset_spec: trim(item.asset_spec),
  asset_condition: trim(item.asset_condition, 100),
  quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
  inventory_number: trim(item.inventory_number, 100),
  assigned_date: toDate(item.assigned_date) || new Date(),
  expected_return_date: toDate(item.expected_return_date),
  note: trim(item.note),
  custom_fields: sanitizeCustomFields(item.custom_fields),
  state: "assigned",
  added_by: Number(userId),
});

// Доступ к записям ограничиваем через сотрудника (филиал/отдел пользователя)
const buildAccessWhere = async (userId) => {
  const user = await UserModel.getById(Number(userId));
  if (!user) throw new Error("Пользователь не найден");

  const access = buildEmployeeAccess(user);
  return Object.keys(access).length > 0 ? { employee: access } : {};
};

export const AssetAssignmentsService = {
  getAssignments: async ({ userId, page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = await buildAccessWhere(userId);

    if (filters.search) {
      const search = filters.search;
      const numericId = Number(search);

      where.OR = [
        { asset_name: { contains: search, mode: "insensitive" } },
        { asset_spec: { contains: search, mode: "insensitive" } },
        { inventory_number: { contains: search, mode: "insensitive" } },
        { employee: { first_name: { contains: search, mode: "insensitive" } } },
        { employee: { last_name: { contains: search, mode: "insensitive" } } },
        { employee: { middle_name: { contains: search, mode: "insensitive" } } },
        {
          employee: {
            employee_number: { contains: search, mode: "insensitive" },
          },
        },
        // поиск по id сотрудника (в таблице показывается как ФИО (id))
        ...(Number.isInteger(numericId) && numericId > 0
          ? [{ employee_id: numericId }]
          : []),
      ];
    }

    if (filters.employee_id) where.employee_id = Number(filters.employee_id);
    if (filters.state && STATES.includes(filters.state)) where.state = filters.state;

    if (filters.branch_id || filters.department_id || filters.position_id) {
      where.employee = {
        ...(where.employee || {}),
        ...(filters.branch_id ? { branch_id: Number(filters.branch_id) } : {}),
        ...(filters.department_id
          ? { department_id: Number(filters.department_id) }
          : {}),
        ...(filters.position_id
          ? { position_id: Number(filters.position_id) }
          : {}),
      };
    }

    if (filters.date_from || filters.date_to) {
      where.assigned_date = {};
      if (filters.date_from) where.assigned_date.gte = new Date(filters.date_from);
      if (filters.date_to) where.assigned_date.lte = new Date(filters.date_to);
    }

    const orderBy = buildOrderBy(filters.sort_by, filters.sort_order);

    const [data, total] = await Promise.all([
      AssetAssignmentModel.findMany({ where, skip, take: limit, orderBy }),
      AssetAssignmentModel.count(where),
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

  // Режим «по сотрудникам»: пагинация по сотрудникам, у каждого — его имущество
  getGroupedByEmployee: async ({ userId, page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    // фильтры по самим выдачам (без поиска — поиск разбираем отдельно)
    const assignmentWhere = {};
    if (filters.state && STATES.includes(filters.state)) assignmentWhere.state = filters.state;
    if (filters.date_from || filters.date_to) {
      assignmentWhere.assigned_date = {};
      if (filters.date_from) assignmentWhere.assigned_date.gte = new Date(filters.date_from);
      if (filters.date_to) assignmentWhere.assigned_date.lte = new Date(filters.date_to);
    }

    const where = {
      ...buildEmployeeAccess(user),
      assetAssignments: { some: assignmentWhere },
    };

    if (filters.employee_id) where.id = Number(filters.employee_id);
    if (filters.branch_id) where.branch_id = Number(filters.branch_id);
    if (filters.department_id) where.department_id = Number(filters.department_id);
    if (filters.position_id) where.position_id = Number(filters.position_id);

    // поиск: по сотруднику (ФИО, id, таб. номер) либо по его имуществу
    if (filters.search) {
      const search = filters.search;
      const numericId = Number(search);

      where.AND = [
        {
          OR: [
            { first_name: { contains: search, mode: "insensitive" } },
            { last_name: { contains: search, mode: "insensitive" } },
            { middle_name: { contains: search, mode: "insensitive" } },
            { employee_number: { contains: search, mode: "insensitive" } },
            ...(Number.isInteger(numericId) && numericId > 0 ? [{ id: numericId }] : []),
            {
              assetAssignments: {
                some: {
                  ...assignmentWhere,
                  OR: [
                    { asset_name: { contains: search, mode: "insensitive" } },
                    { asset_spec: { contains: search, mode: "insensitive" } },
                    { inventory_number: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
      ];
    }

    const [employees, total] = await Promise.all([
      AssetAssignmentModel.findEmployeesWithAssignments({
        where,
        skip,
        take: limit,
        assignmentWhere,
      }),
      AssetAssignmentModel.countEmployeesWithAssignments(where),
    ]);

    return {
      data: employees,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getStats: async (userId) => {
    const base = await buildAccessWhere(userId);

    const [total, assigned, returned, scrapped, employees] = await Promise.all([
      AssetAssignmentModel.count({ ...base }),
      AssetAssignmentModel.count({ ...base, state: "assigned" }),
      AssetAssignmentModel.count({ ...base, state: "returned" }),
      AssetAssignmentModel.count({ ...base, state: "scrapped" }),
      AssetAssignmentModel.countDistinctEmployees({ ...base, state: "assigned" }),
    ]);

    return { total, assigned, returned, scrapped, employees };
  },

  getAssignmentById: async (id) => AssetAssignmentModel.findUnique(id),

  // Подсказки для формы выдачи: уже введённые названия и состояния
  getSuggestions: async () => {
    const [names, conditions] = await Promise.all([
      AssetAssignmentModel.findDistinctValues("asset_name"),
      AssetAssignmentModel.findDistinctValues("asset_condition"),
    ]);
    return { names, conditions };
  },

  createAssignments: async ({ employee_id, items }, userId) => {
    if (!employee_id) throw new Error("Не выбран сотрудник");

    const list = Array.isArray(items) ? items : [];
    const valid = list.filter(
      (item) => item && typeof item.asset_name === "string" && item.asset_name.trim(),
    );
    if (valid.length === 0) throw new Error("Не заполнено ни одной позиции");

    const created = await AssetAssignmentModel.createMany(
      valid.map((item) => buildItemData(item, employee_id, userId)),
    );

    for (const row of created) {
      await createAuditLog({
        userId,
        action: "create",
        entity: "asset_assignments",
        recordId: row.id,
        newData: row,
      });
    }

    return created;
  },

  // Импорт выдач из Excel. Колонки: ID сотрудника | Название | Параметры |
  // Состояние | Кол-во | Дата выдачи | Примечание. Импорт только создаёт выдачи.
  importFromExcel: async (buffer, userId) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new Error("Рабочий лист не найден");

    const normCell = (v) => {
      if (v === null || v === undefined) return null;
      if (v instanceof Date) return v;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
      if (Array.isArray(v.richText)) return v.richText.map((r) => r.text || "").join("");
      if (v.formula !== undefined || v.sharedFormula !== undefined) return normCell(v.result);
      if (v.text !== undefined) return String(v.text);
      return v;
    };

    const toStr = (v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    };

    // принимаем ячейку-дату Excel, "01.01.2025" и "2025-01-01"
    const toDateCell = (v) => {
      if (v instanceof Date) return v;
      const s = toStr(v);
      if (!s) return null;
      const dotted = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
      if (dotted) {
        const [, d, m, y] = dotted;
        return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
      }
      const parsed = new Date(s);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const rows = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const arr = [];
      for (let c = 1; c <= row.cellCount; c++) arr.push(normCell(row.getCell(c).value));
      rows.push(arr);
    });

    const prisma = prismaContext.get();
    let created = 0;
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        const rawEmployeeId = toStr(row[0]);
        const assetName = toStr(row[1]);

        // полностью пустая строка — просто пропускаем
        if (!rawEmployeeId && !assetName) continue;

        const employeeId = Number(rawEmployeeId);
        if (!rawEmployeeId || !Number.isInteger(employeeId) || employeeId <= 0) {
          errors.push({
            row: rowNum,
            code: "INVALID_EMPLOYEE_ID",
            error: `Неверный ID сотрудника: ${rawEmployeeId ?? ""}`,
          });
          continue;
        }

        const employee = await prisma.employees.findUnique({ where: { id: employeeId } });
        if (!employee) {
          errors.push({
            row: rowNum,
            code: "EMPLOYEE_NOT_FOUND",
            error: `Сотрудник ID=${employeeId} не найден`,
          });
          continue;
        }

        if (!assetName) {
          errors.push({ row: rowNum, code: "NAME_REQUIRED", error: "Не заполнено название" });
          continue;
        }

        const assignedDate = toDateCell(row[5]);
        if (row[5] && !assignedDate) {
          errors.push({ row: rowNum, code: "INVALID_DATE", error: `Неверная дата: ${toStr(row[5])}` });
          continue;
        }

        const rawQuantity = Number(toStr(row[4]));
        const result = await AssetAssignmentModel.create({
          employee_id: employeeId,
          asset_name: assetName.slice(0, 255),
          asset_spec: trim(toStr(row[2])),
          asset_condition: trim(toStr(row[3]), 100),
          quantity: Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.trunc(rawQuantity) : 1,
          assigned_date: assignedDate || new Date(),
          note: trim(toStr(row[6])),
          state: "assigned",
          added_by: Number(userId),
        });

        await createAuditLog({
          userId,
          action: "create",
          entity: "asset_assignments",
          recordId: result.id,
          newData: result,
        });
        created++;
      } catch (err) {
        errors.push({ row: rowNum, code: "UNKNOWN", error: err.message });
      }
    }

    return { created, errors };
  },

  updateAssignment: async (id, body, userId) => {
    const old = await AssetAssignmentModel.findUnique(id);
    if (!old) return null;

    const data = {};
    if (body.employee_id !== undefined) data.employee_id = Number(body.employee_id);
    if (body.asset_name !== undefined)
      data.asset_name = String(body.asset_name).trim().slice(0, 255);
    if (body.asset_spec !== undefined) data.asset_spec = trim(body.asset_spec);
    if (body.asset_condition !== undefined)
      data.asset_condition = trim(body.asset_condition, 100);
    if (body.quantity !== undefined)
      data.quantity = Number(body.quantity) > 0 ? Number(body.quantity) : 1;
    if (body.inventory_number !== undefined)
      data.inventory_number = trim(body.inventory_number, 100);
    if (body.assigned_date !== undefined)
      data.assigned_date = toDate(body.assigned_date) || old.assigned_date;
    if (body.expected_return_date !== undefined)
      data.expected_return_date = toDate(body.expected_return_date);
    if (body.note !== undefined) data.note = trim(body.note);
    if (body.custom_fields !== undefined)
      data.custom_fields = sanitizeCustomFields(body.custom_fields);
    if (body.state !== undefined && STATES.includes(body.state))
      data.state = body.state;
    if (body.return_date !== undefined) data.return_date = toDate(body.return_date);
    if (body.return_condition !== undefined)
      data.return_condition = trim(body.return_condition, 100);

    assertDateOrder(
      data.assigned_date ?? old.assigned_date,
      data.return_date !== undefined ? data.return_date : old.return_date,
    );

    const result = await AssetAssignmentModel.update(id, data);

    await createAuditLog({
      userId,
      action: "update",
      entity: "asset_assignments",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  // Возврат или списание имущества
  returnAssignment: async (id, { state, return_date, return_condition }, userId) => {
    const old = await AssetAssignmentModel.findUnique(id);
    if (!old) return null;

    const nextState = state === "scrapped" ? "scrapped" : "returned";
    const nextReturnDate = toDate(return_date) || new Date();

    assertDateOrder(old.assigned_date, nextReturnDate);

    const result = await AssetAssignmentModel.update(id, {
      state: nextState,
      return_date: nextReturnDate,
      return_condition: trim(return_condition, 100),
    });

    await createAuditLog({
      userId,
      action: "update",
      entity: "asset_assignments",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  // Отмена возврата/списания — запись снова «на руках»
  undoReturn: async (id, userId) => {
    const old = await AssetAssignmentModel.findUnique(id);
    if (!old) return null;

    const result = await AssetAssignmentModel.update(id, {
      state: "assigned",
      return_date: null,
      return_condition: null,
    });

    await createAuditLog({
      userId,
      action: "update",
      entity: "asset_assignments",
      recordId: id,
      oldData: old,
      newData: result,
    });

    return result;
  },

  deleteAssignment: async (id, userId) => {
    const old = await AssetAssignmentModel.findUnique(id);
    if (!old) return null;

    const result = await AssetAssignmentModel.delete(id);

    await createAuditLog({
      userId,
      action: "delete",
      entity: "asset_assignments",
      recordId: id,
      oldData: old,
    });

    return result;
  },
};
