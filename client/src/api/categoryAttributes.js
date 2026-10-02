import api from "./instance";

export const getCategoryAttributes = async (params) => {
  const res = await api.get("/category-attributes", { params });
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const addCategoryAttribute = async (data) => {
  const res = await api.post("/category-attributes", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editCategoryAttributeById = async (id, data) => {
  const res = await api.put(`/category-attributes/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteCategoryAttributeById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/category-attributes/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Связь удалена",
  };
};
