import api from "./instance";

export const getOperations = async (params = {}) => {
  const res = await api.get("/operations", { params });
  return {
    success: res.data.success,
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getOperationById = async (id) => {
  const res = await api.get(`/operations/${id}`);
  return { data: res.data.data, success: res.data.success };
};

export const addOperation = async (data) => {
  const res = await api.post("/operations", data);
  return { data: res.data.data, success: res.data.success };
};

export const editOperationById = async (id, data) => {
  const res = await api.put(`/operations/${id}`, data);
  return { data: res.data.data, success: res.data.success };
};

export const deleteOperationById = async (id) => {
  const res = await api.delete(`/operations/${id}`);
  return { success: res.data.success };
};

export const acceptOperation = async (id) => {
  const res = await api.post(`/operations/${id}/accept`);
  return { data: res.data.data, success: res.data.success };
};

export const revertOperation = async (id) => {
  const res = await api.post(`/operations/${id}/revert`);
  return { data: res.data.data, success: res.data.success };
};
