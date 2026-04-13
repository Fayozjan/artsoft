import api from "./instance";

export const EmployeeDoorTasksService = {
  // 📥 Получить все задачи (с пагинацией и фильтрами)
  getAll: async (params = {}) => {
    const res = await api.get("/employee-door-tasks", { params });
    return {
      data: res.data.data,
      pagination: res.data.pagination,
    };
  },

  // 📥 Получить только pending задачи
  getPending: async () => {
    const res = await api.get("/employee-door-tasks/pending");
    return res.data;
  },

  // ➕ Создать задачу
  create: async (data) => {
    const res = await api.post("/employee-door-tasks", data);
    return res.data;
  },

  // ✏️ Обновить задачу (например статус)
  update: async (id, data) => {
    const res = await api.put(`/employee-door-tasks/${id}`, data);
    return res.data;
  },

  // 🗑 Удалить задачи по фильтру
  deleteMany: async (filter) => {
    const res = await api.delete("/employee-door-tasks", {
      data: filter,
    });
    return res.data;
  },
};
