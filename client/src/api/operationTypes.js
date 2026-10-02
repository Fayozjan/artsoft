import api from "./instance";

export const getOperationTypes = async (params = {}) => {
  const res = await api.get("/operation-types", { params });
  return {
    success: res.data.success,
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveOperationTypes = async () => {
  const res = await api.get("/operation-types/active");
  return { data: res.data.data, success: res.data.success };
};

export const getOperationTypeById = async (id) => {
  const res = await api.get(`/operation-types/${id}`);
  return { data: res.data.data, success: res.data.success };
};

export const addOperationType = async (data) => {
  const res = await api.post("/operation-types", data);
  return { data: res.data.data, success: res.data.success };
};

export const editOperationTypeById = async (id, data) => {
  const res = await api.put(`/operation-types/${id}`, data);
  return { data: res.data.data, success: res.data.success };
};

export const deleteOperationTypeById = async (id) => {
  const res = await api.delete(`/operation-types/${id}`);
  return { success: res.data.success };
};
