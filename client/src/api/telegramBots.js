import api from "./instance";

export const getTelegramBots = async (params = {}) => {
  const res = await api.get("/telegram-bots", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getTelegramBot = async (id) => {
  const res = await api.get(`/telegram-bots/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addTelegramBot = async (data) => {
  const res = await api.post("/telegram-bots", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editTelegramBot = async (id, data) => {
  const res = await api.put(`/telegram-bots/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};
