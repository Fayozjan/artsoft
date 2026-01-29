import api from "./instance";

export const getFacePasses = async (params = {}) => {
  const res = await api.get("/face-passes", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};
