import api from "./instance";

export const getHolidays = async (params = {}) => {
  const res = await api.get("/holidays", { params });
  return {
    data: res.data.data,
  };
};

export const getActiveHolidays = async () => {
  const res = await api.get("/holidays/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const addHoliday = async (data) => {
  const res = await api.post("/holidays", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getHolidayById = async (id) => {
  const res = await api.get(`/holidays/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const updateHolidayById = async (id, data) => {
  const res = await api.put(`/holidays/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteHolidayById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/holidays/${id}`);

  return {
    success: res.data.success,
  };
};
