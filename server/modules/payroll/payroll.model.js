import { prismaContext } from "../../utils/prismaContext.js";

const itemInclude = {
  employee: {
    select: {
      id: true,
      last_name: true,
      first_name: true,
      middle_name: true,
      photo: true,
      branch: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
    },
  },
};

function buildOrderBy(sortBy = "last_name", sortOrder = "asc") {
  const order = sortOrder === "desc" ? "desc" : "asc";
  const map = {
    last_name:       { employee: { last_name: order } },
    employee_number: { employee: { employee_number: order } },
    branch:          { employee: { branch: { name: order } } },
    department:      { employee: { department: { name: order } } },
    position:        { employee: { position: { name: order } } },
    amount:          { accrued: order },   // SalarySort "amount" → accrued
    worked_days:     { worked_days: order },
    accrued:         { accrued: order },
    net:             { net: order },
    status:          { status: order },
  };
  return map[sortBy] || map.last_name;
}

export const PayrollModel = {
  // All items for a sheet (no pagination) — used for recalculate
  getAllSheetItems: async (sheetId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findMany({
      where: { sheet_id: Number(sheetId) },
      select: { id: true, employee_id: true, salary_balance: true, net: true, paid_amount: true, advance_total: true, status: true },
    });
  },

  findSheetById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheets.findUnique({ where: { id: Number(id) } });
  },

  // ── Payment logs ─────────────────────────────────────────────────────────────

  getPaymentLogs: async (itemId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_payment_logs.findMany({
      where: { item_id: Number(itemId) },
      orderBy: { payment_date: "desc" },
    });
  },

  addPaymentLog: async (itemId, { amount, payment_date, note }) => {
    const prisma = prismaContext.get();
    await prisma.payroll_payment_logs.create({
      data: {
        item_id:      Number(itemId),
        amount:       parseFloat(Number(amount).toFixed(2)),
        payment_date: new Date(payment_date),
        note:         note || null,
      },
    });
    const agg = await prisma.payroll_payment_logs.aggregate({
      where: { item_id: Number(itemId) },
      _sum: { amount: true },
    });
    return { totalPaid: Number(agg._sum.amount || 0) };
  },

  deletePaymentLog: async (logId, itemId) => {
    const prisma = prismaContext.get();
    await prisma.payroll_payment_logs.delete({ where: { id: Number(logId) } });
    const agg = await prisma.payroll_payment_logs.aggregate({
      where: { item_id: Number(itemId) },
      _sum: { amount: true },
    });
    return { totalPaid: Number(agg._sum.amount || 0) };
  },

  // Lightweight fetch of items for a set of employees — used for carry-over
  getItemsForEmployees: async (sheetId, employeeIds) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findMany({
      where: { sheet_id: Number(sheetId), employee_id: { in: employeeIds.map(Number) } },
      select: { employee_id: true, net: true, salary_balance: true, paid_amount: true, advance_total: true },
    });
  },

  // Sheet metadata only — used for existence check and generation
  findByMonthYear: async (month, year) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheets.findFirst({ where: { month, year } });
  },

  // Paginated + filtered items for display
  getSheetItems: async (
    sheetId,
    {
      search = "",
      branch_id = "",
      department_id = "",
      position_id = "",
      salary_type = "",
      item_status = "",
      sort_by = "last_name",
      sort_order = "asc",
      skip = 0,
      take = 50,
    } = {}
  ) => {
    const prisma = prismaContext.get();

    const employeeWhere = {};
    if (search?.trim()) {
      const s = search.trim();
      const isNum = /^\d+$/.test(s);
      if (isNum) {
        const n = Number(s);
        employeeWhere.OR = [
          { id: n },
          { employee_number: n },
        ];
      } else {
        employeeWhere.OR = [
          { last_name:   { contains: s, mode: "insensitive" } },
          { first_name:  { contains: s, mode: "insensitive" } },
          { middle_name: { contains: s, mode: "insensitive" } },
        ];
      }
    }
    if (branch_id)     employeeWhere.branch_id     = Number(branch_id);
    if (department_id) employeeWhere.department_id = Number(department_id);
    if (position_id)   employeeWhere.position_id   = Number(position_id);

    const where = { sheet_id: Number(sheetId) };
    if (Object.keys(employeeWhere).length) where.employee = employeeWhere;
    if (salary_type) where.salary_type = salary_type;
    if (item_status) where.status = item_status;

    const orderBy = buildOrderBy(sort_by, sort_order);

    const [items, total] = await Promise.all([
      prisma.payroll_sheet_items.findMany({
        where,
        include: itemInclude,
        orderBy,
        skip: Number(skip),
        take: Number(take),
      }),
      prisma.payroll_sheet_items.count({ where }),
    ]);

    return { items, total };
  },

  // Aggregate stats across ALL items (no filters) — for header widgets
  getSheetStats: async (sheetId) => {
    const prisma = prismaContext.get();
    const id = Number(sheetId);

    const [
      totalCount,
      approvedCount,
      adjPosAgg,
      adjNegAgg,
      approvedNetAgg,
      totalNetAgg,
    ] = await Promise.all([
      prisma.payroll_sheet_items.count({ where: { sheet_id: id } }),
      prisma.payroll_sheet_items.count({ where: { sheet_id: id, status: "approved" } }),
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, manual_adjustment: { gt: 0 } },
        _sum: { manual_adjustment: true },
        _count: { id: true },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, manual_adjustment: { lt: 0 } },
        _sum: { manual_adjustment: true },
        _count: { id: true },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, status: "approved" },
        _sum: { net: true },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id },
        _sum: { net: true },
      }),
    ]);

    return {
      total:        totalCount,
      approved:     approvedCount,
      remaining:    totalCount - approvedCount,
      adj_count:    adjPosAgg._count.id + adjNegAgg._count.id,
      adj_plus:     Number(adjPosAgg._sum.manual_adjustment || 0),
      adj_minus:    Number(adjNegAgg._sum.manual_adjustment || 0),
      adj_sum:      Number(adjPosAgg._sum.manual_adjustment || 0) + Number(adjNegAgg._sum.manual_adjustment || 0),
      approved_net: Number(approvedNetAgg._sum.net || 0),
      total_net:    Number(totalNetAgg._sum.net || 0),
    };
  },

  updateAllItemsStatus: async (sheetId, status) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.updateMany({
      where: { sheet_id: Number(sheetId) },
      data: { status },
    });
  },

  bulkUpdateStatus: async (itemIds, status) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.updateMany({
      where: { id: { in: itemIds.map(Number) } },
      data: { status },
    });
  },

  createSheet: async (data) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheets.create({ data });
  },

  createItems: async (items) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.createMany({ data: items, skipDuplicates: true });
  },

  findItemById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findUnique({ where: { id: Number(id) } });
  },

  findItemBySheetAndEmployee: async (sheetId, employeeId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findUnique({
      where: {
        sheet_id_employee_id: {
          sheet_id:    Number(sheetId),
          employee_id: Number(employeeId),
        },
      },
    });
  },

  updateItem: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.update({
      where: { id: Number(id) },
      data,
      include: itemInclude,
    });
  },

  approveSheet: async (id, userId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheets.update({
      where: { id: Number(id) },
      data: { status: "approved", approved_by: userId, approved_at: new Date() },
    });
  },

  deleteSheet: async (id) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheets.delete({ where: { id: Number(id) } });
  },

  // ── Payouts (approved → paid) ────────────────────────────────────────────────

  getPayoutItems: async (
    sheetId,
    {
      search        = "",
      branch_id     = "",
      department_id = "",
      position_id   = "",
      salary_type   = "",
      payout_status = "",   // "" = all (approved+paid), "approved", "paid"
      sort_by       = "last_name",
      sort_order    = "asc",
      skip          = 0,
      take          = 50,
    } = {}
  ) => {
    const prisma = prismaContext.get();

    const employeeWhere = {};
    if (search?.trim()) {
      const s = search.trim();
      const isNum = /^\d+$/.test(s);
      if (isNum) {
        const n = Number(s);
        employeeWhere.OR = [{ id: n }, { employee_number: n }];
      } else {
        employeeWhere.OR = [
          { last_name:   { contains: s, mode: "insensitive" } },
          { first_name:  { contains: s, mode: "insensitive" } },
          { middle_name: { contains: s, mode: "insensitive" } },
        ];
      }
    }
    if (branch_id)     employeeWhere.branch_id     = Number(branch_id);
    if (department_id) employeeWhere.department_id = Number(department_id);
    if (position_id)   employeeWhere.position_id   = Number(position_id);

    const statusFilter = payout_status === "approved" || payout_status === "paid"
      ? payout_status
      : { in: ["approved", "paid"] };

    const where = { sheet_id: Number(sheetId), status: statusFilter };
    if (Object.keys(employeeWhere).length) where.employee = employeeWhere;
    if (salary_type) where.salary_type = salary_type;

    const orderBy = buildOrderBy(sort_by, sort_order);

    const [items, total] = await Promise.all([
      prisma.payroll_sheet_items.findMany({ where, include: itemInclude, orderBy, skip: Number(skip), take: Number(take) }),
      prisma.payroll_sheet_items.count({ where }),
    ]);

    return { items, total };
  },

  // Sum of advances per employee for a given year/month
  getAdvanceTotalsForMonth: async (year, month, employeeIds) => {
    const prisma = prismaContext.get();
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month - 1, new Date(year, month, 0).getDate(), 23, 59, 59);
    const rows  = await prisma.salary_advances.groupBy({
      by:    ["employee_id"],
      where: { advance_date: { gte: start, lte: end }, employee_id: { in: employeeIds.map(Number) } },
      _sum:  { amount: true },
    });
    const map = new Map();
    for (const r of rows) map.set(r.employee_id, Number(r._sum.amount || 0));
    return map;
  },

  getPayoutsStats: async (sheetId) => {
    const prisma = prismaContext.get();
    const id = Number(sheetId);

    const [pendingAgg, paidAgg, debtAgg, balAgg, advAgg] = await Promise.all([
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, status: "approved" },
        _count: { id: true },
        _sum:   { net: true, paid_amount: true },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, status: "paid" },
        _count: { id: true },
        _sum:   { net: true, paid_amount: true },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, status: { in: ["approved", "paid"] } },
        _sum:  { debt_deduction: true },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, status: { in: ["approved", "paid"] }, salary_balance: { gt: 0 } },
        _sum:  { salary_balance: true },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, status: { in: ["approved", "paid"] } },
        _sum:  { advance_total: true },
      }),
    ]);

    return {
      pending_count:         pendingAgg._count.id,
      paid_count:            paidAgg._count.id,
      pending_sum:           Number(pendingAgg._sum.net         || 0),
      paid_sum:              Number(paidAgg._sum.net            || 0),
      total_paid_amount:     Number(pendingAgg._sum.paid_amount || 0) + Number(paidAgg._sum.paid_amount || 0),
      total_debt_deduction:  Number(debtAgg._sum.debt_deduction || 0),
      total_salary_balance:  Number(balAgg._sum.salary_balance  || 0),
      total_advance:         Number(advAgg._sum.advance_total   || 0),
    };
  },

  bulkMarkPaid: async (itemIds, status) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.updateMany({
      where: { id: { in: itemIds.map(Number) } },
      data:  { status },
    });
  },

  markAllPayoutsStatus: async (sheetId, status) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.updateMany({
      where: { sheet_id: Number(sheetId), status: { in: ["approved", "paid"] } },
      data:  { status },
    });
  },

  // ── Salary Advances ──────────────────────────────────────────────────────────

  getAdvances: async ({
    year,
    month,
    search        = "",
    branch_id     = "",
    department_id = "",
    position_id   = "",
    sort_by       = "advance_date",
    sort_order    = "desc",
    skip          = 0,
    take          = 50,
  } = {}) => {
    const prisma = prismaContext.get();

    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month - 1, new Date(year, month, 0).getDate(), 23, 59, 59);

    const employeeWhere = {};
    if (search?.trim()) {
      const s = search.trim();
      const isNum = /^\d+$/.test(s);
      if (isNum) {
        const n = Number(s);
        employeeWhere.OR = [{ id: n }, { employee_number: n }];
      } else {
        employeeWhere.OR = [
          { last_name:   { contains: s, mode: "insensitive" } },
          { first_name:  { contains: s, mode: "insensitive" } },
          { middle_name: { contains: s, mode: "insensitive" } },
        ];
      }
    }
    if (branch_id)     employeeWhere.branch_id     = Number(branch_id);
    if (department_id) employeeWhere.department_id = Number(department_id);
    if (position_id)   employeeWhere.position_id   = Number(position_id);

    const where = { advance_date: { gte: start, lte: end } };
    if (Object.keys(employeeWhere).length) where.employee = employeeWhere;

    const advanceInclude = {
      employee: {
        select: {
          id: true, last_name: true, first_name: true, middle_name: true,
          branch:     { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          position:   { select: { id: true, name: true } },
        },
      },
      givenBy: {
        select: {
          id: true,
          username: true,
          employee: { select: { last_name: true, first_name: true, middle_name: true } },
        },
      },
    };

    const advanceOrderBy = (() => {
      const o = sort_order === "desc" ? "desc" : "asc";
      if (sort_by === "amount")      return { amount: o };
      if (sort_by === "last_name")   return { employee: { last_name: o } };
      if (sort_by === "branch")      return { employee: { branch: { name: o } } };
      if (sort_by === "department")  return { employee: { department: { name: o } } };
      if (sort_by === "position")    return { employee: { position: { name: o } } };
      return { advance_date: "desc" };
    })();

    const [advances, total] = await Promise.all([
      prisma.salary_advances.findMany({ where, include: advanceInclude, orderBy: advanceOrderBy, skip: Number(skip), take: Number(take) }),
      prisma.salary_advances.count({ where }),
    ]);

    return { advances, total };
  },

  getAdvancesStats: async ({ year, month }) => {
    const prisma = prismaContext.get();
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month - 1, new Date(year, month, 0).getDate(), 23, 59, 59);
    const where = { advance_date: { gte: start, lte: end } };

    const [agg, empCount] = await Promise.all([
      prisma.salary_advances.aggregate({ where, _count: { id: true }, _sum: { amount: true } }),
      prisma.salary_advances.findMany({ where, select: { employee_id: true }, distinct: ["employee_id"] }),
    ]);

    const count  = agg._count.id;
    const total  = Number(agg._sum.amount || 0);
    return {
      total_count:    count,
      total_amount:   total,
      avg_amount:     count > 0 ? parseFloat((total / count).toFixed(2)) : 0,
      employee_count: empCount.length,
    };
  },

  findAdvanceById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.salary_advances.findUnique({
      where: { id: Number(id) },
      select: { id: true, employee_id: true, advance_date: true, amount: true },
    });
  },

  getSheetItemForEmployee: async (sheetId, employeeId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findFirst({
      where: { sheet_id: Number(sheetId), employee_id: Number(employeeId) },
      select: {
        id: true, employee_id: true, status: true,
        net: true, accrued: true,
        salary_balance: true, paid_amount: true, advance_total: true,
        debt_balance: true, debt_deduction: true, debt_mode: true,
        manual_adjustment: true,
        apply_late: true, late_amount: true,
        apply_overtime: true, overtime_amount: true,
      },
    });
  },

  createAdvances: async (rows) => {
    const prisma = prismaContext.get();
    return prisma.salary_advances.createMany({ data: rows });
  },

  deleteAdvance: async (id) => {
    const prisma = prismaContext.get();
    return prisma.salary_advances.delete({ where: { id: Number(id) } });
  },

  updateAdvance: async (id, { employee_id, amount, advance_date, note }) => {
    const prisma = prismaContext.get();
    return prisma.salary_advances.update({
      where: { id: Number(id) },
      data: {
        ...(employee_id !== undefined ? { employee_id: Number(employee_id) } : {}),
        ...(amount      !== undefined ? { amount: Number(amount) }           : {}),
        ...(advance_date !== undefined ? { advance_date: new Date(advance_date) } : {}),
        note: note ?? null,
      },
      include: {
        employee: {
          select: {
            id: true, last_name: true, first_name: true, middle_name: true,
            branch:     { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            position:   { select: { id: true, name: true } },
          },
        },
        givenBy: {
          select: {
            id: true, username: true,
            employee: { select: { last_name: true, first_name: true, middle_name: true } },
          },
        },
      },
    });
  },

  // Bulk-set apply_late and/or apply_overtime for all items in a sheet,
  // then recalculate net in one SQL statement.
  bulkApplyFlags: async (sheetId, { apply_late, apply_overtime }) => {
    const prisma = prismaContext.get();
    const id = Number(sheetId);

    if (apply_late !== undefined && apply_overtime !== undefined) {
      await prisma.$executeRaw`
        UPDATE payroll_sheet_items
        SET apply_late     = ${apply_late},
            apply_overtime = ${apply_overtime},
            net = accrued - debt_deduction + manual_adjustment
                - (CASE WHEN ${apply_late}     THEN late_amount     ELSE 0 END)
                + (CASE WHEN ${apply_overtime} THEN overtime_amount ELSE 0 END)
        WHERE sheet_id = ${id}
      `;
    } else if (apply_late !== undefined) {
      await prisma.$executeRaw`
        UPDATE payroll_sheet_items
        SET apply_late = ${apply_late},
            net = accrued - debt_deduction + manual_adjustment
                - (CASE WHEN ${apply_late}    THEN late_amount     ELSE 0 END)
                + (CASE WHEN apply_overtime   THEN overtime_amount ELSE 0 END)
        WHERE sheet_id = ${id}
      `;
    } else if (apply_overtime !== undefined) {
      await prisma.$executeRaw`
        UPDATE payroll_sheet_items
        SET apply_overtime = ${apply_overtime},
            net = accrued - debt_deduction + manual_adjustment
                - (CASE WHEN apply_late        THEN late_amount     ELSE 0 END)
                + (CASE WHEN ${apply_overtime} THEN overtime_amount ELSE 0 END)
        WHERE sheet_id = ${id}
      `;
    }
  },
};
