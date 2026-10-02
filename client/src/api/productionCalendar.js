import api from "./instance";

// Календарь за год (month необязателен) с нормой рабочего времени
export const getProductionCalendar = async (params = {}) => {
  const res = await api.get("/production-calendar", { params });
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

// Норма рабочего времени без списка дней
export const getProductionCalendarNorm = async (params = {}) => {
  const res = await api.get("/production-calendar/norm", { params });
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

// Массовое сохранение дней: [{ date, day_type, name, short_minutes }]
export const saveProductionCalendarDays = async (days) => {
  const res = await api.post("/production-calendar/days", { days });
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

// Сброс дней к значениям по умолчанию: ["YYYY-MM-DD", ...]
export const resetProductionCalendarDays = async (dates) => {
  const res = await api.delete("/production-calendar/days", {
    data: { dates },
  });
  return {
    success: res.data.success,
    data: res.data.data,
  };
};

// Полный сброс года
export const resetProductionCalendarYear = async (year) => {
  const res = await api.delete(`/production-calendar/year/${year}`);
  return {
    success: res.data.success,
    data: res.data.data,
  };
};
