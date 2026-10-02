import api from "./instance";

export const EmployeeEfficiencyService = {
  // months — глубина расчёта в календарных месяцах (1..12), по умолчанию 3
  get: async (employeeId, { months } = {}) => {
    const res = await api.get(`/employee-efficiency/${employeeId}`, {
      params: months ? { months } : undefined,
    });
    return res.data;
  },
};
