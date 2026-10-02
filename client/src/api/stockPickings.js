import api from "./instance";

export const getStockPickings = async (params) => {
  const res = await api.get("/stock-pickings", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getStockPickingById = async (id) => {
  const res = await api.get(`/stock-pickings/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getStockPickingOrigins = async () => {
  const res = await api.get("/stock-pickings/origins");
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getStockPickingBalance = async (locationId) => {
  const res = await api.get("/stock-pickings/stock-balance", { params: { location_id: locationId } });
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addStockPicking = async (data) => {
  const res = await api.post("/stock-pickings", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editStockPickingById = async (id, data) => {
  const res = await api.put(`/stock-pickings/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const confirmStockPicking = async (id) => {
  const res = await api.post(`/stock-pickings/${id}/confirm`);
  return { data: res.data.data, success: res.data.success };
};

export const validateStockPicking = async (id) => {
  const res = await api.post(`/stock-pickings/${id}/validate`);
  return { data: res.data.data, success: res.data.success };
};

// Отмена — на шаг назад (done -> confirmed -> draft), см. stockPickings.service.js
export const cancelStockPicking = async (id) => {
  const res = await api.post(`/stock-pickings/${id}/cancel`);
  return { data: res.data.data, success: res.data.success };
};

export const deleteStockPickingById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/stock-pickings/${id}`);

  return {
    success: res.data.success,
  };
};
