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
    totalMenus: res.data.totalMenus,
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

// Меню и права логина. В телеграм приложении (/tg) — его отдельный набор прав
// (пока не задан, сервер отдаёт веб-права); platform: "web" | "telegram" задаёт явно.
export const getUserMenu = async ({ platform } = {}) => {
  const isTelegram = platform
    ? platform === "telegram"
    : window.location.pathname.startsWith("/tg");
  const res = await api.get("/users/menu", {
    params: isTelegram ? { platform: "telegram" } : undefined,
  });
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

// Активные блокировки входа (перебор пароля)
export const getLoginLockouts = async () => {
  const res = await api.get("/users/lockouts");
  return res.data.data ?? [];
};

// Снять блокировку входа с пользователя
export const unlockUserLogin = async (id) => {
  const res = await api.post(`/users/${id}/unlock`);
  return { success: res.data.success, wasLocked: res.data.wasLocked };
};
