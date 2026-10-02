import api from "./instance";

export const getWorkStickers = async (params = {}) => {
  const res = await api.get("/work-stickers", { params });
  return {
    success: res.data.success,
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getWorkStickerById = async (id) => {
  const res = await api.get(`/work-stickers/${id}`);
  return { data: res.data.data, success: res.data.success };
};

export const getWorkStickerByCode = async (code) => {
  const res = await api.get(`/work-stickers/by-code/${encodeURIComponent(code)}`);
  return { data: res.data.data, success: res.data.success };
};

export const getWorkStickerItemRemaining = async (itemId) => {
  const res = await api.get(`/work-stickers/item/${itemId}/remaining`);
  return { data: res.data.data, success: res.data.success };
};

// Распределение работы: печать `count` стикеров под позицию партии+операцию.
export const addWorkStickers = async (data) => {
  const res = await api.post("/work-stickers", data);
  return { data: res.data.data, success: res.data.success };
};

// Приём работы: скан стикера + сотрудник + факт.
export const scanWorkSticker = async (code, data) => {
  const res = await api.post(`/work-stickers/by-code/${encodeURIComponent(code)}/scan`, data);
  return { data: res.data.data, success: res.data.success };
};

// Раздача принятого стикера дальше по маршруту (репак / принято-исправление-брак на ОТК).
export const advanceWorkSticker = async (code, data) => {
  const res = await api.post(`/work-stickers/by-code/${encodeURIComponent(code)}/advance`, data);
  return { data: res.data.data, success: res.data.success };
};

// Объединение неск. принятых стикеров одной операции/партии/размера в один —
// перед раздачей на следующую операцию (см. operation_types.allow_merge).
export const mergeWorkStickers = async (ids, next_operation_type_id) => {
  const res = await api.post("/work-stickers/merge", { ids, next_operation_type_id });
  return { data: res.data.data, success: res.data.success };
};

// Отметка "ждёт объединения" — раздача одиночно блокируется, режим объединения
// на "Приёме работы" подтягивает такие стикеры сам.
export const setStickerAwaitingMerge = async (code, value) => {
  const res = await api.post(`/work-stickers/by-code/${encodeURIComponent(code)}/awaiting-merge`, { value });
  return { data: res.data.data, success: res.data.success };
};

// Возврат принятого стикера в pending — отмена скана приёма (пока не раздан дальше).
export const revertWorkSticker = async (code) => {
  const res = await api.post(`/work-stickers/by-code/${encodeURIComponent(code)}/revert`);
  return { data: res.data.data, success: res.data.success };
};

export const deleteWorkStickerById = async (id) => {
  const res = await api.delete(`/work-stickers/${id}`);
  return { success: res.data.success };
};

// Шаблоны внешнего вида/размера стикера — несколько вариантов на компанию,
// печатается активный.
export const getWorkStickerTemplate = async () => {
  const res = await api.get("/work-sticker-template");
  return { data: res.data.data, success: res.data.success };
};

export const getWorkStickerTemplates = async () => {
  const res = await api.get("/work-sticker-template/list");
  return { data: res.data.data, success: res.data.success };
};

// Новый вариант (в т.ч. копия текущего макета из редактора) — неактивный.
export const createWorkStickerTemplate = async (data) => {
  const res = await api.post("/work-sticker-template", data);
  return { data: res.data.data, success: res.data.success };
};

export const updateWorkStickerTemplate = async (id, data) => {
  const res = await api.put(`/work-sticker-template/${id}`, data);
  return { data: res.data.data, success: res.data.success };
};

// Сделать вариант активным — по нему печатаются стикеры.
export const activateWorkStickerTemplate = async (id) => {
  const res = await api.post(`/work-sticker-template/${id}/activate`);
  return { data: res.data.data, success: res.data.success };
};

export const deleteWorkStickerTemplate = async (id) => {
  const res = await api.delete(`/work-sticker-template/${id}`);
  return { success: res.data.success };
};
