import api from "./instance";

export const EmployeeService = {
  getAll: async (params = {}) => {
    const res = await api.get("/employees", { params });
    return {
      data: res.data.data,
      pagination: res.data.pagination,
    };
  },

  getActive: async () => {
    const res = await api.get("/employees/active");
    return {
      success: res.data.success,
      data: res.data.data,
    };
  },

  getById: async (id) => {
    const res = await api.get(`/employees/${id}`);
    return res.data;
  },

  create: async (data) => {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (key === "photo") {
        if (value instanceof File) formData.append(key, value);
        else formData.append(key, "");
        return;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          formData.append(`${key}[]`, "");
        } else {
          value.forEach((v) => formData.append(`${key}[]`, v));
        }
        return;
      }

      formData.append(key, value ?? "");
    });

    const res = await api.post("/employees", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },

  update: async (id, data) => {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (key === "work_schedule_id") {
        formData.append(key, value ?? "");
        return;
      }

      if (key === "photo") {
        if (value instanceof File) formData.append(key, value);
        else formData.append(key, "");
        return;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          formData.append(`${key}[]`, "");
        } else {
          value.forEach((v) => formData.append(`${key}[]`, v));
        }
        return;
      }

      formData.append(key, value ?? "");
    });

    const res = await api.put(`/employees/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/employees/${id}`);
    return res.data;
  },

  getStats: async () => {
    const res = await api.get("/employees/stats");
    return res.data;
  },
};
