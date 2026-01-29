import api from "./instance";

export const getBranches = async (params = {}) => {
  const res = await api.get("/branches", { params });

  return {
    success: res.data.success,
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveBranches = async () => {
  const res = await api.get("/branches/active");

  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getBranchById = async (id) => {
  const res = await api.get(`/branches/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addBranch = async (data) => {
  const res = await api.post("/branches", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editBranchById = async (id, data) => {
  const res = await api.put(`/branches/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};
