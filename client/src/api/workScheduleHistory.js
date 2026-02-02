import api from "./instance";

export const workScheduleHistoryApi = {
  deleteById: async (id) => {
    const res = await api.delete(`/employee-schedule-history/${id}`);

    return {
      data: res.data.data,
      success: res.data.success,
    };
  },
};
