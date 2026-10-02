import api from "./instance";

export const getCurrencies = async (params) => {
  const res = await api.get("/currencies", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveCurrencies = async () => {
  const res = await api.get("/currencies/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getCurrencyById = async (id) => {
  const res = await api.get(`/currencies/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getCurrencyRecommendedRate = async (id, date) => {
  const res = await api.get(`/currencies/${id}/rate`, { params: { date } });
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addCurrency = async (data) => {
  const res = await api.post("/currencies", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editCurrencyById = async (id, data) => {
  const res = await api.put(`/currencies/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteCurrencyById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/currencies/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Валюта удалена",
  };
};
