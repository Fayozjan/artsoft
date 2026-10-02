import api from "./instance";

export const getLateEmployees = async (params = {}) => {
  const res = await api.get("/late-employees", { params });
  return {
    data: res.data.data,
    summary: res.data.summary,
    pagination: res.data.pagination,
  };
};
