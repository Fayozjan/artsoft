import api from "./instance";

export const getTimesheet = async (params = {}) => {
  const res = await api.get("/timesheet", { params });
  return {
    data: res.data.data,
    holidays: res.data.holidays,
    pagination: res.data.pagination,
  };
};
