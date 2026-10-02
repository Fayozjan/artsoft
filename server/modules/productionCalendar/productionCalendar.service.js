import * as calendarModel from "./productionCalendar.model.js";
import { createAuditLog } from "../../utils/auditLog.js";
import {
  DAY_TYPES,
  DAY_TYPE_LIST,
  DEFAULT_SHORT_MINUTES,
  buildCalendarContext,
  fromYMD,
  toYMD,
  resolveDays,
  summarizeDays,
} from "../../utils/productionCalendar.utils.js";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYear(year) {
  const y = Number(year);
  if (!y || Number.isNaN(y) || y < 1970 || y > 2100) {
    throw new Error("Некорректный год");
  }
  return y;
}

function parseMonth(month) {
  if (month === undefined || month === null || month === "") return null;
  const m = Number(month);
  if (Number.isNaN(m) || m < 1 || m > 12) {
    throw new Error("Некорректный месяц");
  }
  return m;
}

/** Границы запрошенного периода: месяц целиком или год целиком */
function getRange(year, month) {
  if (month) {
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 0)),
    };
  }
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
  };
}

/**
 * Календарь за год (или один месяц): все дни диапазона, помеченные дни —
 * с типом из production_calendar, остальные — "default" (по графику сотрудника).
 */
export async function getCalendarService({ year, month }) {
  const y = parseYear(year);
  const m = parseMonth(month);

  const { start, end } = getRange(y, m);
  const overrides = await calendarModel.getDaysInRange(start, end);
  const days = resolveDays(start, end, overrides);

  // Помесячная разбивка — для карточек года и счётчиков
  const months = [];
  const monthsToBuild = m ? [m] : Array.from({ length: 12 }, (_, i) => i + 1);

  for (const mo of monthsToBuild) {
    const prefix = `${y}-${String(mo).padStart(2, "0")}`;
    const monthDays = days.filter((d) => d.date.startsWith(prefix));
    months.push({
      month: mo,
      days: monthDays,
      summary: summarizeDays(monthDays),
    });
  }

  return {
    year: y,
    month: m,
    days,
    months,
    summary: summarizeDays(days),
  };
}

/** Сводка по календарю за месяц/год без списка дней */
export async function getNormService({ year, month }) {
  const { year: y, month: m, summary, months } =
    await getCalendarService({ year, month });

  return {
    year: y,
    month: m,
    summary,
    months: months.map(({ month: mo, summary: s }) => ({ month: mo, summary: s })),
  };
}

function validateDayInput(day) {
  if (!day?.date || !YMD_RE.test(String(day.date))) {
    throw new Error(`Некорректная дата: ${day?.date}`);
  }
  if (!DAY_TYPE_LIST.includes(day.day_type)) {
    throw new Error(`Некорректный тип дня: ${day.day_type}`);
  }

  const date = fromYMD(day.date);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Некорректная дата: ${day.date}`);
  }

  let shortMinutes = null;
  if (day.day_type === DAY_TYPES.SHORT) {
    shortMinutes = Number(day.short_minutes ?? DEFAULT_SHORT_MINUTES);
    if (Number.isNaN(shortMinutes) || shortMinutes <= 0 || shortMinutes >= 24 * 60) {
      throw new Error(`Некорректное сокращение дня: ${day.short_minutes}`);
    }
  }

  const name = day.name ? String(day.name).trim().slice(0, 255) : null;

  return { date, day_type: day.day_type, name, short_minutes: shortMinutes };
}

/**
 * Массовое сохранение дней. Каждый переданный день — исключение поверх графика
 * (праздник / выходной / сокращённый), поэтому пишется всегда. Чтобы снять
 * пометку и вернуть день под управление графика, используется resetDaysService.
 */
export async function saveDaysService({ days, userId }) {
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error("Список дней пуст");
  }

  const parsed = days.map(validateDayInput);

  const saved = [];
  for (const day of parsed) {
    saved.push(await calendarModel.upsertDay({ ...day, added_by: userId }));
  }

  await createAuditLog({
    userId,
    action: "update",
    entity: "production_calendar",
    recordId: null,
    newData: { saved: saved.length, dates: parsed.map((d) => toYMD(d.date)) },
  });

  return { saved: saved.length, days: saved };
}

/** Снять пометки — дни возвращаются под управление графика сотрудника */
export async function resetDaysService({ dates, userId }) {
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new Error("Список дат пуст");
  }

  for (const date of dates) {
    if (!YMD_RE.test(String(date))) {
      throw new Error(`Некорректная дата: ${date}`);
    }
  }

  const parsed = dates.map(fromYMD);
  const old = await calendarModel.getDaysInRange(
    new Date(Math.min(...parsed.map((d) => d.getTime()))),
    new Date(Math.max(...parsed.map((d) => d.getTime()))),
  );

  const result = await calendarModel.deleteDays(parsed);

  await createAuditLog({
    userId,
    action: "delete",
    entity: "production_calendar",
    recordId: null,
    oldData: old.filter((r) => dates.includes(toYMD(r.date))),
  });

  return { reset: result.count };
}

/** Полный сброс года */
export async function resetYearService({ year, userId }) {
  const y = parseYear(year);
  const result = await calendarModel.deleteYear(y);

  await createAuditLog({
    userId,
    action: "delete",
    entity: "production_calendar",
    recordId: null,
    oldData: { year: y, removed: result.count },
  });

  return { reset: result.count };
}

/**
 * Контекст календаря для диапазона дат — точка входа для табеля, зарплаты
 * и опозданий. Возвращает Set/Map, которые понимают countScheduledDays,
 * countScheduledMinutes и generateAttendanceReport.
 */
export async function getCalendarContext(start, end) {
  const overrides = await calendarModel.getDaysInRange(start, end);
  return buildCalendarContext(overrides);
}

/** Контекст календаря за конкретный месяц */
export async function getMonthCalendarContext(year, month) {
  return getCalendarContext(
    new Date(Date.UTC(year, month - 1, 1)),
    new Date(Date.UTC(year, month, 0)),
  );
}

/**
 * Нерабочие дни диапазона плоским списком — для подсветки в табеле/отчётах
 * на клиенте.
 */
export async function getNonWorkingDays(start, end) {
  const overrides = await calendarModel.getDaysInRange(start, end);
  return overrides
    .filter((r) => r.day_type === DAY_TYPES.HOLIDAY || r.day_type === DAY_TYPES.WEEKEND)
    .map((r) => ({
      date: toYMD(r.date),
      day_type: r.day_type,
      name: r.name,
    }));
}
