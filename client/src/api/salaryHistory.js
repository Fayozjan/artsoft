import api from "./instance";

export const salaryHistoryApi = {
  getEmployeesWithSalary: async (params = {}) => {
    const res = await api.get("/employee-salary-history/employees", { params });
    return {
      success: res.data.success,
      data: res.data.data,
      stats: res.data.stats,
      pagination: res.data.pagination,
    };
  },

  getByEmployee: async (employeeId) => {
    const res = await api.get("/employee-salary-history", {
      params: { employee_id: employeeId },
    });
    return { success: res.data.success, data: res.data.data };
  },

  create: async (payload) => {
    const res = await api.post("/employee-salary-history", payload);
    return { success: res.data.success, data: res.data.data, message: res.data.message };
  },

  update: async (id, payload) => {
    const res = await api.put(`/employee-salary-history/${id}`, payload);
    return { success: res.data.success, data: res.data.data, message: res.data.message };
  },

  deleteById: async (id) => {
    const res = await api.delete(`/employee-salary-history/${id}`);
    return { success: res.data.success, message: res.data.message };
  },
};
