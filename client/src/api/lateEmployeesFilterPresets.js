import api from "./instance";

export const getLateEmployeesFilterPresets = async () => {
  const res = await api.get("/late-employees-filter-presets");
  return res.data.data;
};

export const createLateEmployeesFilterPreset = async ({ name, filter }) => {
  const res = await api.post("/late-employees-filter-presets", { name, filter });
  return res.data.data;
};

export const updateLateEmployeesFilterPreset = async (id, { name, filter }) => {
  const res = await api.put(`/late-employees-filter-presets/${id}`, { name, filter });
  return res.data.data;
};

export const deleteLateEmployeesFilterPreset = async (id) => {
  const res = await api.delete(`/late-employees-filter-presets/${id}`);
  return res.data;
};
