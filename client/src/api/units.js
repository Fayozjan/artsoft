import api from "./instance";

export const getUnits = async (params) => {
  const res = await api.get("/units", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveUnits = async () => {
  const res = await api.get("/units/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getUnitById = async (id) => {
  const res = await api.get(`/units/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addUnit = async (data) => {
  const res = await api.post("/units", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editUnitById = async (id, data) => {
  const res = await api.put(`/units/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteUnitById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/units/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Единица измерения удалена",
  };
};
