import api from "./instance";

export const getPositions = async (params) => {
  const res = await api.get("/positions", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActivePositions = async () => {
  const res = await api.get("/positions/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const addPosition = async (data) => {
  const res = await api.post("/positions", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getPositionById = async (id) => {
  const res = await api.get(`/positions/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editPositionById = async (id, data) => {
  const res = await api.put(`/positions/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};
