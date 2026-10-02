import api from "./instance";

export const getBatchReceipts = async (params = {}) => {
  const res = await api.get("/batch-receipts", { params });
  return {
    success: res.data.success,
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getBatchReceiptById = async (id) => {
  const res = await api.get(`/batch-receipts/${id}`);
  return { data: res.data.data, success: res.data.success };
};

export const addBatchReceipt = async (data) => {
  const res = await api.post("/batch-receipts", data);
  return { data: res.data.data, success: res.data.success };
};

export const editBatchReceiptById = async (id, data) => {
  const res = await api.put(`/batch-receipts/${id}`, data);
  return { data: res.data.data, success: res.data.success };
};

export const deleteBatchReceiptById = async (id) => {
  const res = await api.delete(`/batch-receipts/${id}`);
  return { success: res.data.success };
};

export const getBatchReceiptsStats = async () => {
  const res = await api.get("/batch-receipts/stats");
  return { success: res.data.success, data: res.data.data };
};

export const appendBatchReceiptItems = async (id, items) => {
  const res = await api.post(`/batch-receipts/${id}/items`, { items });
  return { data: res.data.data, success: res.data.success };
};

export const deleteBatchReceiptItem = async (id, itemId) => {
  const res = await api.delete(`/batch-receipts/${id}/items/${itemId}`);
  return { data: res.data.data, success: res.data.success };
};

export const acceptBatchReceipt =async (id) => {
  const res = await api.post(`/batch-receipts/${id}/accept`);
  return { data: res.data.data, success: res.data.success };
};

export const revertBatchReceipt = async (id) => {
  const res = await api.post(`/batch-receipts/${id}/revert`);
  return { data: res.data.data, success: res.data.success };
};
