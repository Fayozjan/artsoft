import api from "./instance";

export const getLateEmployees = async (params = {}) => {
  const res = await api.get("/late-employees", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};
