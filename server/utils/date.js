// Добавляем часы и минут к числу
export const parseDateForDB = (dateStr, isEndOfDay = false) => {
  if (isEndOfDay) {
    return `${dateStr}T23:59:59+05:00`;
  } else {
    return `${dateStr}T00:00:00+05:00`;
  }
};
