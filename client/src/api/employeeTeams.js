import api from "./instance";

export const getEmployeeTeams = async (operationTypeId) => {
  const res = await api.get("/employee-teams", { params: { operation_type_id: operationTypeId } });
  return { data: res.data.data, success: res.data.success };
};

export const addEmployeeTeam = async (data) => {
  const res = await api.post("/employee-teams", data);
  return { data: res.data.data, success: res.data.success };
};

export const editEmployeeTeamById = async (id, data) => {
  const res = await api.put(`/employee-teams/${id}`, data);
  return { data: res.data.data, success: res.data.success };
};

export const deleteEmployeeTeamById = async (id) => {
  const res = await api.delete(`/employee-teams/${id}`);
  return { success: res.data.success };
};
