import api from "./instance";

// Получение списка заказов с пагинацией
export const getManufacturingOrders = async (params = {}) => {
  const res = await api.get("/manufacturing-orders", { params });
  return {
    success: res.data.success,
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

// Получение активных заказов (если нужно, например, только со статусом active)
export const getActiveManufacturingOrders = async () => {
  const res = await api.get("/manufacturing-orders/active");
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

// Получение одного заказа по ID
export const getManufacturingOrderById = async (id) => {
  const res = await api.get(`/manufacturing-orders/${id}`);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

// Добавление нового заказа
export const addManufacturingOrder = async (data) => {
  const res = await api.post("/manufacturing-orders", data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

// Редактирование заказа
export const editManufacturingOrderById = async (id, data) => {
  const res = await api.put(`/manufacturing-orders/${id}`, data);
  return {
    data: res.data.data,
    success: res.data.success,
  };
};

// Удаление заказа
export const deleteManufacturingOrderById = async (id) => {
  const res = await api.delete(`/manufacturing-orders/${id}`);
  return {
    success: res.data.success,
  };
};
