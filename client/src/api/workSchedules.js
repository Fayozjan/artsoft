import api from "./instance";

export const addWorkSchedule = async (data) => {
  const res = await api.post("/work-schedules", data);
  return res.data;
};

export const getWorkSchedules = async (params = {}) => {
  const res = await api.get("/work-schedules", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveWorkSchedules = async () => {
  const res = await api.get("/work-schedules/active");

  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getWorkScheduleById = async (id) => {
  const res = await api.get(`/work-schedules/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editWorkScheduleById = async (id, data) => {
  const res = await api.put(`/work-schedules/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};
