import api from "./instance";

export const getAttendance = async (params = {}) => {
  const res = await api.get("/attendance", { params });
  return {
    data: res.data.data,
  };
};
