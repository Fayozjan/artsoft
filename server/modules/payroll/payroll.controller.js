import { PayrollService } from "./payroll.service.js";

export const PayrollController = {
  getOrGenerate: async (req, res) => {
    const userId = req.user?.id;
    const {
      month,
      page, pageSize,
      search,
      branch_id, department_id, position_id,
      salary_type,
      item_status,
      sort_by, sort_order,
    } = req.query;

    if (!month)
      return res.status(400).json({ success: false, message: "month required (YYYY-MM)" });

    try {
      const result = await PayrollService.getOrGenerate(userId, month, {
        page, pageSize,
        search,
        branch_id, department_id, position_id,
        salary_type,
        item_status,
        sort_by, sort_order,
      });
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.getOrGenerate:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateItem: async (req, res) => {
    const { itemId } = req.params;
    try {
      const result = await PayrollService.updateItem(itemId, req.body);
      return result.success ? res.json(result) : res.status(404).json(result);
    } catch (err) {
      console.error("PayrollController.updateItem:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  bulkUpdateStatus: async (req, res) => {
    const { itemIds, status } = req.body;
    try {
      const result = await PayrollService.bulkUpdateStatus(itemIds, status);
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.bulkUpdateStatus:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateAllItemsStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const result = await PayrollService.updateAllItemsStatus(id, status);
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.updateAllItemsStatus:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  approveSheet: async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    try {
      const result = await PayrollService.approveSheet(id, userId);
      return result.success ? res.json(result) : res.status(404).json(result);
    } catch (err) {
      console.error("PayrollController.approveSheet:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  deleteSheet: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await PayrollService.deleteSheet(id);
      return result.success ? res.json(result) : res.status(404).json(result);
    } catch (err) {
      console.error("PayrollController.deleteSheet:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── Payouts ───────────────────────────────────────────────────────────────────

  getPayouts: async (req, res) => {
    const {
      month,
      page, pageSize,
      search,
      branch_id, department_id, position_id,
      salary_type,
      payout_status,
      sort_by, sort_order,
    } = req.query;

    if (!month)
      return res.status(400).json({ success: false, message: "month required (YYYY-MM)" });

    try {
      const result = await PayrollService.getPayouts(month, {
        page, pageSize,
        search,
        branch_id, department_id, position_id,
        salary_type,
        payout_status,
        sort_by, sort_order,
      });
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.getPayouts:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  bulkMarkPaid: async (req, res) => {
    const { itemIds, status } = req.body;
    try {
      const result = await PayrollService.bulkMarkPaid(itemIds, status);
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.bulkMarkPaid:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  markAllPayoutsStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const result = await PayrollService.markAllPayoutsStatus(id, status);
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.markAllPayoutsStatus:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── Payment logs ─────────────────────────────────────────────────────────────

  getPaymentLogs: async (req, res) => {
    const { itemId } = req.params;
    try {
      const result = await PayrollService.getPaymentLogs(itemId);
      return result.success ? res.json(result) : res.status(404).json(result);
    } catch (err) {
      console.error("PayrollController.getPaymentLogs:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  addPaymentLog: async (req, res) => {
    const { itemId } = req.params;
    const { amount, payment_date, note } = req.body;
    try {
      const result = await PayrollService.addPaymentLog(itemId, { amount, payment_date, note });
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.addPaymentLog:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  deletePaymentLog: async (req, res) => {
    const { itemId, logId } = req.params;
    try {
      const result = await PayrollService.deletePaymentLog(logId, itemId);
      return result.success ? res.json(result) : res.status(404).json(result);
    } catch (err) {
      console.error("PayrollController.deletePaymentLog:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  recalculateSalaryBalances: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await PayrollService.recalculateSalaryBalances(id);
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.recalculateSalaryBalances:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  bulkApplyFlags: async (req, res) => {
    const { id } = req.params;
    const { apply_late, apply_overtime } = req.body;
    try {
      const result = await PayrollService.bulkApplyFlags(id, { apply_late, apply_overtime });
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.bulkApplyFlags:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── Salary Advances ──────────────────────────────────────────────────────────

  getAdvances: async (req, res) => {
    const {
      month,
      page, pageSize,
      search,
      branch_id, department_id, position_id,
      sort_by, sort_order,
    } = req.query;

    if (!month)
      return res.status(400).json({ success: false, message: "month required (YYYY-MM)" });

    try {
      const result = await PayrollService.getAdvances(month, {
        page, pageSize, search, branch_id, department_id, position_id, sort_by, sort_order,
      });
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.getAdvances:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  createAdvances: async (req, res) => {
    const userId = req.user?.id;
    const { advances } = req.body;
    try {
      const result = await PayrollService.createAdvances(userId, advances);
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.createAdvances:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  deleteAdvance: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await PayrollService.deleteAdvance(id);
      return result.success ? res.json(result) : res.status(404).json(result);
    } catch (err) {
      console.error("PayrollController.deleteAdvance:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateAdvance: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await PayrollService.updateAdvance(id, req.body);
      return result.success ? res.json(result) : res.status(400).json(result);
    } catch (err) {
      console.error("PayrollController.updateAdvance:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
