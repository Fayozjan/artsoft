import { DateTime } from "luxon";

// Столовая работает в локальном времени: смена норм и остаток считаются
// по местным суткам, а не по UTC.
export const ZONE = "Asia/Tashkent";

// Дата события в локальной зоне → значение для колонки @db.Date.
// Prisma сравнивает Date-колонки по UTC-полуночи, поэтому и строим её.
export const toMealDate = (value) => {
  const dt =
    value instanceof Date
      ? DateTime.fromJSDate(value, { zone: ZONE })
      : DateTime.fromISO(String(value), { zone: ZONE });
  const day = (dt.isValid ? dt : DateTime.now().setZone(ZONE)).toISODate();
  return new Date(`${day}T00:00:00.000Z`);
};

// Сегодня в локальной зоне
export const todayMealDate = () => toMealDate(new Date());

// "2026-08-31" → Date для @db.Date; пустое значение → null
export const parseMealDate = (value) => {
  if (!value) return null;
  const dt = DateTime.fromISO(String(value), { zone: ZONE });
  if (!dt.isValid) return null;
  return new Date(`${dt.toISODate()}T00:00:00.000Z`);
};

export const formatMealDate = (value) =>
  value ? DateTime.fromJSDate(new Date(value), { zone: "utc" }).toISODate() : null;

export const employeeFullName = (employee) =>
  [employee?.last_name, employee?.first_name, employee?.middle_name]
    .filter(Boolean)
    .join(" ");
