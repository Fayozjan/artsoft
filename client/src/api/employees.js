import api from "./instance";

// multipart для update и rehire: photo — только новый файл или "" (очистить), иначе сервер оставляет текущее
const buildUpdateFormData = (data) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (key === "work_schedule_id") {
      formData.append(key, value ?? "");
      return;
    }

    if (key === "photo") {
      if (value instanceof File) formData.append(key, value);
      else if (value === "") formData.append(key, "");
      // existing filename string — skip, server keeps current photo
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        formData.append(`${key}[]`, "");
      } else {
        value.forEach((v) => formData.append(`${key}[]`, v));
      }
      return;
    }

    formData.append(key, value ?? "");
  });

  return formData;
};

export const EmployeeService = {
  getAll: async (params = {}) => {
    const res = await api.get("/employees", { params });
    return {
      data: res.data.data,
      pagination: res.data.pagination,
    };
  },

  getActive: async () => {
    const res = await api.get("/employees/active");
    return {
      success: res.data.success,
      data: res.data.data,
    };
  },

  getById: async (id) => {
    const res = await api.get(`/employees/${id}`);
    return res.data;
  },

  create: async (data) => {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (key === "photo") {
        if (value instanceof File) formData.append(key, value);
        else formData.append(key, "");
        return;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          formData.append(`${key}[]`, "");
        } else {
          value.forEach((v) => formData.append(`${key}[]`, v));
        }
        return;
      }

      formData.append(key, value ?? "");
    });

    const res = await api.post("/employees", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },

  update: async (id, data) => {
    const res = await api.put(`/employees/${id}`, buildUpdateFormData(data), {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },

  // Уволенные вне зоны доступа логина — кандидаты на приём (список без личных данных)
  getRehireCandidates: async (params = {}) => {
    const res = await api.get("/employees/rehire-candidates", { params });
    return { data: res.data.data, total: res.data.total };
  },

  // Данные кандидата для подстановки в форму приёма
  getRehireCandidate: async (id) => {
    const res = await api.get(`/employees/rehire-candidates/${id}`);
    return res.data;
  },

  // Повторный приём: новый сотрудник не создаётся, оформляется приказ о приёме
  rehire: async (id, data) => {
    const res = await api.post(
      `/employees/${id}/rehire`,
      buildUpdateFormData(data),
      { headers: { "Content-Type": "multipart/form-data" } },
    );

    return res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/employees/${id}`);
    return res.data;
  },

  getProfile: async (id) => {
    const res = await api.get(`/employees/${id}/profile`);
    return res.data;
  },

  getDeleteImpact: async (id) => {
    const res = await api.get(`/employees/${id}/delete-impact`);
    return res.data;
  },

  bulkUpdateWorkSchedule: async (employeeIds, workScheduleId, startDate) => {
    const res = await api.put("/employees/bulk/work-schedule", {
      employee_ids: employeeIds,
      work_schedule_id: workScheduleId,
      work_schedule_start_date: startDate,
    });
    return res.data;
  },

  bulkUpdateDoors: async (employeeIds, doorIds, mode, syncDoors) => {
    const res = await api.put("/employees/bulk/doors", {
      employee_ids: employeeIds,
      door_ids: doorIds,
      mode,
      sync_doors: syncDoors,
    });
    return res.data;
  },

  bulkUpdatePlacement: async (employeeIds, fields) => {
    const res = await api.put("/employees/bulk/placement", {
      employee_ids: employeeIds,
      ...fields,
    });
    return res.data;
  },

  getBulkDeleteImpact: async (employeeIds) => {
    const res = await api.post("/employees/bulk/delete-impact", {
      employee_ids: employeeIds,
    });
    return res.data;
  },

  bulkDelete: async (employeeIds) => {
    const res = await api.post("/employees/bulk/delete", {
      employee_ids: employeeIds,
    });
    return res.data;
  },

  bulkSyncFaceDevices: async (employeeIds) => {
    const res = await api.post("/employees/bulk/sync-face", {
      employee_ids: employeeIds,
    });
    return res.data;
  },

  getStats: async () => {
    const res = await api.get("/employees/stats");
    return res.data;
  },

  importExcel: async (formData) => {
    const res = await api.post("/employees/import-excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};
