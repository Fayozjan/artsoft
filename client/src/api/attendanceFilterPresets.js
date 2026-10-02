import api from "./instance";

export const getAttendanceFilterPresets = async () => {
  const res = await api.get("/attendance-filter-presets");
  return res.data.data;
};

export const createAttendanceFilterPreset = async ({ name, filter }) => {
  const res = await api.post("/attendance-filter-presets", { name, filter });
  return res.data.data;
};

export const updateAttendanceFilterPreset = async (id, { name, filter }) => {
  const res = await api.put(`/attendance-filter-presets/${id}`, { name, filter });
  return res.data.data;
};

export const deleteAttendanceFilterPreset = async (id) => {
  const res = await api.delete(`/attendance-filter-presets/${id}`);
  return res.data;
};
