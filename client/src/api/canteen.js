import api from "./instance";

// ─── Нормы порций ────────────────────────────────────────────────────────────
export const getCanteenAllowances = async (params = {}) => {
  const res = await api.get("/canteen/allowances", { params });
  return { data: res.data.data, pagination: res.data.pagination };
};

export const getCanteenStats = async () => {
  const res = await api.get("/canteen/allowances/stats");
  return { success: res.data.success, data: res.data.data };
};

export const getCanteenAllowanceById = async (id) => {
  const res = await api.get(`/canteen/allowances/${id}`);
  return { success: res.data.success, data: res.data.data };
};

// payload: { employee_ids: [1,2], daily_limit, status, note }
export const assignCanteenAllowances = async (payload) => {
  const res = await api.post("/canteen/allowances", payload);
  return { success: res.data.success, data: res.data.data };
};

export const editCanteenAllowance = async (id, data) => {
  const res = await api.put(`/canteen/allowances/${id}`, data);
  return { success: res.data.success, data: res.data.data };
};

export const deleteCanteenAllowanceById = async (id) => {
  if (!id) throw new Error("ID не передан");
  const res = await api.delete(`/canteen/allowances/${id}`);
  return { success: res.data.success };
};

// ─── Экран столовой ──────────────────────────────────────────────────────────
// Опрашивается раз в 1.5 с: лента последних проходов + счётчики за день
export const getCanteenDisplayState = async (deviceId, limit) => {
  const res = await api.get("/canteen/display", {
    params: { ...(deviceId ? { device_id: deviceId } : {}), ...(limit ? { limit } : {}) },
  });
  return { success: res.data.success, data: res.data.data };
};

export const getCanteenDevices = async () => {
  const res = await api.get("/canteen/devices");
  return { success: res.data.success, data: res.data.data };
};

// ─── Журнал и отчёт ──────────────────────────────────────────────────────────
export const getCanteenMeals = async (params = {}) => {
  const res = await api.get("/canteen/meals", { params });
  return { data: res.data.data, pagination: res.data.pagination };
};

export const deleteCanteenMealById = async (id) => {
  if (!id) throw new Error("ID не передан");
  const res = await api.delete(`/canteen/meals/${id}`);
  return { success: res.data.success };
};

export const bulkDeleteCanteenMeals = async (ids) => {
  const res = await api.post("/canteen/meals/bulk-delete", { ids });
  return {
    success: res.data.success,
    deleted: res.data.deleted,
    skipped: res.data.skipped,
  };
};

// filters: { date_from, date_to, group_by, search, branch_id, department_id }
export const getCanteenReport = async (params = {}) => {
  const res = await api.get("/canteen/report", { params });
  return {
    data: res.data.data,
    totals: res.data.totals,
    period: res.data.period,
    group_by: res.data.group_by,
  };
};
