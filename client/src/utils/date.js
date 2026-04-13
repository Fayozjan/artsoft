// 2026-02-16T05:00:00.000Z => 16.02.2026, 10:00
export function formatIsoToLocalDateTime(isoString, options = {}) {
  if (!isoString) return "";

  const date = new Date(isoString);

  const defaultOptions = {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  return date.toLocaleString("ru-RU", { ...defaultOptions, ...options });
}

// 2026-02-16T05:00:00.000Z => 16.02.2026
export function formatIsoToLocalDate(isoString, options = {}) {
  if (!isoString) return "";

  const date = new Date(isoString);

  const defaultOptions = {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };

  return date.toLocaleString("ru-RU", { ...defaultOptions, ...options });
}

// 2026-02-16T05:00:00.000Z => 2026-02-16T10:00
export function formatIsoToDateTimeLocal(isoString) {
  if (!isoString) return "";

  const date = new Date(isoString);

  const pad = (n) => String(n).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Форматируем UTC-строку в Date
export function formatUtcStringToDate(utcString) {
  if (!utcString) return "";

  const date = new Date(utcString);

  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatHoursMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}ч ${minutes}м`;
}
