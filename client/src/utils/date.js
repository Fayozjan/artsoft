import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

import i18n from "../i18n";

dayjs.extend(isoWeek);

// ISO-неделя текущей даты в формате input[type=week]: "2026-W23"
export function getCurrentIsoWeek() {
  const d = dayjs();
  return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, "0")}`;
}

// "2026-W23" => { monday, sunday } (dayjs)
export function getIsoWeekRange(weekStr) {
  const [yearStr, weekPart] = weekStr.split("-W");
  const isoYear = Number(yearStr);
  const weekNum = Number(weekPart);

  // 4 января всегда входит в 1-ю неделю ISO 8601
  const week1Monday = dayjs(`${isoYear}-01-04`).startOf("isoWeek");
  const monday = week1Monday.add((weekNum - 1) * 7, "day");
  const sunday = monday.add(6, "day");

  return { monday, sunday };
}

// Месяц, к которому относится неделя — по четвергу (правило ISO 8601)
export function getIsoWeekMonth(weekStr) {
  const { monday } = getIsoWeekRange(weekStr);
  return monday.add(3, "day").format("YYYY-MM");
}

// Дни месяца monthStr, покрытые неделей weekStr — неделя,
// пересекающая границу месяца, обрезается по границе
export function getIsoWeekDaysInMonth(weekStr, monthStr) {
  const { monday } = getIsoWeekRange(weekStr);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = monday.add(i, "day");
    if (d.format("YYYY-MM") === monthStr) days.push(d.date());
  }
  return days;
}

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

// 2026-02-16T05:00:00.000Z => 2026-02-16T10:00 (Asia/Tashkent)
export function formatIsoToDateTimeLocal(isoString) {
  if (!isoString) return "";

  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type).value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
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
  return i18n.t("hoursMinutesFormat", { hours, minutes });
}

export const formatMinutesToHours = (totalMinutes) => {
  if (!totalMinutes || totalMinutes < 0) return "00:00";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // Используем padStart для добавления ведущего нуля
  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}`;
};
