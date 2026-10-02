import api from "./instance";

export const getStockLocations = async (params) => {
  const res = await api.get("/stock-locations", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveStockLocations = async () => {
  const res = await api.get("/stock-locations/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getStockLocationTypes = async () => {
  const res = await api.get("/stock-locations/types");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getStockLocationById = async (id) => {
  const res = await api.get(`/stock-locations/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addStockLocation = async (data) => {
  const res = await api.post("/stock-locations", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editStockLocationById = async (id, data) => {
  const res = await api.put(`/stock-locations/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteStockLocationById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/stock-locations/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Локация удалена",
  };
};
