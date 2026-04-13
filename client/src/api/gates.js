import api from "./instance";

export const getGates = async (params = {}) => {
  const res = await api.get("/gates", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveGates = async () => {
  const res = await api.get("/gates/active");

  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const addGate = async (data) => {
  const res = await api.post("/gates", data);
  return {
    data: res.data.result, // ⚠️ было res.data.data — исправил
    success: res.data.success,
  };
};

export const getGate = async (id) => {
  const res = await api.get(`/gates/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editGate = async (id, data) => {
  const res = await api.put(`/gates/${id}`, data);
  return {
    data: res.data.result, // ⚠️ тоже result
    success: res.data.success,
  };
};

export const deleteGateById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/gates/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Гейт удалён",
  };
};
