import api from "./instance";

export const getCronTasks = async () => {
  const res = await api.get("/cron-tasks");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getCronTaskById = async (id) => {
  const res = await api.get(`/cron-tasks/${id}`);
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const createCronTask = async (data) => {
  const res = await api.post("/cron-tasks", data);
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const updateCronTask = async (id, data) => {
  const res = await api.put(`/cron-tasks/${id}`, data);
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const toggleCronTask = async (id) => {
  const res = await api.patch(`/cron-tasks/${id}/toggle`);
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const deleteCronTask = async (id) => {
  const res = await api.delete(`/cron-tasks/${id}`);
  return {
    success: res.data.success,
  };
};

export const runCronTaskNow = async (id) => {
  const res = await api.post(`/cron-tasks/${id}/run-now`);
  return {
    success: res.data.success,
    data: res.data.data,
  };
};
