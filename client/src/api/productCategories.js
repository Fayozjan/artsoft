import api from "./instance";

export const getProductCategories = async (params) => {
  const res = await api.get("/product-categories", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveProductCategories = async () => {
  const res = await api.get("/product-categories/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getProductCategoryById = async (id) => {
  const res = await api.get(`/product-categories/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addProductCategory = async (data) => {
  const res = await api.post("/product-categories", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editProductCategoryById = async (id, data) => {
  const res = await api.put(`/product-categories/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteProductCategoryById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/product-categories/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Категория удалена",
  };
};
