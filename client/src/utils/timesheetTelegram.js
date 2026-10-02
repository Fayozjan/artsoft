// Общее для Telegram-версии «Табеля»: месяц, статусы дней, подсчёты.

import { percent, toneStyle, initialOf, formatMinutes } from "./attendanceTelegram";

export { percent, toneStyle, initialOf, formatMinutes };

const pad = (n) => String(n).padStart(2, "0");

export const getCurrentMonthISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

export const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// Сдвиг месяца «YYYY-MM» на N месяцев в любую сторону.
export const shiftMonth = (monthStr, delta) => {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const daysInMonth = (monthStr) => {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

const INTL_LOCALES = { ru: "ru", en: "en", uzLatn: "uz-Latn", uzCyrl: "uz-Cyrl" };

export const monthLabel = (monthStr, language) => {
  const [y, m] = monthStr.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat(INTL_LOCALES[language] || "ru", {
    month: "long",
    year: "numeric",
  }).format(date);
};

// Пометки производственного календаря по номеру дня месяца.
export const buildCalendarByDay = (calendar) => {
  const map = new Map();
  (calendar || []).forEach((d) => {
    const day = Number(String(d.date).split("-")[2]);
    if (day) map.set(day, d);
  });
  return map;
};

// Понедельник — первый столбец: смещение для дня 1 числа месяца.
export const leadingBlanks = (monthStr) => {
  const [y, m] = monthStr.split("-").map(Number);
  const weekday = new Date(y, m - 1, 1).getDay();
  return (weekday + 6) % 7;
};

// Статус дня в календаре сотрудника: чем красится ячейка.
export const dayStatus = (day, monthStr, employee, calendarByDay) => {
  const dayKey = `${monthStr}-${pad(day)}`;
  const dayData = employee?.sessions?.[dayKey];
  const mark = calendarByDay?.get(day);

  if (dayData?.timeOff) return "timeOff";
  if (mark?.day_type === "holiday" || mark?.day_type === "weekend") return "dayOff";
  if (dayData?.events?.length > 0) return "worked";
  if (dayKey > todayISO()) return "future";
  return "absent";
};

export const DAY_STATUS_TONES = {
  worked: "green",
  absent: "red",
  dayOff: "gray",
  timeOff: "teal",
  future: "gray",
};

// Есть ли у сотрудника хоть одно посещение или оплачиваемый отгул за месяц.
export const employeeHasEvents = (employee) =>
  Object.values(employee?.sessions || {}).some(
    (s) => s.events?.length > 0 || s.timeOff?.isCompanyPaid,
  );

export const matchesEmployeeQuery = (employee, query) =>
  !query ||
  [
    employee.employeeFullName,
    employee.positionName,
    employee.departmentName,
    employee.branchName,
    employee.pinfl,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));

// Тон плашки явки: доля отработанных дней от запланированных.
export const rateTone = (rate) => {
  if (rate == null) return "gray";
  if (rate >= 90) return "green";
  if (rate >= 70) return "amber";
  return "red";
};
