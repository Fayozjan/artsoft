import api from "./instance";

export const anprCamerasApi = {
  get: async (params = {}) => {
    const res = await api.get("/anpr-cameras", { params });
    return {
      data: res.data.data,
      pagination: res.data.pagination,
    };
  },

  getById: async (id) => {
    const res = await api.get(`/anpr-cameras/${id}`);
    return {
      data: res.data.data,
      success: res.data.success,
    };
  },

  add: async (data) => {
    const res = await api.post("/anpr-cameras", data);
    return {
      data: res.data.data,
      success: res.data.success,
    };
  },

  update: async (id, data) => {
    const res = await api.put(`/anpr-cameras/${id}`, data);
    return {
      data: res.data.data,
      success: res.data.success,
    };
  },

  delete: async (id) => {
    if (!id) throw new Error("ID не передан");

    const res = await api.delete(`/anpr-cameras/${id}`);
    return {
      success: res.data.success,
      message: res.data.message || "Камера удалена",
    };
  },
};
