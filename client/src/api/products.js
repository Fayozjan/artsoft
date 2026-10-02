import api from "./instance";

export const getProducts = async (params) => {
  const res = await api.get("/products", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveProducts = async () => {
  const res = await api.get("/products/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getProductById = async (id) => {
  const res = await api.get(`/products/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addProduct = async (data) => {
  const res = await api.post("/products", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editProductById = async (id, data) => {
  const res = await api.put(`/products/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteProductById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/products/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Товар удалён",
  };
};
