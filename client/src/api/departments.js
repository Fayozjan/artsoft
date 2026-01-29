import api from "./instance";

export const getDepartments = async (params = {}) => {
  const res = await api.get("/departments", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveDepartments = async () => {
  const res = await api.get("/departments/active");

  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getDepartmentById = async (id) => {
  const res = await api.get(`/departments/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addDepartment = async (data) => {
  const res = await api.post("/departments", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editDepartmentById = async (id, data) => {
  const res = await api.put(`/departments/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteDepartmentById = async (id, data) => {
  const res = await api.delete(`/departments/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};
