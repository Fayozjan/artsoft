import api from "./instance";

export const getPartners = async (params) => {
  const res = await api.get("/partners", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActivePartners = async () => {
  const res = await api.get("/partners/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getPartnerById = async (id) => {
  const res = await api.get(`/partners/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addPartner = async (data) => {
  const res = await api.post("/partners", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editPartnerById = async (id, data) => {
  const res = await api.put(`/partners/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deletePartnerById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/partners/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Партнёр удалён",
  };
};
