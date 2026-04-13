import api from "./instance";

export const getVehiclePasses = async (params = {}) => {
  const res = await api.get("/vehicle-passes", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};
