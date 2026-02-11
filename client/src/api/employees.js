import api from "./instance";

export const getEmployees = async (params = {}) => {
  const res = await api.get("/employees", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveEmployees = async () => {
  const res = await api.get("/employees/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getEmployeeById = async (id) => {
  const res = await api.get(`/employees/${id}`);
  return res.data;
};

export const addEmployee = async (data) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (value instanceof File) {
      formData.append(key, value);
    } else {
      formData.append(key, value);
    }
  });

  const res = await api.post("/employees", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};

export const editEmployee = async (id, data) => {
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

  const res = await api.put(`/employees/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};

export const deleteEmployee = async (id) => {
  const res = await api.delete(`/employees/${id}`);
  return res.data;
};
