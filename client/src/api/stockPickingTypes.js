import api from "./instance";

export const getStockPickingTypes = async (params) => {
  const res = await api.get("/stock-picking-types", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveStockPickingTypes = async () => {
  const res = await api.get("/stock-picking-types/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getStockPickingTypeCodes = async () => {
  const res = await api.get("/stock-picking-types/codes");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getStockPickingTypeById = async (id) => {
  const res = await api.get(`/stock-picking-types/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addStockPickingType = async (data) => {
  const res = await api.post("/stock-picking-types", data);
  return {
    data: res.data.result,
    success: res.data.success,
  };
};

export const editStockPickingTypeById = async (id, data) => {
  const res = await api.put(`/stock-picking-types/${id}`, data);
  return {
    data: res.data.result,
    success: res.data.success,
  };
};

export const deleteStockPickingTypeById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/stock-picking-types/${id}`);

  return {
    success: res.data.success,
  };
};
