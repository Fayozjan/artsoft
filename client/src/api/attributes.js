import api from "./instance";

export const getAttributes = async (params) => {
  const res = await api.get("/attributes", { params });
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getActiveAttributes = async () => {
  const res = await api.get("/attributes/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const getAttributeById = async (id) => {
  const res = await api.get(`/attributes/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const addAttribute = async (data) => {
  const res = await api.post("/attributes", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const editAttributeById = async (id, data) => {
  const res = await api.put(`/attributes/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteAttributeById = async (id) => {
  if (!id) throw new Error("ID не передан");

  const res = await api.delete(`/attributes/${id}`);

  return {
    success: res.data.success,
    message: res.data.message || "Характеристика удалена",
  };
};

export const getAttributeValues = async (attributeId) => {
  const res = await api.get(`/attributes/${attributeId}/values`);
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

export const addAttributeValue = async (attributeId, value) => {
  const res = await api.post(`/attributes/${attributeId}/values`, { value });
  return {
    data: res.data.result,
    success: res.data.success,
  };
};

export const editAttributeValue = async (valueId, data) => {
  const res = await api.put(`/attributes/values/${valueId}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

export const deleteAttributeValue = async (valueId) => {
  if (!valueId) throw new Error("ID не передан");

  const res = await api.delete(`/attributes/values/${valueId}`);

  return {
    success: res.data.success,
    message: res.data.message || "Значение удалено",
  };
};
