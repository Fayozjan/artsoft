import api from "./instance";

export const getFaceDevices = async (params = {}) => {
  const res = await api.get("/face-devices", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const addFaceDevice = async (data) => {
  const res = await api.post("/face-devices", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const getFaceDevice = async (id) => {
  const res = await api.get(`/face-devices/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editFaceDevice = async (id, data) => {
  const res = await api.put(`/face-devices/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteFaceDeviceById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/face-devices/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Устройство удалено",
  };
};
