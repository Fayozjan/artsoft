import { PayrollModel } from "./payroll.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

// Resolves payout_status: unpaid → partially_paid → paid
function _resolvePayStatus(covered, totalDue, currentPayoutStatus) {
  if (!["unpaid", "paid", "partially_paid"].includes(currentPayoutStatus)) return currentPayoutStatus;
  if (covered >= totalDue) return "paid";
  if (covered > 0) return "partially_paid";
  return "unpaid";
}

// Сколько по строке ещё положено выдать деньгами.
//
// `net` — чистое «на руки» за месяц, долг его больше НЕ уменьшает: удержание
// живёт отдельным полем и вычитается только здесь. Так «на руки» остаётся
// суммой, которую человек заработал, а погашение долга видно отдельной строкой.
function _dueOf(item) {
  return parseFloat(
    (Number(item.net || 0) - Number(item.debt_deduction || 0)).toFixed(2),
  );
}

// Payments cannot be dated in the future — compared against the end of today
function _isFutureDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return d > endOfToday;
}
import { EmployeeSalaryHistoryModel } from "../employeeSalaryHistory/employeeSalaryHistory.model.js";
import { EmployeeWorkScheduleHistoryModel } from "../employeeScheduleHistory/employeeScheduleHistory.model.js";
import { FacePassesService } from "../facePasses/facePasses.service.js";
import { TimeOffService } from "../timeOff/timeOff.service.js";
import { generateAttendanceReport } from "../../utils/attendanceUtils.js";
import { getDaysInRange } from "../productionCalendar/productionCalendar.model.js";
import {
  DAY_TYPES,
  buildCalendarContext,
  resolveDays,
} from "../../utils/productionCalendar.utils.js";

// Добавляет синтетические записи в events для сотрудников без проходов,
// чтобы generateAttendanceReport мог обработать их отгулы.
async function _augmentEventsWithMissingEmployees(events, employees) {
  const eventsIds = new Set(events.map((e) => String(e.employeeId)));
  const missing = employees.filter((emp) => !eventsIds.has(String(emp.id)));
  if (!missing.length) return;

  const scheduleHistories = await EmployeeWorkScheduleHistoryModel.findByEmployeeIds(
    missing.map((e) => e.id),
  );

  const schedByEmp = {};
  for (const sh of scheduleHistories) {
    const eid = String(sh.employee_id);
    if (!schedByEmp[eid]) schedByEmp[eid] = [];
    schedByEmp[eid].push(sh);
  }

  for (const emp of missing) {
    events.push({
      employeeId: emp.id,
      employeeNumber: emp.employee_number ?? null,
      employeeFullName:
        [emp.last_name, emp.first_name, emp.middle_name]
          .filter(Boolean)
          .join(" ") + ` (${emp.id})`,
      employeePhoto: emp.photo ?? null,
      branchName: emp.branch?.name ?? null,
      departmentName: emp.department?.name ?? null,
      positionName: emp.position?.name ?? null,
      pinfl: emp.pinfl ?? null,
      workScheduleName: emp.workSchedule?.name ?? null,
      workSchedule: schedByEmp[String(emp.id)] ?? null,
      events: [],
    });
  }
}

// Переопределения производственного календаря за месяц
async function _getMonthCalendar(year, month) {
  return getDaysInRange(
    new Date(Date.UTC(year, month - 1, 1)),
    new Date(Date.UTC(year, month, 0, 23, 59, 59)),
  );
}

// Норма рабочих дней месяца ДЛЯ СОТРУДНИКА БЕЗ ГРАФИКА.
// Обычно норма берётся из его work_schedules (att.totalScheduledDays), но если
// график не назначен, отчёт даёт 0 — окладник получил бы нулевое начисление.
// Запасное правило: Пн–Сб минус нерабочие дни производственного календаря.
function countFallbackWorkdays(year, month, calendarOverrides) {
  const days = resolveDays(
    new Date(Date.UTC(year, month - 1, 1)),
    new Date(Date.UTC(year, month, 0)),
    calendarOverrides,
  );

  return days.filter((d) => {
    if (d.day_type === DAY_TYPES.HOLIDAY || d.day_type === DAY_TYPES.WEEKEND) {
      return false;
    }
    return new Date(`${d.date}T00:00:00Z`).getUTCDay() !== 0;
  }).length;
}

// Норма дней сотрудника: плановые дни его графика за месяц (праздники и
// выходные календаря уже вычтены в generateAttendanceReport). Ноль означает,
// что графика нет — тогда берётся запасное правило.
function resolveTotalWorkDays(attendance, fallbackWorkDays) {
  const scheduled = attendance?.totalScheduledDays || 0;
  return scheduled > 0 ? scheduled : fallbackWorkDays;
}

// Private: generate sheet + all items in DB, returns sheet metadata
async function _generateSheet(userId, year, month, monthStr) {
  const calendarOverrides = await _getMonthCalendar(year, month);
  const fallbackWorkDays = countFallbackWorkdays(year, month, calendarOverrides);
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

  // ── Carry-over from previous month (salary balance / debt) ────────────────
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevSheet = await PayrollModel.findByMonthYear(prevMonth, prevYear);
  // employee_id → { salary: number, debt: number }
  const carryOverMap = new Map();
  if (prevSheet) {
    const prevItems = await PayrollModel.getItemsForEmployees(prevSheet.id, employeeIds);

  }

  const [events, timeOffsResult] = await Promise.all([
    FacePassesService.getAll({ userId, filters: { start_date, end_date, employeeIds } }),
    TimeOffService.getAll({ userId, filters: { employeeIds } }),
  ]);

  await _augmentEventsWithMissingEmployees(events, employees);

  // производственный календарь — чтобы норма часов (totalScheduledMinutes) не
  // включала нерабочие дни: от неё считается perMinuteRate для опозданий/сверхурочных
  const attendance = generateAttendanceReport(
    events,
    timeOffsResult,
    monthStr,
    null,
    buildCalendarContext(calendarOverrides),
  );
  const attMap = new Map(attendance.map((a) => [String(a.employeeId), a]));

  const items = employees.map((emp) => {
    const salary     = emp.employeeSalaryHistory?.[0];
    const baseSalary = salary ? Number(salary.amount) : 0;
    const salaryType = salary?.salary_type || "notSet";
    const att        = attMap.get(String(emp.id));
    const workedDays  = att?.totalWorkedDays  || 0;
    const workedHours = att?.totalWorkedHours || "00:00";
    // Норма дней — по графику этого сотрудника, а не общая по компании
    const totalWorkDays = resolveTotalWorkDays(att, fallbackWorkDays);

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
      net: accrued,
      // Переносов нет: остаток месяца остаётся на своём месяце
      salary_balance: 0,
      paid_amount: 0,
      status: "draft",
      // debt_balance gets existing loans + overpayment from prev month
      debt_balance: 0,
    };
  });

  await PayrollModel.createItems(items);
  return sheet;
}

// Сколько денег месяц передаёт следующему.
// Черновой месяц в зарплату не входит: его начисление не переносится и ничего
// им не закрывается — остаток проходит насквозь. Но выданный в нём аванс это
// реальные деньги, поэтому он уезжает вперёд и становится долгом сотрудника.
// Возвращает { salary, debt } — что месяц передаёт следующему.
//
// Две величины считаются раздельно и НЕ сальдируются между собой:
// невыплаченная зарплата не гасит долг сама по себе. Долг уменьшает только
// `debt_deduction` — реальное удержание. Иначе месяц с начислением 3 млн и
// долгом 8 млн молча превращался бы в долг 5 млн, хотя сотруднику эти 3 млн
// так и не выдали.
// Переносов больше нет: месяц закрывается сам в себе. Функция оставлена, чтобы
// пересчёт остатков обнулял `salary_balance` и `debt_balance` со старых данных.
// Невыплаченный остаток остаётся на своём месяце, переплата попадает в общий
// долг сотрудника — он считается по всем строкам сразу, а не переносом.
function _carryFromItem() {
  return { salary: 0, debt: 0 };
}

// Переплата месяца: выдали больше, чем осталось выплатить по нему
function _overpayOf(item) {
  const due = Number(item.net || 0) - Number(item.debt_deduction || 0);
  return Math.max(0, Number(item.paid_amount || 0) - due);
}

// Непогашенный долг сотрудника — одна копилка на всё:
//   выданные займы + переплаты по месяцам − удержания
// Переносов между месяцами нет, поэтому считается по всем строкам сразу.
// `excludeItemId` исключает строку, удержание которой сейчас пересчитывается,
// иначе она вычла бы саму себя.
async function _debtOutstanding(employeeId, excludeItemId = null) {
  const [debts, items] = await Promise.all([
    PayrollModel.getDebtsByEmployee(employeeId),
    PayrollModel.getEmployeeItemsSummary(employeeId),
  ]);

  const loans = debts.reduce((s, d) => s + Number(d.amount || 0), 0);
  let overpay = 0;
  let repaid = 0;
  for (const it of items) {
    if (Number(it.id) === Number(excludeItemId)) continue;
    overpay += _overpayOf(it);
    repaid += Number(it.debt_deduction || 0);
  }

  return parseFloat(Math.max(0, loans + overpay - repaid).toFixed(2));
}

// Авансы черновых строк — у утверждённых они уже сидят в paid_amount
async function _draftAdvances(items) {
  const draftIds = items.filter((it) => it.status !== "approved").map((it) => it.id);
  if (!draftIds.length) return new Map();
  return PayrollModel.getAdvanceTotals(draftIds);
}

// Перенос в виде { salary, debt } — так его ждут поля salary_balance / debt_balance
// ── Helper: propagate carry-over from a given month to the NEXT month ─────────
//
// Reads the CURRENT state of the employee's item for year/month from DB,
// computes carry = net + salary_balance - paid_amount,
// then updates the NEXT month's item's salary_balance / debt_balance.
//
// Call after ANY change that affects net or paid_amount of a sheet item.
//
// Walks the carry-over forward month by month. A single step is not enough:
// paying an early month changes every later balance in the chain, so we keep
// going until a month needs no update or the chain ends.
async function _propagateCarryToNextMonth(employeeId, year, month) {
  let curYear = year;
  let curMonth = month;

  for (let step = 0; step < 24; step++) {
    const moved = await _carryOneStep(employeeId, curYear, curMonth);
    if (!moved) return;
    curYear = moved.year;
    curMonth = moved.month;
  }
}

// Pushes one month's carry onto the next one.
// Returns the next month when it was updated, null when the chain stops.
async function _carryOneStep(employeeId, year, month) {
  const sheet = await PayrollModel.findByMonthYear(month, year);
  if (!sheet) return null;

  const item = await PayrollModel.getSheetItemForEmployee(sheet.id, employeeId);
  if (!item) return null;

  const advances = await _draftAdvances([item]);
  const carry = _carryFromItem(item, advances.get(item.id));

  const nextMonth = month === 12 ? 1  : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  const nextSheet = await PayrollModel.findByMonthYear(nextMonth, nextYear);
  if (!nextSheet) return null;

  const nextItem = await PayrollModel.getSheetItemForEmployee(nextSheet.id, employeeId);
  if (!nextItem) return null;

  // Зарплатный остаток и долг живут в строке одновременно: сотруднику могут
  // быть должны за месяц и при этом он сам должен за аванс
  const nextUpdate = {};
  if (Math.abs(carry.salary - Number(nextItem.salary_balance || 0)) > 0.001)
    nextUpdate.salary_balance = carry.salary;
  if (Math.abs(carry.debt - Number(nextItem.debt_balance || 0)) > 0.001)
    nextUpdate.debt_balance = carry.debt;

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
      nextUpdate.net = parseFloat((Number(nextItem.accrued) + adj - lateDed + otBonus).toFixed(2));
    }
  }

  if (Object.keys(nextUpdate).length === 0) return null;

  await PayrollModel.updateItem(nextItem.id, nextUpdate);
  return { year: nextYear, month: nextMonth };
}

// Перенос остатка ОДНОГО сотрудника из предыдущего месяца.
// Та же формула, что и в _generateSheet / _doRecalcBalances, но для одной строки:
// нужна, когда строка создаётся отдельно — при выдаче аванса за месяц, в
// ведомости которого сотрудника ещё нет.
async function _carryForEmployee(employeeId, year, month) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevSheet = await PayrollModel.findByMonthYear(prevMonth, prevYear);
  if (!prevSheet) return { salary: 0, debt: 0 };

  const prevItem = await PayrollModel.findItemBySheetAndEmployee(prevSheet.id, employeeId);
  if (!prevItem) return { salary: 0, debt: 0 };

  const advances = await _draftAdvances([prevItem]);
  return _carryFromItem(prevItem, advances.get(prevItem.id));
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
  if (prevItem.status !== "approved") return;

  const prevTotalDue = _dueOf(prevItem);

  // How much of the current-month payment covers the carry-over
  const coverage = Math.min(totalPaid, salaryBal);
  // Cash already paid in prev month
  const prevCashBefore = Math.max(0, prevTotalDue - salaryBal);
  const newPrevPaid    = parseFloat((prevCashBefore + coverage).toFixed(2));
  const newPrevPayoutStatus = _resolvePayStatus(newPrevPaid, prevTotalDue, prevItem.payout_status);

  await PayrollModel.updateItem(prevItem.id, {
    paid_amount:   newPrevPaid,
    payout_status: newPrevPayoutStatus,
  });
}

// ── Private: recalculate carry-over balances for one sheet ────────────────────
async function _doRecalcBalances(sheetId) {
  const sheet = await PayrollModel.findSheetById(sheetId);
  if (!sheet) return { updated: 0 };

  const currentItems = await PayrollModel.getAllSheetItems(sheetId);
  const employeeIds  = currentItems.map((it) => it.employee_id);

  const prevMonth = sheet.month === 1 ? 12 : sheet.month - 1;
  const prevYear  = sheet.month === 1 ? sheet.year - 1 : sheet.year;
  const prevSheet = await PayrollModel.findByMonthYear(prevMonth, prevYear);
  const carryMap  = new Map();
  if (prevSheet) {
    const prevItems = await PayrollModel.getItemsForEmployees(prevSheet.id, employeeIds);
    const prevAdvances = await _draftAdvances(prevItems);
    for (const it of prevItems) {
      const carry = _carryFromItem(it, prevAdvances.get(it.id));
      if (carry.salary > 0 || carry.debt > 0) carryMap.set(it.employee_id, carry);
    }
  }

  let updated = 0;
  for (const item of currentItems) {
    const carry = carryMap.get(item.employee_id) || { salary: 0, debt: 0 };
    const updateData = {};

    if (Math.abs(carry.salary - Number(item.salary_balance || 0)) > 0.001)
      updateData.salary_balance = carry.salary;
    // Ноль тоже пишем: погашенный долг обязан обнулиться, иначе он снова уедет
    // вперёд — теперь непокрытый остаток участвует в переносе
    if (Math.abs(carry.debt - Number(item.debt_balance || 0)) > 0.001)
      updateData.debt_balance = carry.debt;

    const newDebtBal = "debt_balance" in updateData ? Number(updateData.debt_balance) : Number(item.debt_balance || 0);
    const curDebtDed = Number(item.debt_deduction || 0);
    if (curDebtDed > newDebtBal) {
      updateData.debt_deduction = newDebtBal;
      if (newDebtBal === 0) updateData.debt_mode = "skip";
      const adj     = Number(item.manual_adjustment || 0);
      const lateDed = item.apply_late ? Number(item.late_amount || 0) : 0;
      const otBonus = item.apply_overtime ? Number(item.overtime_amount || 0) : 0;
      updateData.net = parseFloat((Number(item.accrued) + adj - lateDed + otBonus).toFixed(2));
    }

    if (item.status === "approved") {
      const totalDue = _dueOf({
        net: updateData.net ?? item.net,
        salary_balance: carry.salary,
        debt_deduction: updateData.debt_deduction ?? item.debt_deduction,
      });
      const paidAmt    = Number(item.paid_amount || 0);
      const autoStatus = _resolvePayStatus(paidAmt, totalDue, item.payout_status);
      if (autoStatus !== item.payout_status) updateData.payout_status = autoStatus;
    }

    if (Object.keys(updateData).length > 0) {
      await PayrollModel.updateItem(item.id, updateData);
      updated++;
    }
  }
  return { updated };
}

// ── Private: cascade recalculate balances for all subsequent months ────────────
async function _cascadeRecalculate(sheetId) {
  const sheet = await PayrollModel.findSheetById(sheetId);
  if (!sheet) return;
  let { year, month } = sheet;
  for (let i = 0; i < 24; i++) {
    const nm   = month === 12 ? 1 : month + 1;
    const ny   = month === 12 ? year + 1 : year;
    const next = await PayrollModel.findByMonthYear(nm, ny);
    if (!next) break;
    await _doRecalcBalances(next.id);
    month = nm;
    year  = ny;
  }
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

  updateItem: async (itemId, payload, userId) => {
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

    const adjustment =
      payload.manual_adjustment !== undefined
        ? Number(payload.manual_adjustment)
        : Number(item.manual_adjustment);

    // Вычет корректировкой не может увести начисление в минус: accrued + adjustment >= 0
    if (payload.manual_adjustment !== undefined) {
      if (!Number.isFinite(adjustment)) return { success: false, message: "adjustmentInvalid" };
      if (adjustment < -Number(item.accrued)) return { success: false, message: "adjustmentExceedsAccrued" };
    }

    const applyLate =
      payload.apply_late !== undefined ? payload.apply_late : item.apply_late;
    const applyOvertime =
      payload.apply_overtime !== undefined ? payload.apply_overtime : item.apply_overtime;

    const lateDeduction  = applyLate     ? Number(item.late_amount)     : 0;
    const overtimeBonus  = applyOvertime ? Number(item.overtime_amount)  : 0;

    // «На руки» до удержания долга: начисление с корректировкой, опозданиями и
    // сверхурочными
    const netWithoutDebt =
      Number(item.accrued) + adjustment - lateDeduction + overtimeBonus;

    // Удерживаем только из того, что реально осталось выплатить по этому месяцу.
    // Считать от `accrued` нельзя: опоздания и корректировки уже съели часть
    // суммы, а выданный аванс — часть выплаты.
    const maxDebt = Math.max(
      0,
      netWithoutDebt - Number(item.paid_amount || 0),
    );
    if (debtDeduction > maxDebt) {
      debtDeduction = parseFloat(maxDebt.toFixed(2));
      debtDeductionShouldSave = true;
    }

    // Больше самого долга удержать нельзя. Долг общий по сотруднику: займы и
    // переплаты минус уже удержанное, без учёта этой же строки.
    if (payload.debt_deduction !== undefined && debtDeduction > 0) {
      const debtAvailable = await _debtOutstanding(item.employee_id, itemId);
      if (debtDeduction > debtAvailable) {
        debtDeduction = parseFloat(Math.max(0, debtAvailable).toFixed(2));
        debtDeductionShouldSave = true;
      }
    }

    // Долг из «на руки» не вычитается — он уменьшает только сумму к выдаче
    const net = parseFloat(netWithoutDebt.toFixed(2));

    const paidSoFar   = Number(item.paid_amount || 0);
    const newTotalDue = _dueOf({
      net,
      salary_balance: item.salary_balance,
      debt_deduction: debtDeduction,
    });

    // Аванс — предоплата: он закрывает строку до расчёта, поэтому такую строку
    // правим свободно (переплата уедет долгом в следующий месяц). Блокируем
    // только правку вниз по строке, оплаченной уже после расчёта.
    if (item.payout_status === "paid" && payload.paid_amount === undefined) {
      const advances    = await PayrollModel.getAdvanceTotals([itemId]);
      const advancePaid = Number(advances.get(Number(itemId)) || 0);
      const settledPaid = paidSoFar - advancePaid;
      if (settledPaid > newTotalDue + 0.001)
        return { success: false, message: "payoutPaidCannotEdit" };
    }

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
      const totalDue     = newTotalDue;
      data.paid_amount   = parseFloat(paidAmt.toFixed(2));
      if (item.status === "approved") {
        data.payout_status = _resolvePayStatus(paidAmt, totalDue, item.payout_status);
      }
    }
    // Начисление изменилось после выплаты (напр. корректировка поверх аванса) —
    // пересчитываем статус: paid → partially_paid, если появился остаток к выдаче
    else if (item.status === "approved") {
      data.payout_status = _resolvePayStatus(paidSoFar, newTotalDue, item.payout_status);
    }

    const oldNet = Number(item.net || 0);
    const updated = await PayrollModel.updateItem(itemId, data);

    // If net changed (debt_deduction / adjustment / flags), propagate carry to next month
    if (Math.abs(net - oldNet) > 0.001) {
      const sheet = await PayrollModel.findSheetById(item.sheet_id);
      if (sheet) await _propagateCarryToNextMonth(item.employee_id, sheet.year, sheet.month);
    }

    await createAuditLog({
      userId, action: "update", entity: "payroll_sheet_items", recordId: itemId,
      oldData: item, newData: updated,
    });

    return { success: true, data: updated };
  },

  bulkApplyFlags: async (sheetId, { apply_late, apply_overtime }, userId) => {
    await PayrollModel.bulkApplyFlags(sheetId, { apply_late, apply_overtime });
    await createAuditLog({
      userId, action: "update", entity: "payroll_sheet_items", recordId: sheetId,
      newData: { apply_late, apply_overtime },
    });
    return { success: true };
  },

  bulkUpdateStatus: async (itemIds, status, userId) => {
    if (!Array.isArray(itemIds) || !itemIds.length)
      return { success: false, message: "No items" };
    if (!["approved", "draft"].includes(status))
      return { success: false, message: "Invalid status" };
    await PayrollModel.bulkUpdateStatus(itemIds, status);
    if (status === "approved") {
      const firstItem = await PayrollModel.findItemById(itemIds[0]);
      if (firstItem) await _doRecalcBalances(firstItem.sheet_id);
    }
    await createAuditLog({
      userId, action: "update", entity: "payroll_sheet_items",
      newData: { itemIds, status },
    });
    return { success: true, count: itemIds.length };
  },

  updateAllItemsStatus: async (sheetId, status, userId) => {
    if (!["approved", "draft"].includes(status))
      return { success: false, message: "Invalid status" };
    await PayrollModel.updateAllItemsStatus(sheetId, status);
    if (status === "approved") await _doRecalcBalances(sheetId);
    await createAuditLog({
      userId, action: "update", entity: "payroll_sheets", recordId: sheetId,
      newData: { itemsStatus: status },
    });
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

  // Year payout report: one row per employee, expandable into months.
  // Outstanding is taken from the LAST month present, because salary_balance
  // already carries unpaid amounts forward — summing months would double count.
  getPayoutsYearReport: async (year, queryParams = {}) => {
    const y = Number(year);
    if (!y) return { success: false, message: "Invalid year" };

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

    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;

    const emptyStats = {
      employees: 0, accrued: 0, net: 0, paid: 0,
      debt_deduction: 0, outstanding: 0, current_net: 0, current_base: 0,
      advance: 0, advance_balance: 0,
    };

    const sheets = await PayrollModel.findSheetsByYear(y);
    if (!sheets.length) {
      return {
        success: true,
        data: { year: y, months: [], items: [], stats: emptyStats },
        pagination: { total: 0, totalPages: 1, currentPage: Number(page), pageSize: take },
      };
    }

    const rawItems = await PayrollModel.getYearPayoutItems(
      sheets.map((sh) => sh.id),
      { search, branch_id, department_id, position_id, salary_type },
    );

    // Авансы лежат в payment logs с флагом is_advance — показываем их отдельной
    // суммой, иначе они растворяются в paid_amount
    const itemIds = rawItems.map((it) => it.id);
    const advanceMap = await PayrollModel.getAdvanceTotals(itemIds);


    const byEmployee = new Map();
    for (const it of rawItems) {
      // Неутверждённый месяц виден только потому, что по нему прошла выплата
      // (аванс). Начисления у него ещё нет — иначе черновой расчёт попал бы в
      // «начислено за год» и создал остаток к выплате.
      const approved = it.status === "approved";
      const accrued  = approved ? Number(it.accrued        || 0) : 0;
      const debtDed  = approved ? Number(it.debt_deduction || 0) : 0;
      const paid     = Number(it.paid_amount    || 0);
      const net      = approved ? Number(it.net || 0) : 0;

      let row = byEmployee.get(it.employee_id);
      if (!row) {
        row = {
          employee: it.employee,
          months:   [],
          totals:   { accrued: 0, debt_deduction: 0, paid_amount: 0, net: 0, advance: 0 },
        };
        byEmployee.set(it.employee_id, row);
      }

      const advance = advanceMap.get(it.id) || 0;

      // Месяц закрывается сам в себе: переносов нет. Переплата — выдали больше,
      // чем осталось выплатить по этому месяцу; она уходит в общий долг сотрудника.
      const due     = net - debtDed;
      const overpay = Math.max(0, paid - due);

      row.months.push({
        month:          it.sheet.month,
        item_id:        it.id,
        accrued,
        base_salary:    Number(it.base_salary || 0),
        salary_type:    it.salary_type,
        debt_deduction: debtDed,
        net,
        salary_balance: 0,
        paid_amount:    paid,
        advance,
        remaining:      Math.max(0, due - paid),
        overpay:        parseFloat(overpay.toFixed(2)),
        payout_status:  it.payout_status,
        status:         it.status,
      });

      row.totals.accrued        += accrued;
      row.totals.debt_deduction += debtDed;
      row.totals.paid_amount    += paid;
      row.totals.net            += net;
      row.totals.advance        += advance;
    }

    // Займы живут вне ведомости — берём их одним запросом на всех сотрудников
    const employeeIds = [...byEmployee.keys()];
    const issuedMap = await PayrollModel.getDebtIssuedTotals(employeeIds);

    let rows = [...byEmployee.values()];
    for (const row of rows) {
      row.months.sort((a, b) => a.month - b.month);
      const last = row.months[row.months.length - 1];
      row.current = {
        month:          last.month,
        item_id:        last.item_id,
        base_salary:    last.base_salary,
        salary_type:    last.salary_type,
        net:            last.net,
        salary_balance: 0,
        paid_amount:    last.paid_amount,
        remaining:      last.remaining,
        payout_status:  last.payout_status,
      };
      // Последняя строка может быть черновой (открыта авансом) — начисление
      // показываем по последнему утверждённому месяцу
      const lastAccrued = [...row.months].reverse().find((m) => m.status === "approved");
      row.last_accrual = lastAccrued
        ? { month: lastAccrued.month, net: lastAccrued.net }
        : { month: null, net: 0 };
      // Переносов нет — остаток к выплате складывается по всем месяцам года
      row.outstanding = parseFloat(
        row.months.reduce((s, m) => s + Number(m.remaining || 0), 0).toFixed(2),
      );

      // Долг одной копилкой: выданные займы плюс переплаты по месяцам минус
      // всё удержанное. Займы вне ведомости, поэтому годом не режутся.
      const loans = Number(issuedMap.get(row.employee.id) || 0);
      const overpayTotal = row.months.reduce((s, m) => s + Number(m.overpay || 0), 0);
      const repaidTotal = row.months.reduce(
        (s, m) => s + Number(m.debt_deduction || 0),
        0,
      );
      row.debt_total = parseFloat(
        Math.max(0, loans + overpayTotal - repaidTotal).toFixed(2),
      );
      // Колонка «Аванс (не удержан)» показывает ту же величину
      row.advance_balance = row.debt_total;
      row.loan_outstanding = row.debt_total;

      // Удержать из любого месяца можно весь непогашенный долг — упирается
      // только в остаток самого месяца
      for (const m of row.months) m.deductible = row.debt_total;
      for (const k of Object.keys(row.totals))
        row.totals[k] = parseFloat(row.totals[k].toFixed(2));
    }

    if (payout_status === "unpaid")      rows = rows.filter((r) => r.outstanding > 0);
    else if (payout_status === "paid")   rows = rows.filter((r) => r.outstanding <= 0);

    const dir = sort_order === "desc" ? -1 : 1;
    const pick = {
      last_name:       (r) => (r.employee?.last_name || "").toLowerCase(),
      employee_number: (r) => (r.employee?.employee_number || "").toLowerCase(),
      branch:          (r) => (r.employee?.branch?.name || "").toLowerCase(),
      department:      (r) => (r.employee?.department?.name || "").toLowerCase(),
      position:        (r) => (r.employee?.position?.name || "").toLowerCase(),
      amount:          (r) => r.totals.accrued,
      accrued:         (r) => r.totals.accrued,
      net:             (r) => r.totals.net,
      paid:            (r) => r.totals.paid_amount,
      status:          (r) => r.outstanding,
    };
    const getKey = pick[sort_by] || pick.last_name;
    rows.sort((a, b) => {
      const ka = getKey(a), kb = getKey(b);
      if (ka < kb) return -1 * dir;
      if (ka > kb) return 1 * dir;
      return 0;
    });

    const stats = rows.reduce(
      (acc, r) => {
        acc.employees      += 1;
        acc.accrued        += r.totals.accrued;
        acc.net            += r.totals.net;
        acc.paid           += r.totals.paid_amount;
        acc.debt_deduction += r.totals.debt_deduction;
        acc.outstanding    += r.outstanding;
        acc.current_net    += r.last_accrual.net;
        acc.current_base   += r.current.base_salary;
        acc.advance        += r.totals.advance;
        acc.advance_balance += r.debt_total;
        return acc;
      },
      { ...emptyStats },
    );
    for (const k of Object.keys(stats))
      if (k !== "employees") stats[k] = parseFloat(stats[k].toFixed(2));

    const total = rows.length;

    return {
      success: true,
      data: {
        year:   y,
        months: sheets.map((sh) => sh.month),
        sheets: sheets.map((sh) => ({ id: sh.id, month: sh.month })),
        items:  rows.slice(skip, skip + take),
        stats,
      },
      pagination: {
        total,
        totalPages:  Math.ceil(total / take) || 1,
        currentPage: Number(page),
        pageSize:    take,
      },
    };
  },

  bulkMarkPaid: async (itemIds, status, userId) => {
    if (!Array.isArray(itemIds) || !itemIds.length)
      return { success: false, message: "No items" };
    if (!["unpaid", "paid", "partially_paid"].includes(status))
      return { success: false, message: "Invalid status" };
    await PayrollModel.bulkMarkPaid(itemIds, status);
    await createAuditLog({
      userId, action: "update", entity: "payroll_sheet_items",
      newData: { itemIds, payout_status: status },
    });
    return { success: true, count: itemIds.length };
  },

  markAllPayoutsStatus: async (sheetId, status, userId) => {
    if (!["unpaid", "paid", "partially_paid"].includes(status))
      return { success: false, message: "Invalid status" };
    await PayrollModel.markAllPayoutsStatus(sheetId, status);
    await createAuditLog({
      userId, action: "update", entity: "payroll_sheets", recordId: sheetId,
      newData: { itemsPayoutStatus: status },
    });
    return { success: true };
  },

  // ── Payment logs ─────────────────────────────────────────────────────────────

  getPaymentLogs: async (itemId) => {
    const logs = await PayrollModel.getPaymentLogs(itemId);
    return { success: true, data: logs };
  },

  addPaymentLog: async (itemId, { amount, payment_date, note }, userId) => {
    if (!amount || Number(amount) <= 0) return { success: false, message: "Invalid amount" };
    if (!payment_date) return { success: false, message: "payment_date required" };
    if (_isFutureDate(payment_date)) return { success: false, message: "payment_date cannot be in the future" };

    const item = await PayrollModel.findItemById(itemId);
    if (!item) return { success: false, message: "Item not found" };

    // A payment can never exceed what is still owed for that month.
    // The UI works in whole units, so anything within 1 of the remainder is
    // treated as "pay the rest" and capped instead of rejected.
    const dueNow = Math.max(0, _dueOf(item) - Number(item.paid_amount || 0));
    if (dueNow <= 0) return { success: false, message: "nothing left to pay" };
    if (Number(amount) > dueNow + 1)
      return { success: false, message: "amount exceeds the remaining balance" };
    const payAmount = Math.min(Number(amount), dueNow);

    const { totalPaid } = await PayrollModel.addPaymentLog(itemId, {
      amount: payAmount, payment_date, note,
    });

    const newPayoutStatus = _resolvePayStatus(totalPaid, _dueOf(item), item.payout_status);

    const updated = await PayrollModel.updateItem(itemId, {
      paid_amount:   parseFloat(totalPaid.toFixed(2)),
      payout_status: newPayoutStatus,
    });

    // Propagate payment to previous month if carry-over exists
    await _syncPrevMonthPayment(item, totalPaid);

    // Propagate updated carry to next month
    const sheetAdd = await PayrollModel.findSheetById(item.sheet_id);
    if (sheetAdd) await _propagateCarryToNextMonth(item.employee_id, sheetAdd.year, sheetAdd.month);

    await createAuditLog({
      userId, action: "create", entity: "payroll_payment_logs", recordId: itemId,
      newData: { amount: payAmount, payment_date, note },
    });

    return { success: true, data: updated };
  },

  // Аванс — выплата вперёд, когда платить ещё нечего: остатка нет или начисление
  // за месяц не рассчитано. Пишется тем же payment log, но с флагом is_advance и
  // без потолка по остатку. Переплата уходит в carry-over отрицательным числом,
  // то есть становится debt_balance следующего месяца и удерживается из будущего
  // начисления.
  addAdvance: async (userId, { employee_id, year, month, amount, payment_date, note }) => {
    const empId = Number(employee_id);
    const y = Number(year);
    const m = Number(month);
    if (!empId) return { success: false, message: "employee_id required" };
    if (!y || !m || m < 1 || m > 12) return { success: false, message: "Invalid month" };
    if (!amount || Number(amount) <= 0) return { success: false, message: "Invalid amount" };
    if (!payment_date) return { success: false, message: "payment_date required" };
    if (_isFutureDate(payment_date)) return { success: false, message: "payment_date cannot be in the future" };

    const monthStr = `${y}-${String(m).padStart(2, "0")}`;

    // Ведомости за месяц может не быть — генерируем её так же, как это делает
    // страница расчёта зарплаты, чтобы строки появились у всех, а не у одного
    let sheet = await PayrollModel.findByMonthYear(m, y);
    if (!sheet) sheet = await _generateSheet(userId, y, m, monthStr);

    let item = await PayrollModel.findItemBySheetAndEmployee(sheet.id, empId);
    if (!item) {
      // Сотрудника нет в ведомости (уволен, без оклада) — заводим пустую строку
      const salaryHistory = await EmployeeSalaryHistoryModel.findAllByEmployeeId(empId);
      const monthStart = new Date(Date.UTC(y, m - 1, 1));
      const monthEnd   = new Date(Date.UTC(y, m, 0));
      const salary = salaryHistory.find(
        (h) =>
          new Date(h.date_from) <= monthEnd &&
          (!h.date_to || new Date(h.date_to) >= monthStart),
      );
      const carry = await _carryForEmployee(empId, y, m);

      item = await PayrollModel.createItem({
        sheet_id:       sheet.id,
        employee_id:    empId,
        base_salary:    salary ? Number(salary.amount) : 0,
        salary_type:    salary?.salary_type || "notSet",
        accrued:        0,
        net:            0,
        salary_balance: carry.salary,
        debt_balance:   carry.debt,
        status:         "draft",
      });
    }

    const advance = parseFloat(Number(amount).toFixed(2));

    // Аванс не может быть больше зарплаты за месяц: иначе он заведомо не
    // покроется начислением и будет тянуться месяцами
    const monthSalary = Number(item.base_salary || 0);
    if (monthSalary <= 0) return { success: false, message: "advanceNoSalary" };

    const issued = await PayrollModel.getAdvanceTotals([item.id]);
    const alreadyIssued = Number(issued.get(item.id) || 0);
    if (advance + alreadyIssued > monthSalary + 0.001)
      return {
        success: false,
        message: "advanceExceedsSalary",
        limit: parseFloat((monthSalary - alreadyIssued).toFixed(2)),
      };

    const { totalPaid } = await PayrollModel.addPaymentLog(item.id, {
      amount: advance, payment_date, note, is_advance: true,
    });

    const totalDue = _dueOf(item);
    const data = { paid_amount: parseFloat(totalPaid.toFixed(2)) };
    // Черновой месяц ещё не в выплатах — его payout_status не трогаем
    if (item.status === "approved")
      data.payout_status = _resolvePayStatus(totalPaid, totalDue, item.payout_status);

    const updated = await PayrollModel.updateItem(item.id, data);

    // Если у месяца был перенос — часть аванса закрывает его, как обычная выплата
    await _syncPrevMonthPayment(item, totalPaid);
    // Переплата едет вперёд долгом
    await _propagateCarryToNextMonth(empId, sheet.year, sheet.month);

    await createAuditLog({
      userId, action: "create", entity: "payroll_payment_logs", recordId: item.id,
      newData: { employee_id: empId, amount: advance, payment_date, note, is_advance: true },
    });

    return { success: true, data: updated };
  },

  // Заём живёт вне ведомости: ни месяца, ни строки, ни выплаты по зарплате.
  // Единственная связь с расчётом — погашение удержанием из остатка месяца.
  addLoan: async (userId, { employee_id, amount, issued_at, note }) => {
    const empId = Number(employee_id);
    if (!empId) return { success: false, message: "employee_id required" };
    if (!amount || Number(amount) <= 0) return { success: false, message: "Invalid amount" };
    if (!issued_at) return { success: false, message: "payment_date required" };
    if (_isFutureDate(issued_at))
      return { success: false, message: "payment_date cannot be in the future" };

    const debt = await PayrollModel.createDebt({
      employee_id: empId,
      amount:      parseFloat(Number(amount).toFixed(2)),
      issued_at:   new Date(issued_at),
      note:        note || null,
      added_by:    userId,
    });

    await createAuditLog({
      userId, action: "create", entity: "employee_debts", recordId: debt.id, newData: debt,
    });

    return { success: true, data: debt };
  },

  deleteLoan: async (id, userId) => {
    const debt = await PayrollModel.deleteDebt(id);
    await createAuditLog({
      userId, action: "delete", entity: "employee_debts", recordId: id, oldData: debt,
    });
    return { success: true };
  },

  // Полная история долга сотрудника за год: что выдали и чем гасили.
  // Выдачи берутся из логов (есть дата и примечание), погашения — из
  // `debt_deduction` строк ведомости, у них есть только месяц.
  getDebtHistory: async (employeeId, year) => {
    const empId = Number(employeeId);
    const y = Number(year);
    if (!empId) return { success: false, message: "employee_id required" };
    if (!y) return { success: false, message: "Invalid year" };

    // Займы у сотрудника общие, годом не режутся: заём выдан вне ведомости и
    // может гаситься сколько угодно месяцев спустя
    const debts = await PayrollModel.getDebtsByEmployee(empId);
    const deductions = await PayrollModel.getDeductionsByEmployee(empId);

    const events = [];
    for (const d of debts) {
      events.push({
        id: d.id,
        type: "loan",
        month: null,
        date: d.issued_at,
        amount: Number(d.amount || 0),
        note: d.note || null,
      });
    }
    for (const it of deductions) {
      const toLoan = Number(it.debt_deduction || 0);
      if (toLoan <= 0) continue;
      events.push({
        id: null,
        item_id: it.id,
        type: "repay",
        month: it.sheet.month,
        year: it.sheet.year,
        date: null,
        amount: toLoan,
        note: it.debt_comment || null,
      });
    }

    if (!events.length)
      return {
        success: true,
        data: { year: y, events: [], totals: { issued: 0, repaid: 0, outstanding: 0 } },
      };

    // Выдачи по дате, погашения по месяцу; выдача раньше погашения того же срока
    const keyOf = (e) =>
      e.date ? new Date(e.date).getTime() : new Date((e.year ?? y), (e.month ?? 1) - 1, 28).getTime();
    events.sort((a, b) => keyOf(a) - keyOf(b) || (a.type === "repay" ? 1 : -1));

    const issued = events
      .filter((e) => e.type !== "repay")
      .reduce((s, e) => s + e.amount, 0);
    const repaid = events
      .filter((e) => e.type === "repay")
      .reduce((s, e) => s + e.amount, 0);

    const outstanding = Math.max(0, issued - repaid);

    return {
      success: true,
      data: {
        year: y,
        events,
        totals: {
          issued: parseFloat(issued.toFixed(2)),
          repaid: parseFloat(repaid.toFixed(2)),
          outstanding: parseFloat(outstanding.toFixed(2)),
        },
      },
    };
  },

  // Closes several months in one call: the parts come pre-split by the client
  // and are written oldest-first, because paying an older month lowers the
  // carry of the later ones.
  addPaymentLogsBulk: async (entries, { payment_date, note }, userId) => {
    if (!Array.isArray(entries) || !entries.length)
      return { success: false, message: "No payments" };

    const written = [];
    for (const entry of entries) {
      const res = await PayrollService.addPaymentLog(entry.item_id, {
        amount: entry.amount,
        payment_date,
        note,
      }, userId);
      if (!res.success) return { ...res, written };
      written.push(res.data);
    }

    return { success: true, count: written.length, data: written };
  },

  updatePaymentLog: async (logId, itemId, { amount, payment_date, note }, userId) => {
    if (!amount || Number(amount) <= 0) return { success: false, message: "Invalid amount" };
    if (!payment_date) return { success: false, message: "payment_date required" };
    if (_isFutureDate(payment_date)) return { success: false, message: "payment_date cannot be in the future" };

    const item = await PayrollModel.findItemById(itemId);
    if (!item) return { success: false, message: "Item not found" };

    const log = await PayrollModel.findPaymentLogById(logId);
    if (!log || Number(log.item_id) !== Number(itemId))
      return { success: false, message: "Payment log not found" };

    // Editing frees up this log's own amount before the cap is applied
    const dueNow = Math.max(
      0,
      _dueOf(item) - (Number(item.paid_amount || 0) - Number(log.amount || 0)),
    );
    // Аванс выдан вне начисленного — потолок остатка к нему не применяется
    const uncapped = log.is_advance;
    if (!uncapped && Number(amount) > dueNow + 1)
      return { success: false, message: "amount exceeds the remaining balance" };
    const payAmount = uncapped ? Number(amount) : Math.min(Number(amount), dueNow);

    const { totalPaid } = await PayrollModel.updatePaymentLog(logId, itemId, {
      amount: payAmount, payment_date, note,
    });

    const newPayoutStatus = _resolvePayStatus(totalPaid, _dueOf(item), item.payout_status);

    const updated = await PayrollModel.updateItem(itemId, {
      paid_amount:   parseFloat(totalPaid.toFixed(2)),
      payout_status: newPayoutStatus,
    });

    await _syncPrevMonthPayment(item, totalPaid);

    const sheetUpd = await PayrollModel.findSheetById(item.sheet_id);
    if (sheetUpd) await _propagateCarryToNextMonth(item.employee_id, sheetUpd.year, sheetUpd.month);

    await createAuditLog({
      userId, action: "update", entity: "payroll_payment_logs", recordId: logId,
      oldData: log, newData: { amount: payAmount, payment_date, note },
    });

    return { success: true, data: updated };
  },

  deletePaymentLog: async (logId, itemId, userId) => {
    const item = await PayrollModel.findItemById(itemId);
    if (!item) return { success: false, message: "Item not found" };

    const log = await PayrollModel.findPaymentLogById(logId);

    const { totalPaid } = await PayrollModel.deletePaymentLog(logId, itemId);

    const newPayoutStatus2 = _resolvePayStatus(totalPaid, _dueOf(item), item.payout_status);

    const updated = await PayrollModel.updateItem(itemId, {
      paid_amount:   parseFloat(totalPaid.toFixed(2)),
      payout_status: newPayoutStatus2,
    });

    // Recalculate previous month after deletion
    await _syncPrevMonthPayment(item, totalPaid);

    // Propagate updated carry to next month
    const sheetDel = await PayrollModel.findSheetById(item.sheet_id);
    if (sheetDel) await _propagateCarryToNextMonth(item.employee_id, sheetDel.year, sheetDel.month);

    await createAuditLog({
      userId, action: "delete", entity: "payroll_payment_logs", recordId: logId, oldData: log,
    });

    return { success: true, data: updated };
  },

  // Walks every sheet of the year in order: a sheet only pulls the carry from
  // the month before it, so the chain is only consistent after a full pass.
  recalculateYearBalances: async (year, userId) => {
    const y = Number(year);
    if (!y) return { success: false, message: "Invalid year" };

    const sheets = await PayrollModel.findSheetsByYear(y);
    if (!sheets.length) return { success: true, sheets: 0, updated: 0 };

    let updated = 0;
    for (const sheet of [...sheets].sort((a, b) => a.month - b.month)) {
      const res = await _doRecalcBalances(sheet.id);
      updated += res.updated || 0;
    }

    await createAuditLog({
      userId, action: "update", entity: "payroll_sheets",
      newData: { recalculatedYear: y, sheets: sheets.length, updated },
    });

    return { success: true, sheets: sheets.length, updated };
  },

  recalculateSalaryBalances: async (sheetId, userId) => {
    const { updated } = await _doRecalcBalances(sheetId);
    await createAuditLog({
      userId, action: "update", entity: "payroll_sheets", recordId: sheetId,
      newData: { recalculated: true, updated },
    });
    return { success: true, updated };
  },

  recalculateDraftItems: async (userId, sheetId) => {
    const sheet = await PayrollModel.findSheetById(sheetId);
    if (!sheet) return { success: false, message: "Sheet not found" };

    const monthStr = `${sheet.year}-${String(sheet.month).padStart(2, "0")}`;
    const calendarOverrides = await _getMonthCalendar(sheet.year, sheet.month);
    const fallbackWorkDays = countFallbackWorkdays(
      sheet.year,
      sheet.month,
      calendarOverrides,
    );
    const start_date = new Date(sheet.year, sheet.month - 1, 0, 0, 0, 0);
    const end_date   = new Date(sheet.year, sheet.month, 1, 23, 59, 59);

    const draftItems = await PayrollModel.getDraftItems(sheetId);
    if (!draftItems.length) return { success: true, updated: 0 };

    const employeeIds = draftItems.map((it) => it.employee_id);

    const [events, timeOffsResult] = await Promise.all([
      FacePassesService.getAll({ userId, filters: { start_date, end_date, employeeIds } }),
      TimeOffService.getAll({ userId, filters: { employeeIds } }),
    ]);

    await _augmentEventsWithMissingEmployees(
      events,
      draftItems.map((it) => ({ id: it.employee_id })),
    );

    const attendance = generateAttendanceReport(
      events,
      timeOffsResult,
      monthStr,
      null,
      buildCalendarContext(calendarOverrides),
    );
    const attMap = new Map(attendance.map((a) => [String(a.employeeId), a]));

    const updates = draftItems.map((item) => {
      const empSalary  = item.employee?.employeeSalaryHistory?.[0];
      const baseSalary = empSalary ? Number(empSalary.amount) : Number(item.base_salary || 0);
      const salaryType = empSalary?.salary_type || item.salary_type || "notSet";
      const att        = attMap.get(String(item.employee_id));

      const workedDays  = att?.totalWorkedDays  || 0;
      const workedHours = att?.totalWorkedHours || "00:00";
      const scheduledMinutes = att?.totalScheduledMinutes || 0;
      // Норма дней — по графику этого сотрудника, а не общая по компании
      const totalWorkDays = resolveTotalWorkDays(att, fallbackWorkDays);

      let accrued = 0;
      if (salaryType === "monthly" && totalWorkDays > 0) {
        accrued = parseFloat(((baseSalary / totalWorkDays) * workedDays).toFixed(2));
      } else if (salaryType === "hourly") {
        const [h, m] = workedHours.split(":").map(Number);
        accrued = parseFloat((baseSalary * (h + (m || 0) / 60)).toFixed(2));
      } else if (salaryType === "piecework") {
        accrued = baseSalary;
      }

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

      // Preserve user-modified fields
      const manualAdj       = Number(item.manual_adjustment || 0);
      const applyLate       = item.apply_late;
      const applyOvertime   = item.apply_overtime;

      const lateDeduction  = applyLate     ? lateAmount     : 0;
      const overtimeBonus  = applyOvertime ? overtimeAmount : 0;
      // Долг в net не входит — он вычитается из суммы к выплате
      const net = parseFloat((accrued + manualAdj - lateDeduction + overtimeBonus).toFixed(2));

      return {
        id:               item.id,
        base_salary:      baseSalary,
        salary_type:      salaryType,
        accrued,
        late_minutes:     lateMinutes,
        late_amount:      lateAmount,
        overtime_minutes: overtimeMinutes,
        overtime_amount:  overtimeAmount,
        scheduled_minutes: scheduledMinutes,
        worked_days:      workedDays,
        // норма месяца могла измениться (добавили/убрали праздник) — пишем её,
        // иначе в таблице показывается старый знаменатель, а accrued считается по новому
        total_work_days:  totalWorkDays,
        worked_hours:     workedHours,
        net,
      };
    });

    await PayrollModel.batchUpdateDraftItems(sheetId, updates);
    return { success: true, updated: updates.length };
  },

  // Recalculate ALL draft items for employee across all months
  // Uses salary effective for each specific month (not just the latest)
  recalculateAllDraftItemsForEmployee: async (employeeId) => {
    const items = await PayrollModel.getAllDraftItemsForEmployee(employeeId);
    if (!items.length) return;

    const salaryHistory = await EmployeeSalaryHistoryModel.findAllByEmployeeId(employeeId);

    // Норма дней по месяцам считается один раз — items могут идти по многим месяцам
    const calendarByMonth = new Map();
    const getMonthCalendar = async (year, month) => {
      const key = `${year}-${month}`;
      if (!calendarByMonth.has(key)) {
        calendarByMonth.set(key, await _getMonthCalendar(year, month));
      }
      return calendarByMonth.get(key);
    };

    for (const item of items) {
      const { year, month } = item.sheet;
      const firstDay = new Date(year, month - 1, 1);
      const lastDay  = new Date(year, month,     0, 23, 59, 59);

      const salary = salaryHistory.find((s) => {
        const from = new Date(s.date_from);
        const to   = s.date_to ? new Date(s.date_to) : null;
        return from <= lastDay && (!to || to >= firstDay);
      });
      if (!salary) continue;

      const baseSalary = Number(salary.amount);
      const salaryType = salary.salary_type;
      // Норма дней уже посчитана по графику сотрудника при генерации ведомости
      const totalWorkDays =
        item.total_work_days > 0
          ? item.total_work_days
          : countFallbackWorkdays(year, month, await getMonthCalendar(year, month));

      const workedDays       = item.worked_days        || 0;
      const workedHours      = item.worked_hours        || "00:00";
      const scheduledMinutes = item.scheduled_minutes   || 0;
      const lateMinutes      = item.late_minutes        || 0;
      const overtimeMinutes  = item.overtime_minutes    || 0;

      let accrued = 0;
      if (salaryType === "monthly" && totalWorkDays > 0) {
        accrued = parseFloat(((baseSalary / totalWorkDays) * workedDays).toFixed(2));
      } else if (salaryType === "hourly") {
        const [h, m] = workedHours.split(":").map(Number);
        accrued = parseFloat((baseSalary * (h + (m || 0) / 60)).toFixed(2));
      } else if (salaryType === "piecework") {
        accrued = baseSalary;
      }

      let perMinuteRate = 0;
      if (salaryType === "monthly" && scheduledMinutes > 0) {
        perMinuteRate = baseSalary / scheduledMinutes;
      } else if (salaryType === "hourly") {
        perMinuteRate = baseSalary / 60;
      }

      const lateAmount     = parseFloat((lateMinutes    * perMinuteRate).toFixed(2));
      const overtimeAmount = parseFloat((overtimeMinutes * perMinuteRate).toFixed(2));

      const manualAdj     = Number(item.manual_adjustment || 0);
      const lateDeduction = item.apply_late     ? lateAmount     : 0;
      const overtimeBonus = item.apply_overtime ? overtimeAmount : 0;
      // Долг в net не входит — он вычитается из суммы к выплате
      const net = parseFloat((accrued + manualAdj - lateDeduction + overtimeBonus).toFixed(2));

      await PayrollModel.updateItem(item.id, {
        base_salary:     baseSalary,
        salary_type:     salaryType,
        accrued,
        late_amount:     lateAmount,
        overtime_amount: overtimeAmount,
        net,
      });
    }

    // Propagate carry-overs in chronological order (items already sorted asc)
    for (const item of items) {
      await _propagateCarryToNextMonth(Number(employeeId), item.sheet.year, item.sheet.month);
    }
  },

  // Recalculate one draft item using stored attendance data + fresh salary
  recalculateDraftItemForEmployee: async (employeeId, year, month) => {
    const sheet = await PayrollModel.findByMonthYear(month, year);
    if (!sheet) return;

    const item = await PayrollModel.getDraftItemForEmployee(sheet.id, employeeId);
    if (!item) return;

    const empSalary = item.employee?.employeeSalaryHistory?.[0];
    if (!empSalary) return;

    const baseSalary = Number(empSalary.amount);
    const salaryType = empSalary.salary_type;
    // Норма дней уже посчитана по графику сотрудника при генерации ведомости
    const totalWorkDays =
      item.total_work_days > 0
        ? item.total_work_days
        : countFallbackWorkdays(year, month, await _getMonthCalendar(year, month));

    const workedDays       = item.worked_days        || 0;
    const workedHours      = item.worked_hours        || "00:00";
    const scheduledMinutes = item.scheduled_minutes   || 0;
    const lateMinutes      = item.late_minutes        || 0;
    const overtimeMinutes  = item.overtime_minutes    || 0;

    let accrued = 0;
    if (salaryType === "monthly" && totalWorkDays > 0) {
      accrued = parseFloat(((baseSalary / totalWorkDays) * workedDays).toFixed(2));
    } else if (salaryType === "hourly") {
      const [h, m] = workedHours.split(":").map(Number);
      accrued = parseFloat((baseSalary * (h + (m || 0) / 60)).toFixed(2));
    } else if (salaryType === "piecework") {
      accrued = baseSalary;
    }

    let perMinuteRate = 0;
    if (salaryType === "monthly" && scheduledMinutes > 0) {
      perMinuteRate = baseSalary / scheduledMinutes;
    } else if (salaryType === "hourly") {
      perMinuteRate = baseSalary / 60;
    }

    const lateAmount     = parseFloat((lateMinutes    * perMinuteRate).toFixed(2));
    const overtimeAmount = parseFloat((overtimeMinutes * perMinuteRate).toFixed(2));

    const manualAdj     = Number(item.manual_adjustment || 0);
    const lateDeduction = item.apply_late     ? lateAmount     : 0;
    const overtimeBonus = item.apply_overtime ? overtimeAmount : 0;
    // Долг в net не входит — он вычитается из суммы к выплате
    const net = parseFloat((accrued + manualAdj - lateDeduction + overtimeBonus).toFixed(2));

    await PayrollModel.updateItem(item.id, {
      base_salary:     baseSalary,
      salary_type:     salaryType,
      accrued,
      late_amount:     lateAmount,
      overtime_amount: overtimeAmount,
      net,
    });

    await _propagateCarryToNextMonth(employeeId, year, month);
  },

  approveSheet: async (id, userId) => {
    const updated = await PayrollModel.approveSheet(id, userId);
    await _cascadeRecalculate(id);
    await createAuditLog({
      userId, action: "update", entity: "payroll_sheets", recordId: id,
      newData: { status: "approved" },
    });
    return { success: true, data: updated };
  },

  unapproveSheet: async (id, userId) => {
    const sheet = await PayrollModel.findSheetById(id);
    if (!sheet) return { success: false, message: "Sheet not found" };
    if (sheet.status !== "approved") return { success: false, message: "Sheet is not approved" };
    const updated = await PayrollModel.unapproveSheet(id);
    await createAuditLog({
      userId, action: "update", entity: "payroll_sheets", recordId: id,
      oldData: { status: "approved" }, newData: { status: "draft" },
    });
    return { success: true, data: updated };
  },

  deleteSheet: async (id, userId) => {
    const deleted = await PayrollModel.deleteSheet(id);
    await createAuditLog({
      userId, action: "delete", entity: "payroll_sheets", recordId: id, oldData: deleted,
    });
    return { success: true };
  },
};
