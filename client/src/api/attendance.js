import api from "./instance";

export const getAttendance = async (params = {}) => {
  const res = await api.get("/attendance", { params });
  return {
    data: res.data.data,
  };
};

export const getAttendanceByEmployeeId = async (employeeId, params = {}) => {
  const res = await api.get(`/attendance/employee/${employeeId}`, {
    params,
  });

  return {
    data: res.data.data,
  };
};
