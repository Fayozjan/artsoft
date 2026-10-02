import api from "./instance";

export const getStaffingPositions = async (departmentId) => {
  const res = await api.get(`/staffing-positions/department/${departmentId}`);
  return res.data;
};

export const saveStaffingPositions = async (departmentId, positions) => {
  const res = await api.put(`/staffing-positions/department/${departmentId}`, {
    positions,
  });
  return res.data;
};
