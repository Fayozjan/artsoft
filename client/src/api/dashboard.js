import api from "./instance";

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
