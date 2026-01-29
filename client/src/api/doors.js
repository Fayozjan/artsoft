import api from "./instance";

export const getDoors = async (params = {}) => {
  const res = await api.get("/doors", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveDoors = async () => {
  const res = await api.get("/doors/active");

  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const addDoor = async (data) => {
  const res = await api.post("/doors", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getDoor = async (id) => {
  const res = await api.get(`/doors/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editDoor = async (id, data) => {
  const res = await api.put(`/doors/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};
