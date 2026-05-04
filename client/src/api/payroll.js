import api from "./instance";

export const payrollApi = {
  getOrGenerate: async (month, params = {}) => {
    const res = await api.get("/payroll", { params: { month, ...params } });
    return res.data;
  },

  updateItem: async (itemId, payload) => {
    const res = await api.put(`/payroll/items/${itemId}`, payload);
    return res.data;
  },

  bulkUpdateStatus: async (itemIds, status) => {
    const res = await api.put("/payroll/items/bulk-status", { itemIds, status });
    return res.data;
  },

  approve: async (id) => {
    const res = await api.post(`/payroll/${id}/approve`);
    return res.data;
  },

  unapproveSheet: async (id) => {
    const res = await api.delete(`/payroll/${id}/approve`);
    return res.data;
  },

  updateAllItemsStatus: async (sheetId, status) => {
    const res = await api.put(`/payroll/${sheetId}/all-status`, { status });
    return res.data;
  },

  deleteSheet: async (id) => {
    const res = await api.delete(`/payroll/${id}`);
    return res.data;
  },

  bulkApplyFlags: async (sheetId, flags) => {
    const res = await api.put(`/payroll/${sheetId}/bulk-apply`, flags);
    return res.data;
  },

  // ── Payment logs ─────────────────────────────────────────────────────────────

  getPaymentLogs: async (itemId) => {
    const res = await api.get(`/payroll/items/${itemId}/payments`);
    return res.data;
  },

  addPaymentLog: async (itemId, payload) => {
    const res = await api.post(`/payroll/items/${itemId}/payments`, payload);
    return res.data;
  },

  deletePaymentLog: async (itemId, logId) => {
    const res = await api.delete(`/payroll/items/${itemId}/payments/${logId}`);
    return res.data;
  },

  recalculateSalaryBalances: async (sheetId) => {
    const res = await api.put(`/payroll/${sheetId}/recalculate-balances`);
    return res.data;
  },

  recalculateDraftItems: async (sheetId) => {
    const res = await api.put(`/payroll/${sheetId}/recalculate-draft`);
    return res.data;
  },

  // ── Payouts ─────────────────────────────────────────────────────────────────

  getPayouts: async (month, params = {}) => {
    const res = await api.get("/payroll/payouts", { params: { month, ...params } });
    return res.data;
  },

  bulkMarkPaid: async (itemIds, status) => {
    const res = await api.put("/payroll/payouts/bulk-status", { itemIds, status });
    return res.data;
  },

  markAllPayoutsStatus: async (sheetId, status) => {
    const res = await api.put(`/payroll/${sheetId}/payouts-all-status`, { status });
    return res.data;
  },

  // ── Salary Advances ─────────────────────────────────────────────────────────

  getAdvances: async (month, params = {}) => {
    const res = await api.get("/payroll/advances", { params: { month, ...params } });
    return res.data;
  },

  createAdvances: async (advances) => {
    const res = await api.post("/payroll/advances", { advances });
    return res.data;
  },

  deleteAdvance: async (id) => {
    const res = await api.delete(`/payroll/advances/${id}`);
    return res.data;
  },

  updateAdvance: async (id, payload) => {
    const res = await api.put(`/payroll/advances/${id}`, payload);
    return res.data;
  },
};
