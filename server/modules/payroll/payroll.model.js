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
      workSchedule: { select: { id: true, name: true, type: true } },
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
      select: { id: true, employee_id: true, salary_balance: true, net: true, paid_amount: true, status: true },
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

  addPaymentLog: async (itemId, { amount, payment_date, note, is_advance = false }) => {
    const prisma = prismaContext.get();
    await prisma.payroll_payment_logs.create({
      data: {
        item_id:      Number(itemId),
        amount:       parseFloat(Number(amount).toFixed(2)),
        payment_date: new Date(payment_date),
        note:         note || null,
        is_advance:   Boolean(is_advance),
      },
    });
    return { totalPaid: await PayrollModel.sumPaid(itemId) };
  },

  sumPaid: async (itemId) => {
    const prisma = prismaContext.get();
    const agg = await prisma.payroll_payment_logs.aggregate({
      where: { item_id: Number(itemId) },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount || 0);
  },

  // Сумма выданных авансов по каждому item — для отчёта по выплатам
  getAdvanceTotals: async (itemIds) => {
    const prisma = prismaContext.get();
    if (!itemIds.length) return new Map();
    const rows = await prisma.payroll_payment_logs.groupBy({
      by: ["item_id"],
      where: { item_id: { in: itemIds.map(Number) }, is_advance: true },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.item_id, Number(r._sum.amount || 0)]));
  },

  // Выдачи авансов по этим строкам — аванс привязан к месяцу, в отличие от займа
  getAdvanceLogs: async (itemIds) => {
    const prisma = prismaContext.get();
    if (!itemIds.length) return [];
    return prisma.payroll_payment_logs.findMany({
      where: { item_id: { in: itemIds.map(Number) }, is_advance: true },
      orderBy: { payment_date: "asc" },
    });
  },

  // ── Займы сотрудника ─────────────────────────────────────────────────────────

  createDebt: async (data) => {
    const prisma = prismaContext.get();
    return prisma.employee_debts.create({ data });
  },

  getDebtsByEmployee: async (employeeId) => {
    const prisma = prismaContext.get();
    return prisma.employee_debts.findMany({
      where: { employee_id: Number(employeeId) },
      orderBy: { issued_at: "asc" },
    });
  },

  deleteDebt: async (id) => {
    const prisma = prismaContext.get();
    return prisma.employee_debts.delete({ where: { id: Number(id) } });
  },

  // Выдано займов по каждому сотруднику
  getDebtIssuedTotals: async (employeeIds) => {
    const prisma = prismaContext.get();
    if (!employeeIds.length) return new Map();
    const rows = await prisma.employee_debts.groupBy({
      by: ["employee_id"],
      where: { employee_id: { in: employeeIds.map(Number) } },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.employee_id, Number(r._sum.amount || 0)]));
  },

  // Все строки сотрудника — для расчёта общего долга: переплаты и удержания
  getEmployeeItemsSummary: async (employeeId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findMany({
      where: { employee_id: Number(employeeId) },
      select: {
        id: true, status: true, net: true, paid_amount: true, debt_deduction: true,
        sheet: { select: { month: true, year: true } },
      },
    });
  },

  getDeductionsByEmployee: async (employeeId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findMany({
      where: { employee_id: Number(employeeId), debt_deduction: { gt: 0 } },
      select: {
        id: true, debt_balance: true, debt_deduction: true, debt_comment: true,
        sheet: { select: { month: true, year: true } },
      },
      orderBy: { sheet: { month: "asc" } },
    });
  },

  // Строки одного сотрудника в перечисленных ведомостях
  getEmployeeItemsInSheets: async (sheetIds, employeeId) => {
    const prisma = prismaContext.get();
    if (!sheetIds.length) return [];
    return prisma.payroll_sheet_items.findMany({
      where: { sheet_id: { in: sheetIds.map(Number) }, employee_id: Number(employeeId) },
      select: {
        id: true, sheet_id: true, status: true,
        debt_balance: true, debt_deduction: true, debt_comment: true,
        sheet: { select: { month: true, year: true } },
      },
      orderBy: { sheet: { month: "asc" } },
    });
  },

  findPaymentLogById: async (logId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_payment_logs.findUnique({ where: { id: Number(logId) } });
  },

  updatePaymentLog: async (logId, itemId, { amount, payment_date, note }) => {
    const prisma = prismaContext.get();
    await prisma.payroll_payment_logs.update({
      where: { id: Number(logId) },
      data: {
        amount:       parseFloat(Number(amount).toFixed(2)),
        payment_date: new Date(payment_date),
        note:         note || null,
      },
    });
    return { totalPaid: await PayrollModel.sumPaid(itemId) };
  },

  deletePaymentLog: async (logId, itemId) => {
    const prisma = prismaContext.get();
    await prisma.payroll_payment_logs.delete({ where: { id: Number(logId) } });
    return { totalPaid: await PayrollModel.sumPaid(itemId) };
  },

  // Lightweight fetch of items for a set of employees — used for carry-over
  getItemsForEmployees: async (sheetId, employeeIds) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findMany({
      where: { sheet_id: Number(sheetId), employee_id: { in: employeeIds.map(Number) } },
      select: {
        id: true, employee_id: true, net: true, salary_balance: true,
        paid_amount: true, status: true,
        debt_balance: true, debt_deduction: true,
      },
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
          { employee_number: s },
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
      adjCount,
      adjPosAgg,
      approvedNetAgg,
      totalNetAgg,
    ] = await Promise.all([
      prisma.payroll_sheet_items.count({ where: { sheet_id: id } }),
      prisma.payroll_sheet_items.count({ where: { sheet_id: id, status: "approved" } }),
      prisma.payroll_sheet_items.count({
        where: { sheet_id: id, manual_adjustment: { not: 0 } },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, manual_adjustment: { gt: 0 } },
        _sum: { manual_adjustment: true },
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
      adj_count:    adjCount,
      adj_plus:     Number(adjPosAgg._sum.manual_adjustment || 0),
      approved_net: Number(approvedNetAgg._sum.net || 0),
      total_net:    Number(totalNetAgg._sum.net || 0),
    };
  },

  updateAllItemsStatus: async (sheetId, status) => {
    const prisma = prismaContext.get();
    const where = status === "draft"
      ? { sheet_id: Number(sheetId), status: "approved" }
      : { sheet_id: Number(sheetId), status: "draft" };
    return prisma.payroll_sheet_items.updateMany({ where, data: { status } });
  },

  bulkUpdateStatus: async (itemIds, status) => {
    const prisma = prismaContext.get();
    const where = status === "draft"
      ? { id: { in: itemIds.map(Number) }, status: "approved" }
      : { id: { in: itemIds.map(Number) }, status: "draft" };
    return prisma.payroll_sheet_items.updateMany({ where, data: { status } });
  },

  unapproveSheet: async (id) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheets.update({
      where: { id: Number(id) },
      data: { status: "draft", approved_by: null, approved_at: null },
    });
  },

  hasPaidItems: async (sheetId) => {
    const prisma = prismaContext.get();
    const count = await prisma.payroll_sheet_items.count({
      where: { sheet_id: Number(sheetId), payout_status: { in: ["paid", "partially_paid"] } },
    });
    return count > 0;
  },

  isSheetApprovedForMonth: async (month, year) => {
    const prisma = prismaContext.get();
    const sheet = await prisma.payroll_sheets.findFirst({
      where: { month: Number(month), year: Number(year), status: "approved" },
      select: { id: true },
    });
    return !!sheet;
  },

  hasApprovedOrPaidItemForEmployee: async (employeeId, month, year) => {
    const prisma = prismaContext.get();
    const sheet = await prisma.payroll_sheets.findFirst({
      where: { month: Number(month), year: Number(year) },
      select: { id: true },
    });
    if (!sheet) return false;
    const item = await prisma.payroll_sheet_items.findFirst({
      where: {
        sheet_id: sheet.id,
        employee_id: Number(employeeId),
        status: "approved",
      },
      select: { id: true },
    });
    return !!item;
  },

  hasPaidItemsInIds: async (itemIds) => {
    const prisma = prismaContext.get();
    const count = await prisma.payroll_sheet_items.count({
      where: { id: { in: itemIds.map(Number) }, payout_status: { in: ["paid", "partially_paid"] } },
    });
    return count > 0;
  },

  createSheet: async (data) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheets.create({ data });
  },

  createItems: async (items) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.createMany({ data: items, skipDuplicates: true });
  },

  createItem: async (data) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.create({ data });
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
        employeeWhere.OR = [{ id: n }, { employee_number: s }];
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

    // Base: approved items OR items with payment history
    let where;
    if (payout_status === "unpaid") {
      // Items that still need payment: approved+unpaid/partial
      where = { sheet_id: Number(sheetId), status: "approved", payout_status: { in: ["unpaid", "partially_paid"] } };
    } else if (payout_status === "paid" || payout_status === "partially_paid") {
      // Exact payout_status match, regardless of approval
      where = { sheet_id: Number(sheetId), payout_status };
    } else {
      // All — approved + anything that has actual payment (paid_amount > 0) or payout status set
      where = {
        sheet_id: Number(sheetId),
        OR: [
          { status: "approved" },
          { paid_amount: { gt: 0 } },
          { payout_status: { in: ["paid", "partially_paid"] } },
        ],
      };
    }
    if (Object.keys(employeeWhere).length) where.employee = employeeWhere;
    if (salary_type) where.salary_type = salary_type;

    const orderBy = buildOrderBy(sort_by, sort_order);

    const [items, total] = await Promise.all([
      prisma.payroll_sheet_items.findMany({ where, include: itemInclude, orderBy, skip: Number(skip), take: Number(take) }),
      prisma.payroll_sheet_items.count({ where }),
    ]);

    return { items, total };
  },

  getPayoutsStats: async (sheetId) => {
    const prisma = prismaContext.get();
    const id = Number(sheetId);

    const approvedWhere = { sheet_id: id, status: "approved" };
    const [pendingAgg, paidAgg, totalPaidAgg, debtAgg, balAgg] = await Promise.all([
      // pending = approved + not yet fully paid
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, status: "approved", payout_status: { in: ["unpaid", "partially_paid"] } },
        _count: { id: true },
        _sum:   { net: true },
      }),
      // paid = payout_status=paid OR has actual payment, regardless of approval status
      prisma.payroll_sheet_items.aggregate({
        where: {
          sheet_id: id,
          OR: [{ payout_status: "paid" }, { paid_amount: { gt: 0 } }],
        },
        _count: { id: true },
        _sum:   { net: true },
      }),
      // total money actually paid out (single aggregate to avoid double-count)
      prisma.payroll_sheet_items.aggregate({
        where: { sheet_id: id, paid_amount: { gt: 0 } },
        _sum:  { paid_amount: true },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: approvedWhere,
        _sum:  { debt_deduction: true },
      }),
      prisma.payroll_sheet_items.aggregate({
        where: { ...approvedWhere, salary_balance: { gt: 0 } },
        _sum:  { salary_balance: true },
      }),
    ]);

    return {
      pending_count:         pendingAgg._count.id,
      paid_count:            paidAgg._count.id,
      pending_sum:           Number(pendingAgg._sum.net         || 0),
      paid_sum:              Number(paidAgg._sum.net            || 0),
      total_paid_amount:     Number(totalPaidAgg._sum.paid_amount || 0),
      total_debt_deduction:  Number(debtAgg._sum.debt_deduction  || 0),
      total_salary_balance:  Number(balAgg._sum.salary_balance   || 0),
    };
  },

  bulkMarkPaid: async (itemIds, payoutStatus) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.updateMany({
      where: { id: { in: itemIds.map(Number) }, status: "approved" },
      data:  { payout_status: payoutStatus },
    });
  },

  markAllPayoutsStatus: async (sheetId, payoutStatus) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.updateMany({
      where: { sheet_id: Number(sheetId), status: "approved" },
      data:  { payout_status: payoutStatus },
    });
  },

  getDraftItemForEmployee: async (sheetId, employeeId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findFirst({
      where: { sheet_id: Number(sheetId), employee_id: Number(employeeId), status: "draft" },
      include: {
        employee: {
          select: {
            id: true,
            employeeSalaryHistory: {
              orderBy: { date_from: "desc" },
              take: 1,
              select: { amount: true, salary_type: true },
            },
          },
        },
      },
    });
  },

  getAllDraftItemsForEmployee: async (employeeId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findMany({
      where: { employee_id: Number(employeeId), status: "draft" },
      include: { sheet: { select: { id: true, year: true, month: true } } },
      orderBy: [{ sheet: { year: "asc" } }, { sheet: { month: "asc" } }],
    });
  },

  getSheetItemForEmployee: async (sheetId, employeeId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findFirst({
      where: { sheet_id: Number(sheetId), employee_id: Number(employeeId) },
      select: {
        id: true, employee_id: true, status: true,
        net: true, accrued: true,
        salary_balance: true, paid_amount: true,
        debt_balance: true, debt_deduction: true, debt_mode: true,
        manual_adjustment: true,
        apply_late: true, late_amount: true,
        apply_overtime: true, overtime_amount: true,
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

  getDraftItems: async (sheetId) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheet_items.findMany({
      where: { sheet_id: Number(sheetId), status: "draft" },
      include: {
        employee: {
          select: {
            id: true,
            employeeSalaryHistory: {
              orderBy: { date_from: "desc" },
              take: 1,
              select: { amount: true, salary_type: true },
            },
          },
        },
      },
    });
  },

  batchUpdateDraftItems: async (_sheetId, updates) => {
    const prisma = prismaContext.get();
    await prisma.$transaction(
      updates.map((u) =>
        prisma.payroll_sheet_items.update({
          where: { id: u.id },
          data: {
            base_salary:      u.base_salary,
            salary_type:      u.salary_type,
            accrued:          u.accrued,
            late_minutes:     u.late_minutes,
            late_amount:      u.late_amount,
            overtime_minutes: u.overtime_minutes,
            overtime_amount:  u.overtime_amount,
            worked_days:      u.worked_days,
            total_work_days:  u.total_work_days,
            worked_hours:     u.worked_hours,
            net:              u.net,
          },
        }),
      ),
    );
  },

  // ── Year payout report ───────────────────────────────────────────────────────

  // All sheets of a calendar year
  findSheetsByYear: async (year) => {
    const prisma = prismaContext.get();
    return prisma.payroll_sheets.findMany({
      where: { year: Number(year) },
      select: { id: true, month: true, year: true },
      orderBy: { month: "asc" },
    });
  },

  // Every payout-relevant item of the given sheets, with employee data.
  // No pagination — grouping per employee happens in the service layer.
  getYearPayoutItems: async (
    sheetIds,
    {
      search        = "",
      branch_id     = "",
      department_id = "",
      position_id   = "",
      salary_type   = "",
    } = {}
  ) => {
    const prisma = prismaContext.get();
    if (!sheetIds.length) return [];

    const employeeWhere = {};
    if (search?.trim()) {
      const s = search.trim();
      const isNum = /^\d+$/.test(s);
      if (isNum) {
        employeeWhere.OR = [{ id: Number(s) }, { employee_number: s }];
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

    const where = {
      sheet_id: { in: sheetIds.map(Number) },
      OR: [
        { status: "approved" },
        { paid_amount: { gt: 0 } },
        { payout_status: { in: ["paid", "partially_paid"] } },
      ],
    };
    if (Object.keys(employeeWhere).length) where.employee = employeeWhere;
    if (salary_type) where.salary_type = salary_type;

    return prisma.payroll_sheet_items.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employee_number: true,
            last_name: true,
            first_name: true,
            middle_name: true,
            photo: true,
            status: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
        },
        sheet: { select: { id: true, month: true, year: true } },
      },
      orderBy: { sheet: { month: "asc" } },
    });
  },
};
