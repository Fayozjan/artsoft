import { PayrollModel } from "./payroll.model.js";
import { EmployeeSalaryHistoryModel } from "../employeeSalaryHistory/employeeSalaryHistory.model.js";
import { FacePassesService } from "../facePasses/facePasses.service.js";
import { TimeOffService } from "../timeOff/timeOff.service.js";
import { generateAttendanceReport } from "../../utils/attendanceUtils.js";

function countWorkdaysInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// Private: generate sheet + all items in DB, returns sheet metadata
async function _generateSheet(userId, year, month, monthStr) {
  const totalWorkDays = countWorkdaysInMonth(year, month);
  const start_date = new Date(year, month - 1, 0, 0, 0, 0);
  const end_date   = new Date(year, month, 1, 23, 59, 59);

  const empResult = await EmployeeSalaryHistoryModel.getEmployeesWithCurrentSalary({
    skip: 0,
    take: 9999,
    where: { status: true },
  });

  const employees = empResult.data;

  const sheet = await PayrollModel.createSheet({
    month,
    year,
    status: "draft",
    added_by: userId,
  });

  if (!employees.length) return sheet;

  const employeeIds = employees.map((e) => e.id);

  // ── Carry-over from previous month (salary balance + excess-advance debt) ──
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevSheet = await PayrollModel.findByMonthYear(prevMonth, prevYear);
  // employee_id → { salary: number, debt: number }
  const carryOverMap = new Map();
  if (prevSheet) {
    const prevItems = await PayrollModel.getItemsForEmployees(prevSheet.id, employeeIds);
    for (const it of prevItems) {
      const prevTotal   = Number(it.salary_balance || 0) + Number(it.net || 0);
      const prevAdvance = Number(it.advance_total  || 0);
      const prevPaid    = Number(it.paid_amount    || 0) + prevAdvance;
      const carry       = parseFloat((prevTotal - prevPaid).toFixed(2));
      if (carry > 0)       carryOverMap.set(it.employee_id, { salary: carry, debt: 0 });
      else if (carry < 0)  carryOverMap.set(it.employee_id, { salary: 0, debt: parseFloat((-carry).toFixed(2)) });
    }
  }

  // ── Advances given this month ─────────────────────────────────────────────
  const advanceMap = await PayrollModel.getAdvanceTotalsForMonth(year, month, employeeIds);
  // ─────────────────────────────────────────────────────────────────────────

  const [events, timeOffsResult] = await Promise.all([
    FacePassesService.getAll({ userId, filters: { start_date, end_date, employeeIds } }),
    TimeOffService.getAll({ userId, filters: { employeeIds } }),
  ]);

  const attendance = generateAttendanceReport(events, timeOffsResult, monthStr);
  const attMap = new Map(attendance.map((a) => [String(a.employeeId), a]));

  const items = employees.map((emp) => {
    const salary     = emp.employeeSalaryHistory?.[0];
    const baseSalary = salary ? Number(salary.amount) : 0;
    const salaryType = salary?.salary_type || "notSet";
    const att        = attMap.get(String(emp.id));
    const workedDays  = att?.totalWorkedDays  || 0;
    const workedHours = att?.totalWorkedHours || "00:00";

    // Scheduled hours string "HH:MM" or null
    const scheduledMinutes = att?.totalScheduledMinutes || 0;
    const totalWorkHours = scheduledMinutes > 0
      ? `${String(Math.floor(scheduledMinutes / 60)).padStart(2, "0")}:${String(scheduledMinutes % 60).padStart(2, "0")}`
      : null;

    let accrued = 0;
    if (salaryType === "monthly" && totalWorkDays > 0) {
      accrued = parseFloat(((baseSalary / totalWorkDays) * workedDays).toFixed(2));
    } else if (salaryType === "hourly") {
      const [h, m] = workedHours.split(":").map(Number);
      accrued = parseFloat((baseSalary * (h + (m || 0) / 60)).toFixed(2));
    } else if (salaryType === "piecework") {
      accrued = baseSalary;
    }

    // Per-minute rate for late/overtime deductions
    let perMinuteRate = 0;
    if (salaryType === "monthly" && scheduledMinutes > 0) {
      perMinuteRate = baseSalary / scheduledMinutes;
    } else if (salaryType === "hourly") {
      perMinuteRate = baseSalary / 60;
    }

    const lateMinutes     = att?.totalLateTime
      ? (() => { const [h, m] = att.totalLateTime.split(":").map(Number); return h * 60 + m; })()
      : 0;
    const overtimeMinutes = att?.totalOvertimeMinutes || 0;
    const lateAmount      = parseFloat((lateMinutes     * perMinuteRate).toFixed(2));
    const overtimeAmount  = parseFloat((overtimeMinutes * perMinuteRate).toFixed(2));

    return {
      sheet_id: sheet.id,
      employee_id: emp.id,
      base_salary: baseSalary,
      salary_type: salaryType,
      worked_days: workedDays,
      total_work_days: totalWorkDays,
      worked_hours: workedHours,
      total_work_hours: totalWorkHours,
      accrued,
      debt_deduction: 0,
      debt_mode: "skip",
      debt_comment: null,
      manual_adjustment: 0,
      adjustment_comment: null,
      late_minutes: lateMinutes,
      overtime_minutes: overtimeMinutes,
      apply_late: false,
      apply_overtime: false,
      late_amount: lateAmount,
      overtime_amount: overtimeAmount,
      advance_total: advanceMap.get(emp.id) || 0,
      net: accrued,
      salary_balance: (carryOverMap.get(emp.id) || {}).salary || 0,
      paid_amount: 0,
      status: "draft",
      // debt_balance gets existing loans + excess advance from prev month
      debt_balance: (carryOverMap.get(emp.id) || {}).debt || 0,
    };
  });

  await PayrollModel.createItems(items);
  return sheet;
}

// ── Helper: propagate carry-over from a given month to the NEXT month ─────────
//
// Reads the CURRENT state of the employee's item for year/month from DB,
// computes carry = net + salary_balance - paid_amount - advance_total,
// then updates the NEXT month's item's salary_balance / debt_balance.
//
// Call after ANY change that affects net or paid_amount of a sheet item.
//
async function _propagateCarryToNextMonth(employeeId, year, month) {
  const sheet = await PayrollModel.findByMonthYear(month, year);
  if (!sheet) return;

  const item = await PayrollModel.getSheetItemForEmployee(sheet.id, employeeId);
  if (!item) return;

  const net     = Number(item.net || 0);
  const salBal  = Number(item.salary_balance || 0);
  const paidAmt = Number(item.paid_amount || 0);
  const advAmt  = Number(item.advance_total || 0);
  const carry   = parseFloat((net + salBal - paidAmt - advAmt).toFixed(2));

  const nextMonth = month === 12 ? 1  : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  const nextSheet = await PayrollModel.findByMonthYear(nextMonth, nextYear);
  if (!nextSheet) return;

  const nextItem = await PayrollModel.getSheetItemForEmployee(nextSheet.id, employeeId);
  if (!nextItem) return;

  const nextUpdate = {};
  if (carry > 0) {
    if (Math.abs(carry - Number(nextItem.salary_balance || 0)) > 0.001)
      nextUpdate.salary_balance = carry;
    if (Number(nextItem.debt_balance || 0) > 0)
      nextUpdate.debt_balance = 0;
  } else if (carry < 0) {
    const debt = parseFloat((-carry).toFixed(2));
    if (Math.abs(debt - Number(nextItem.debt_balance || 0)) > 0.001)
      nextUpdate.debt_balance = debt;
    if (Number(nextItem.salary_balance || 0) > 0)
      nextUpdate.salary_balance = 0;
  } else {
    if (Number(nextItem.salary_balance || 0) > 0) nextUpdate.salary_balance = 0;
    if (Number(nextItem.debt_balance   || 0) > 0) nextUpdate.debt_balance   = 0;
  }

  // Cap debt_deduction if debt_balance was reduced, and recompute net
  if ("debt_balance" in nextUpdate) {
    const newDebtBal = Number(nextUpdate.debt_balance) || 0;
    const curDebtDed = Number(nextItem.debt_deduction || 0);
    if (curDebtDed > newDebtBal) {
      nextUpdate.debt_deduction = newDebtBal;
      if (newDebtBal === 0) nextUpdate.debt_mode = "skip";
      const adj     = Number(nextItem.manual_adjustment || 0);
      const lateDed = nextItem.apply_late ? Number(nextItem.late_amount || 0) : 0;
      const otBonus = nextItem.apply_overtime ? Number(nextItem.overtime_amount || 0) : 0;
      nextUpdate.net = parseFloat((Number(nextItem.accrued) - newDebtBal + adj - lateDed + otBonus).toFixed(2));
    }
  }

  if (Object.keys(nextUpdate).length > 0)
    await PayrollModel.updateItem(nextItem.id, nextUpdate);
}

// ── Helper: resync a sheet item's advance_total + propagate carry to next month ─
//
// Call after any change to salary_advances for a given employee+month.
// 1. Updates the item's advance_total (sum of advances for that employee/month).
// 2. Recomputes status (auto-paid if advance+paid >= totalDue).
// 3. Propagates carry-over into the next month.
//
async function _resyncSheetItemForEmployee(employeeId, year, month) {
  const sheet = await PayrollModel.findByMonthYear(month, year);
  if (!sheet) return;

  const item = await PayrollModel.getSheetItemForEmployee(sheet.id, employeeId);
  if (!item) return;

  // Recompute advance_total from salary_advances
  const advMap  = await PayrollModel.getAdvanceTotalsForMonth(year, month, [Number(employeeId)]);
  const newAdv  = advMap.get(Number(employeeId)) || 0;
  const net     = Number(item.net || 0);
  const salBal  = Number(item.salary_balance || 0);
  const paidAmt = Number(item.paid_amount || 0);
  const totalDue = net + salBal;

  const itemUpdate = {};
  if (Math.abs(newAdv - Number(item.advance_total || 0)) > 0.001)
    itemUpdate.advance_total = newAdv;

  if (["approved", "paid"].includes(item.status)) {
    const covered    = newAdv + paidAmt;
    const autoStatus = covered >= totalDue ? "paid" : "approved";
    if (autoStatus !== item.status) itemUpdate.status = autoStatus;
  }

  if (Object.keys(itemUpdate).length > 0)
    await PayrollModel.updateItem(item.id, itemUpdate);

  // Propagate updated carry to next month (re-reads from DB to get fresh values)
  await _propagateCarryToNextMonth(employeeId, year, month);
}

// ── Helper: sync prev-month paid_amount when carry-over is paid ────────────────
//
// item        – current month's payroll_sheet_items row
// totalPaid   – sum of all payment logs for this item (after add/delete)
//
// Logic:
//   salary_balance = what was owed from prev month (net_prev + sal_bal_prev - paid_prev)
//   coverage       = min(totalPaid, salary_balance)   ← how much covers prev month
//   prevPaidBefore = prevTotalDue - salary_balance     ← what was already paid in prev month
//   newPrevPaid    = prevPaidBefore + coverage
async function _syncPrevMonthPayment(item, totalPaid) {
  const salaryBal = Number(item.salary_balance || 0);
  if (salaryBal <= 0) return; // no carry-over → nothing to sync

  const sheet = await PayrollModel.findSheetById(item.sheet_id);
  if (!sheet) return;

  const prevMonth = sheet.month === 1 ? 12 : sheet.month - 1;
  const prevYear  = sheet.month === 1 ? sheet.year - 1 : sheet.year;
  const prevSheet = await PayrollModel.findByMonthYear(prevMonth, prevYear);
  if (!prevSheet) return;

  const prevItem = await PayrollModel.findItemBySheetAndEmployee(prevSheet.id, item.employee_id);
  if (!prevItem) return;
  if (!["approved", "paid"].includes(prevItem.status)) return;

  const prevAdvance  = Number(prevItem.advance_total || 0);
  const prevNet      = Number(prevItem.net);
  const prevSalBal   = Number(prevItem.salary_balance || 0);
  const prevTotalDue = prevNet + prevSalBal;

  // How much of the current-month payment covers the carry-over
  const coverage = Math.min(totalPaid, salaryBal);
  // Cash already paid in prev month (excluding advance, which is tracked separately)
  const prevCashBefore = Math.max(0, prevTotalDue - salaryBal - prevAdvance);
  const newPrevPaid    = parseFloat((prevCashBefore + coverage).toFixed(2));
  // Status: check total coverage (cash + advance)
  const newPrevStatus = (newPrevPaid + prevAdvance) >= prevTotalDue ? "paid" : "approved";

  await PayrollModel.updateItem(prevItem.id, {
    paid_amount: newPrevPaid,
    status:      newPrevStatus,
  });
}

export const PayrollService = {
  getOrGenerate: async (userId, monthStr, queryParams = {}) => {
    const [year, month] = monthStr.split("-").map(Number);
    if (!year || !month) return { success: false, message: "Invalid month" };

    const {
      page      = 1,
      pageSize  = 50,
      search    = "",
      branch_id = "",
      department_id = "",
      position_id   = "",
      salary_type   = "",
      item_status   = "",
      sort_by    = "last_name",
      sort_order = "asc",
    } = queryParams;

    let sheet = await PayrollModel.findByMonthYear(month, year);
    if (!sheet) {
      sheet = await _generateSheet(userId, year, month, monthStr);
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [{ items, total }, stats] = await Promise.all([
      PayrollModel.getSheetItems(sheet.id, {
        search, branch_id, department_id, position_id, salary_type, item_status,
        sort_by, sort_order, skip, take,
      }),
      PayrollModel.getSheetStats(sheet.id),
    ]);

    return {
      success: true,
      data: {
        id: sheet.id,
        month: sheet.month,
        year: sheet.year,
        status: sheet.status,
        items,
        stats,
      },
      pagination: {
        total,
        totalPages: Math.ceil(total / take) || 1,
        currentPage: Number(page),
        pageSize: Number(pageSize),
      },
    };
  },

  updateItem: async (itemId, payload) => {
    const item = await PayrollModel.findItemById(itemId);
    if (!item) return { success: false, message: "Item not found" };

    let debtDeduction =
      payload.debt_deduction !== undefined
        ? Number(payload.debt_deduction)
        : Number(item.debt_deduction);

    // Cap debt_deduction if debt_balance is being explicitly reduced below it
    let debtDeductionShouldSave = payload.debt_deduction !== undefined;
    if (payload.debt_balance !== undefined) {
      const newDebtBal = Number(payload.debt_balance);
      if (debtDeduction > newDebtBal) {
        debtDeduction = newDebtBal;
        debtDeductionShouldSave = true;
      }
    }

    // Hard cap: debt_deduction cannot exceed accrued + salary_balance (net would go below -salary_balance)
    const maxDebt = Number(item.accrued) + Number(item.salary_balance || 0);
    if (debtDeduction > maxDebt) {
      debtDeduction = parseFloat(maxDebt.toFixed(2));
      debtDeductionShouldSave = true;
    }

    const adjustment =
      payload.manual_adjustment !== undefined
        ? Number(payload.manual_adjustment)
        : Number(item.manual_adjustment);
    const applyLate =
      payload.apply_late !== undefined ? payload.apply_late : item.apply_late;
    const applyOvertime =
      payload.apply_overtime !== undefined ? payload.apply_overtime : item.apply_overtime;

    const lateDeduction  = applyLate     ? Number(item.late_amount)     : 0;
    const overtimeBonus  = applyOvertime ? Number(item.overtime_amount)  : 0;
    const net = Number(item.accrued) - debtDeduction + adjustment - lateDeduction + overtimeBonus;

    const data = { net };
    if (payload.debt_balance       !== undefined) data.debt_balance       = Number(payload.debt_balance);
    if (debtDeductionShouldSave)                  data.debt_deduction     = debtDeduction;
    if (debtDeductionShouldSave && debtDeduction === 0 && payload.debt_mode === undefined)
                                                  data.debt_mode          = "skip";
    if (payload.debt_mode          !== undefined) data.debt_mode          = payload.debt_mode;
    if (payload.debt_comment       !== undefined) data.debt_comment       = payload.debt_comment;
    if (payload.manual_adjustment  !== undefined) data.manual_adjustment  = adjustment;
    if (payload.adjustment_comment !== undefined) data.adjustment_comment = payload.adjustment_comment;
    if (payload.apply_late         !== undefined) data.apply_late         = applyLate;
    if (payload.apply_overtime     !== undefined) data.apply_overtime     = applyOvertime;

    // Partial payment: auto-set status when paid_amount is updated
    if (payload.paid_amount !== undefined) {
      const paidAmt      = Math.max(0, Number(payload.paid_amount));
      const salaryBal    = Number(item.salary_balance || 0);
      const totalDue     = net + salaryBal;
      data.paid_amount   = parseFloat(paidAmt.toFixed(2));
      if (["approved", "paid"].includes(item.status)) {
        data.status = paidAmt >= totalDue ? "paid" : "approved";
      }
    }

    const oldNet = Number(item.net || 0);
    const updated = await PayrollModel.updateItem(itemId, data);

    // If net changed (debt_deduction / adjustment / flags), propagate carry to next month
    if (Math.abs(net - oldNet) > 0.001) {
      const sheet = await PayrollModel.findSheetById(item.sheet_id);
      if (sheet) await _propagateCarryToNextMonth(item.employee_id, sheet.year, sheet.month);
    }

    return { success: true, data: updated };
  },

  bulkApplyFlags: async (sheetId, { apply_late, apply_overtime }) => {
    await PayrollModel.bulkApplyFlags(sheetId, { apply_late, apply_overtime });
    return { success: true };
  },

  bulkUpdateStatus: async (itemIds, status) => {
    if (!Array.isArray(itemIds) || !itemIds.length)
      return { success: false, message: "No items" };
    if (!["approved", "draft"].includes(status))
      return { success: false, message: "Invalid status" };
    await PayrollModel.bulkUpdateStatus(itemIds, status);
    return { success: true, count: itemIds.length };
  },

  updateAllItemsStatus: async (sheetId, status) => {
    if (!["approved", "draft"].includes(status))
      return { success: false, message: "Invalid status" };
    await PayrollModel.updateAllItemsStatus(sheetId, status);
    return { success: true };
  },

  // ── Payouts ───────────────────────────────────────────────────────────────────

  getPayouts: async (monthStr, queryParams = {}) => {
    const [year, month] = monthStr.split("-").map(Number);
    if (!year || !month) return { success: false, message: "Invalid month" };

    const sheet = await PayrollModel.findByMonthYear(month, year);
    if (!sheet) return { success: true, data: null, pagination: { total: 0, totalPages: 1, currentPage: 1, pageSize: 50 } };

    const {
      page          = 1,
      pageSize      = 50,
      search        = "",
      branch_id     = "",
      department_id = "",
      position_id   = "",
      salary_type   = "",
      payout_status = "",
      sort_by       = "last_name",
      sort_order    = "asc",
    } = queryParams;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [{ items, total }, stats] = await Promise.all([
      PayrollModel.getPayoutItems(sheet.id, {
        search, branch_id, department_id, position_id,
        salary_type, payout_status,
        sort_by, sort_order, skip, take,
      }),
      PayrollModel.getPayoutsStats(sheet.id),
    ]);

    return {
      success: true,
      data: { id: sheet.id, month: sheet.month, year: sheet.year, items, stats },
      pagination: {
        total,
        totalPages:  Math.ceil(total / take) || 1,
        currentPage: Number(page),
        pageSize:    Number(pageSize),
      },
    };
  },

  bulkMarkPaid: async (itemIds, status) => {
    if (!Array.isArray(itemIds) || !itemIds.length)
      return { success: false, message: "No items" };
    if (!["approved", "paid"].includes(status))
      return { success: false, message: "Invalid status" };
    await PayrollModel.bulkMarkPaid(itemIds, status);
    return { success: true, count: itemIds.length };
  },

  markAllPayoutsStatus: async (sheetId, status) => {
    if (!["approved", "paid"].includes(status))
      return { success: false, message: "Invalid status" };
    await PayrollModel.markAllPayoutsStatus(sheetId, status);
    return { success: true };
  },

  // ── Payment logs ─────────────────────────────────────────────────────────────

  getPaymentLogs: async (itemId) => {
    const logs = await PayrollModel.getPaymentLogs(itemId);
    return { success: true, data: logs };
  },

  addPaymentLog: async (itemId, { amount, payment_date, note }) => {
    if (!amount || Number(amount) <= 0) return { success: false, message: "Invalid amount" };
    if (!payment_date) return { success: false, message: "payment_date required" };

    const item = await PayrollModel.findItemById(itemId);
    if (!item) return { success: false, message: "Item not found" };

    const { totalPaid } = await PayrollModel.addPaymentLog(itemId, { amount, payment_date, note });

    const net      = Number(item.net);
    const salBal   = Number(item.salary_balance || 0);
    const advance  = Number(item.advance_total  || 0);
    const totalDue = net + salBal;
    const newStatus = ["approved", "paid"].includes(item.status)
      ? ((totalPaid + advance) >= totalDue ? "paid" : "approved")
      : item.status;

    const updated = await PayrollModel.updateItem(itemId, {
      paid_amount: parseFloat(totalPaid.toFixed(2)),
      status:      newStatus,
    });

    // Propagate payment to previous month if carry-over exists
    await _syncPrevMonthPayment(item, totalPaid);

    // Propagate updated carry to next month
    const sheetAdd = await PayrollModel.findSheetById(item.sheet_id);
    if (sheetAdd) await _propagateCarryToNextMonth(item.employee_id, sheetAdd.year, sheetAdd.month);

    return { success: true, data: updated };
  },

  deletePaymentLog: async (logId, itemId) => {
    const item = await PayrollModel.findItemById(itemId);
    if (!item) return { success: false, message: "Item not found" };

    const { totalPaid } = await PayrollModel.deletePaymentLog(logId, itemId);

    const net      = Number(item.net);
    const salBal   = Number(item.salary_balance || 0);
    const advance  = Number(item.advance_total  || 0);
    const totalDue = net + salBal;
    const newStatus = ["approved", "paid"].includes(item.status)
      ? ((totalPaid + advance) >= totalDue ? "paid" : "approved")
      : item.status;

    const updated = await PayrollModel.updateItem(itemId, {
      paid_amount: parseFloat(totalPaid.toFixed(2)),
      status:      newStatus,
    });

    // Recalculate previous month after deletion
    await _syncPrevMonthPayment(item, totalPaid);

    // Propagate updated carry to next month
    const sheetDel = await PayrollModel.findSheetById(item.sheet_id);
    if (sheetDel) await _propagateCarryToNextMonth(item.employee_id, sheetDel.year, sheetDel.month);

    return { success: true, data: updated };
  },

  recalculateSalaryBalances: async (sheetId) => {
    const sheet = await PayrollModel.findSheetById(sheetId);
    if (!sheet) return { success: false, message: "Sheet not found" };

    const currentItems = await PayrollModel.getAllSheetItems(sheetId);
    const employeeIds  = currentItems.map((it) => it.employee_id);

    // Sync advance_total from salary_advances for this month
    const advanceMap = await PayrollModel.getAdvanceTotalsForMonth(sheet.year, sheet.month, employeeIds);

    // Carry-over from prev month (accounting for prev advance_total)
    const prevMonth = sheet.month === 1 ? 12 : sheet.month - 1;
    const prevYear  = sheet.month === 1 ? sheet.year - 1 : sheet.year;
    const prevSheet = await PayrollModel.findByMonthYear(prevMonth, prevYear);
    // employee_id → { salary, debt }
    const carryMap = new Map();
    if (prevSheet) {
      const prevItems = await PayrollModel.getItemsForEmployees(prevSheet.id, employeeIds);
      for (const it of prevItems) {
        const prevTotal   = Number(it.salary_balance || 0) + Number(it.net || 0);
        const prevAdvance = Number(it.advance_total  || 0);
        const prevPaid    = Number(it.paid_amount    || 0) + prevAdvance;
        const carry       = parseFloat((prevTotal - prevPaid).toFixed(2));
        if (carry > 0)      carryMap.set(it.employee_id, { salary: carry, debt: 0 });
        else if (carry < 0) carryMap.set(it.employee_id, { salary: 0, debt: parseFloat((-carry).toFixed(2)) });
      }
    }

    let updated = 0;
    for (const item of currentItems) {
      const advance  = advanceMap.get(item.employee_id) || 0;
      const carry    = carryMap.get(item.employee_id) || { salary: 0, debt: 0 };

      const updateData = {};

      if (Math.abs(advance - Number(item.advance_total || 0)) > 0.001)
        updateData.advance_total = advance;

      if (Math.abs(carry.salary - Number(item.salary_balance || 0)) > 0.001)
        updateData.salary_balance = carry.salary;

      // Only update debt_balance from advance debt if item was freshly generated (debt_balance == 0)
      // or existing debt_balance matches the previous advance_debt (avoid overwriting manual debts)
      if (carry.debt > 0 && Math.abs(carry.debt - Number(item.debt_balance || 0)) > 0.001)
        updateData.debt_balance = carry.debt;

      // Cap debt_deduction if debt_balance changed to a lower value, and recompute net
      const newDebtBal = "debt_balance" in updateData ? Number(updateData.debt_balance) : Number(item.debt_balance || 0);
      const curDebtDed = Number(item.debt_deduction || 0);
      if (curDebtDed > newDebtBal) {
        updateData.debt_deduction = newDebtBal;
        if (newDebtBal === 0) updateData.debt_mode = "skip";
        const adj     = Number(item.manual_adjustment || 0);
        const lateDed = item.apply_late ? Number(item.late_amount || 0) : 0;
        const otBonus = item.apply_overtime ? Number(item.overtime_amount || 0) : 0;
        updateData.net = parseFloat((Number(item.accrued) - newDebtBal + adj - lateDed + otBonus).toFixed(2));
      }

      // Auto-mark paid if advance now covers everything
      if (["approved", "paid"].includes(item.status)) {
        const net      = Number(item.net);
        const salBal   = carry.salary;
        const totalDue = net + salBal;
        const paidAmt  = Number(item.paid_amount || 0);
        const totalCov = advance + paidAmt;
        const autoStatus = totalCov >= totalDue ? "paid" : "approved";
        if (autoStatus !== item.status) updateData.status = autoStatus;
      }

      if (Object.keys(updateData).length > 0) {
        await PayrollModel.updateItem(item.id, updateData);
        updated++;
      }
    }

    return { success: true, updated };
  },

  approveSheet: async (id, userId) => {
    const updated = await PayrollModel.approveSheet(id, userId);
    return { success: true, data: updated };
  },

  deleteSheet: async (id) => {
    await PayrollModel.deleteSheet(id);
    return { success: true };
  },

  // ── Salary Advances ──────────────────────────────────────────────────────────

  getAdvances: async (month, {
    page          = 1,
    pageSize      = 50,
    search        = "",
    branch_id     = "",
    department_id = "",
    position_id   = "",
    sort_by       = "advance_date",
    sort_order    = "desc",
  } = {}) => {
    const [yearStr, monthStr] = month.split("-");
    const year  = Number(yearStr);
    const mon   = Number(monthStr);
    const size  = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
    const pg    = Math.max(Number(page) || 1, 1);
    const skip  = (pg - 1) * size;

    const [{ advances, total }, stats] = await Promise.all([
      PayrollModel.getAdvances({ year, month: mon, search, branch_id, department_id, position_id, sort_by, sort_order, skip, take: size }),
      PayrollModel.getAdvancesStats({ year, month: mon }),
    ]);

    return {
      success: true,
      data: { advances, stats },
      pagination: {
        currentPage: pg,
        totalPages:  Math.ceil(total / size) || 1,
        total,
        pageSize:    size,
      },
    };
  },

  createAdvances: async (userId, advances) => {
    if (!Array.isArray(advances) || advances.length === 0)
      return { success: false, message: "No advances provided" };

    const rows = advances.map((a) => ({
      employee_id:  Number(a.employee_id),
      amount:       parseFloat(Number(a.amount).toFixed(2)),
      advance_date: new Date(a.advance_date),
      note:         a.note?.trim() || null,
      given_by:     userId,
    }));

    await PayrollModel.createAdvances(rows);
    return { success: true };
  },

  deleteAdvance: async (id) => {
    const adv = await PayrollModel.findAdvanceById(id);
    await PayrollModel.deleteAdvance(id);
    if (adv) {
      const d = new Date(adv.advance_date);
      await _resyncSheetItemForEmployee(adv.employee_id, d.getFullYear(), d.getMonth() + 1);
    }
    return { success: true };
  },

  updateAdvance: async (id, data) => {
    const old = await PayrollModel.findAdvanceById(id);
    const updated = await PayrollModel.updateAdvance(id, data);

    if (old) {
      const oldD = new Date(old.advance_date);
      await _resyncSheetItemForEmployee(old.employee_id, oldD.getFullYear(), oldD.getMonth() + 1);

      // If employee or month changed, also sync the new target
      const newEmpId = Number(data.employee_id ?? old.employee_id);
      const newDate  = data.advance_date ? new Date(data.advance_date) : oldD;
      const newYear  = newDate.getFullYear();
      const newMonth = newDate.getMonth() + 1;
      const empChanged   = newEmpId !== Number(old.employee_id);
      const monthChanged = newYear !== oldD.getFullYear() || newMonth !== (oldD.getMonth() + 1);
      if (empChanged || monthChanged)
        await _resyncSheetItemForEmployee(newEmpId, newYear, newMonth);
    }

    return { success: true, data: updated };
  },
};
