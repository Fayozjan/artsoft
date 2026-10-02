import api from "./instance";

export const getDashboardAll = async (params = {}) => {
  const res = await api.get("/dashboard/all", { params });
  return res.data.data;
};

export const getDashboardSummary = async () => {
  const res = await api.get("/dashboard/summary");
  return res.data.data;
};

export const getDashboardAnalytics = async () => {
  const res = await api.get("/dashboard/analytics");
  return res.data.data;
};

export const getDashboardFeeds = async () => {
  const res = await api.get("/dashboard/feeds");
  return res.data.data;
};

export const getDashboardTasks = async (params = {}) => {
  const res = await api.get("/dashboard/tasks", { params });
  return res.data.data;
};
