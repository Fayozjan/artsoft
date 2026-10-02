import api from "./instance";

export const getAssetAssignments = async (params) => {
  const res = await api.get("/asset-assignments", { params });
  return { data: res.data.data, pagination: res.data.pagination };
};

// режим «по сотрудникам»: страница — сотрудники, внутри их имущество
export const getAssetAssignmentsByEmployee = async (params) => {
  const res = await api.get("/asset-assignments/by-employee", { params });
  return { data: res.data.data, pagination: res.data.pagination };
};

export const getAssetAssignmentStats = async () => {
  const res = await api.get("/asset-assignments/stats");
  return { success: res.data.success, data: res.data.data };
};

// Ранее введённые названия и состояния — подсказки в форме выдачи
export const getAssetAssignmentSuggestions = async () => {
  const res = await api.get("/asset-assignments/suggestions");
  return { success: res.data.success, data: res.data.data };
};

export const getAssetAssignmentById = async (id) => {
  const res = await api.get(`/asset-assignments/${id}`);
  return { success: res.data.success, data: res.data.data };
};

// payload: { employee_id, items: [{ asset_name, asset_spec, ... custom_fields }] }
export const createAssetAssignments = async (payload) => {
  const res = await api.post("/asset-assignments", payload);
  return { success: res.data.success, data: res.data.data };
};

// formData с полем file — импорт выдач из Excel
export const importAssetAssignmentsExcel = async (formData) => {
  const res = await api.post("/asset-assignments/import-excel", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const editAssetAssignmentById = async (id, data) => {
  const res = await api.put(`/asset-assignments/${id}`, data);
  return { success: res.data.success, data: res.data.data };
};

// data: { state: "returned" | "scrapped", return_date, return_condition }
export const returnAssetAssignment = async (id, data) => {
  const res = await api.patch(`/asset-assignments/${id}/return`, data);
  return { success: res.data.success, data: res.data.data };
};

// отмена возврата/списания — запись снова «на руках»
export const undoAssetAssignmentReturn = async (id) => {
  const res = await api.patch(`/asset-assignments/${id}/undo-return`);
  return { success: res.data.success, data: res.data.data };
};

export const deleteAssetAssignmentById = async (id) => {
  if (!id) throw new Error("ID не передан");
  const res = await api.delete(`/asset-assignments/${id}`);
  return { success: res.data.success, data: res.data.data };
};
