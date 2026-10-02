import api from "./instance";

export const getTimesheetFilterPresets = async () => {
  const res = await api.get("/timesheet-filter-presets");
  return res.data.data;
};

export const createTimesheetFilterPreset = async ({ name, filter }) => {
  const res = await api.post("/timesheet-filter-presets", { name, filter });
  return res.data.data;
};

export const updateTimesheetFilterPreset = async (id, { name, filter }) => {
  const res = await api.put(`/timesheet-filter-presets/${id}`, { name, filter });
  return res.data.data;
};

export const deleteTimesheetFilterPreset = async (id) => {
  const res = await api.delete(`/timesheet-filter-presets/${id}`);
  return res.data;
};
