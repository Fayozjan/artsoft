import api from "./instance";

export const getTimeOff = async (params = {}) => {
  const res = await api.get("/time-off", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const createTimeOff = async (data) => {
  const res = await api.post("/time-off", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getTimeOffById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.get(`/time-off/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const updateTimeOff = async (id, payload) => {
  if (!id) throw new Error("ID не передан");
  if (!payload) throw new Error("Данные для обновления не переданы");

  const res = await api.put(`/time-off/${id}`, payload);

  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteTimeOff = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/time-off/${id}`);

  return {
    success: res.data.success,
  };
};
