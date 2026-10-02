import api from "./instance";

export const getTasks = async (params = {}) => {
  const res = await api.get("/tasks", { params });
  return { data: res.data.data, pagination: res.data.pagination };
};

export const getTaskById = async (id) => {
  const res = await api.get(`/tasks/${id}`);
  return { data: res.data.data, success: res.data.success };
};

export const createTask = async (data) => {
  const res = await api.post("/tasks", data);
  return { data: res.data.data, success: res.data.success };
};

export const updateTask = async (id, data) => {
  const res = await api.put(`/tasks/${id}`, data);
  return { data: res.data.data, success: res.data.success };
};

export const deleteTask = async (id) => {
  const res = await api.delete(`/tasks/${id}`);
  return { success: res.data.success };
};

export const publishTask = async (id) => {
  const res = await api.post(`/tasks/${id}/publish`);
  return { data: res.data.data, success: res.data.success };
};

export const unpublishTask = async (id) => {
  const res = await api.post(`/tasks/${id}/unpublish`);
  return { data: res.data.data, success: res.data.success };
};

export const acceptTask = async (id) => {
  const res = await api.post(`/tasks/${id}/accept`);
  return { data: res.data.data, success: res.data.success };
};

export const unacceptTask = async (id) => {
  const res = await api.post(`/tasks/${id}/unaccept`);
  return { data: res.data.data, success: res.data.success };
};

export const completeTask = async (id) => {
  const res = await api.post(`/tasks/${id}/complete`);
  return { data: res.data.data, success: res.data.success };
};

export const uncompleteTask = async (id) => {
  const res = await api.post(`/tasks/${id}/uncomplete`);
  return { data: res.data.data, success: res.data.success };
};

export const cancelTask = async (id) => {
  const res = await api.post(`/tasks/${id}/cancel`);
  return { data: res.data.data, success: res.data.success };
};

export const uncancelTask = async (id) => {
  const res = await api.post(`/tasks/${id}/uncancel`);
  return { data: res.data.data, success: res.data.success };
};

export const addTaskComment = async (id, text) => {
  const res = await api.post(`/tasks/${id}/comments`, { text });
  return { data: res.data.data, success: res.data.success };
};

export const deleteTaskComment = async (id, commentId) => {
  const res = await api.delete(`/tasks/${id}/comments/${commentId}`);
  return { success: res.data.success };
};

export const uploadTaskFile = async (id, formData) => {
  const res = await api.post(`/tasks/${id}/files`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return { data: res.data.data, success: res.data.success };
};

export const deleteTaskFile = async (id, fileId) => {
  const res = await api.delete(`/tasks/${id}/files/${fileId}`);
  return { success: res.data.success };
};
