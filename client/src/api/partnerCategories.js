import api from "./instance";

export const getPartnerCategories = async (params) => {
  const res = await api.get("/partner-categories", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActivePartnerCategories = async () => {
  const res = await api.get("/partner-categories/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getPartnerCategoryById = async (id) => {
  const res = await api.get(`/partner-categories/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addPartnerCategory = async (data) => {
  const res = await api.post("/partner-categories", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editPartnerCategoryById = async (id, data) => {
  const res = await api.put(`/partner-categories/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deletePartnerCategoryById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/partner-categories/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Категория удалена",
  };
};
