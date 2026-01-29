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
