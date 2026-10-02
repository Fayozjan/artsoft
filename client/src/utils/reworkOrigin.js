// Операция-виновник стикера исправления (origin, см. work_stickers.origin_sticker_id):
// "Пошив — Иванов Иван" — операция и сотрудник, принявший её работу. null — не указана.
export const reworkOriginLabel = (origin) => {
  if (!origin) return null;
  const employee = [origin.employee?.last_name, origin.employee?.first_name].filter(Boolean).join(" ");
  return [origin.operationType?.name, employee].filter(Boolean).join(" — ") || origin.sticker_code;
};
