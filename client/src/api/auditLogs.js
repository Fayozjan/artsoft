import api from "./instance";

export const getAuditLogs = async (params = {}) => {
  const res = await api.get("/audit-logs", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getAuditEntities = async () => {
  const res = await api.get("/audit-logs/entities");
  return {
    data: res.data.data,
  };
};
