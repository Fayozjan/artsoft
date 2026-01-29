import api from "./instance";

export const getEmploymentOrders = async (params = {}) => {
  const res = await api.get("/employment-orders", { params });

  return {
    success: res.data.success,
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getEmploymentOrderById = async (id) => {
  const res = await api.get(`/employment-orders/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getEmploymentOrdersByEmployeeId = async (id) => {
  const res = await api.get(`/employment-orders/employee/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addEmploymentOrder = async (data) => {
  const res = await api.post("/employment-orders", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editEmploymentOrderById = async (id, data) => {
  const res = await api.put(`/employment-orders/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteEmploymentOrderById = async (id) => {
  const res = await api.delete(`/employment-orders/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};
