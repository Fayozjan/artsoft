import api from "./instance";

export const getTimesheet = async (params = {}) => {
  const res = await api.get("/timesheet", { params });
  return {
    data: res.data.data,
    calendar: res.data.calendar,
    pagination: res.data.pagination,
  };
};

export const recalculateTimesheet = async (month) => {
  const res = await api.post("/timesheet/recalculate", { month });
  return res.data;
};
