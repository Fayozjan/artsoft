import api from "./instance";

export const addUser = async (data) => {
  const res = await api.post("/users", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getUsers = async (params = {}) => {
  const res = await api.get("/users", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getUser = async (id) => {
  const res = await api.get(`/users/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getUserAccess = async () => {
  const res = await api.get("/users/me/access");
  return res.data.data;
};

export const updateProfile = async (data = {}) => {
  const res = await api.put("/users/me", data);
  return { data: res.data.data, success: res.data.success };
};

export const editUser = async ({ id, data }) => {
  const res = await api.put(`/users/${id}`, data);
  return { data: res.data.data, success: res.data.success };
};

export const getUserMenu = async () => {
  const res = await api.get("/users/menu");
  return res.data;
};

export const getUserInfo = async () => {
  const res = await api.get("/users/me");
  return res.data;
};

export const deleteUserById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/users/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Пользователь удалён",
  };
};
