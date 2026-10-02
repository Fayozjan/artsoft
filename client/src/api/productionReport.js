import api from "./instance";

// filters: { date_from, date_to, search, operation_type_id }
// Период: по дате приёма работы.
export const getProductionReportByEmployee = async (params = {}) => {
  const res = await api.get("/production-report/employees", { params });
  return { success: res.data.success, data: res.data.data, totals: res.data.totals };
};

// Период: по дате приёма работы.
export const getProductionReportByOperation = async (params = {}) => {
  const res = await api.get("/production-report/operations", { params });
  return { success: res.data.success, data: res.data.data, totals: res.data.totals };
};

// Заказ → партии → позиции → операции → сотрудники, как в отчёте по партиям.
// Период: по дате прихода партии.
export const getProductionReportByOrder = async (params = {}) => {
  const res = await api.get("/production-report/orders", { params });
  return { success: res.data.success, data: res.data.data, totals: res.data.totals };
};

// Мониторинг: по строке на операцию — пришло / в процессе / завершено (стикеры и количество).
// Период: «пришло» — по дате печати, «завершено» — по дате приёма, «в процессе» — не принятые
// стикеры, напечатанные не позже конца периода.
export const getProductionReportMonitoring = async (params = {}) => {
  const res = await api.get("/production-report/monitoring", { params });
  return { success: res.data.success, data: res.data.data, totals: res.data.totals };
};

// По стикерам, постранично (params: filters, page, pageSize; в filters ещё status).
// Период: по дате печати стикера.
export const getProductionReportBySticker = async (params = {}) => {
  const res = await api.get("/production-report/stickers", { params });
  return {
    success: res.data.success,
    data: res.data.data,
    totals: res.data.totals,
    pagination: res.data.pagination,
  };
};

// Значения фильтра «По стикерам»: { sizes, designs, materials, grammages } — что реально
// встречается у позиций со стикерами.
export const getProductionReportStickerItemAttributes = async () => {
  const res = await api.get("/production-report/stickers/item-attributes");
  return res.data.data;
};

// Правка цены принятых стикеров — одного или нескольких сразу. ids — id основных стикеров,
// rate — новая цена. Возвращает { requested, updated, unchanged, skipped }.
export const updateProductionReportStickerRates = async ({ ids, rate }) => {
  const res = await api.put("/production-report/stickers/rate", { ids, rate });
  return { success: res.data.success, data: res.data.data };
};

// Хронология стикера: { selected_id, nodes[] } — предыдущие стикеры, сам стикер и дочерние,
// у каждого журнал events[].
export const getProductionReportStickerChronology = async (id) => {
  const res = await api.get(`/production-report/stickers/${id}/chronology`);
  return res.data.data;
};
