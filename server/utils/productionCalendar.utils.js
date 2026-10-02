/**
 * Производственный календарь — общие правила для сервера.
 *
 * Календарь НЕ решает, рабочий ли день вообще — это задаёт график сотрудника
 * (work_schedules: свои выходные дни недели у каждого графика). Календарь лишь
 * вносит общефирменные исключения поверх любого графика:
 *   holiday — праздник (нерабочий для всех, не входит в норму)
 *   weekend — разовый выходной для всех (перенос, технические причины)
 *   short   — сокращённый день (минус short_minutes от нормы дня)
 *
 * Дни без строки в production_calendar считаются обычными: работают ровно так,
 * как написано в графике сотрудника.
 */

export const DAY_TYPES = {
  WEEKEND: "weekend",
  HOLIDAY: "holiday",
  SHORT: "short",
};

export const DAY_TYPE_LIST = Object.values(DAY_TYPES);

/** День без переопределения — работает по графику сотрудника */
export const DEFAULT_DAY_TYPE = "default";

/** Нерабочие типы — такие дни не входят в норму рабочего времени */
export const NON_WORKING_TYPES = new Set([DAY_TYPES.WEEKEND, DAY_TYPES.HOLIDAY]);

/** Сокращение по умолчанию, если short_minutes не задан */
export const DEFAULT_SHORT_MINUTES = 60;

/** Длительность стандартного дня (часы) — для справочной нормы на странице */
export const DEFAULT_DAY_HOURS = 8;

/** "YYYY-MM-DD" из Date (в UTC-координатах, @db.Date хранится как UTC-полночь) */
export function toYMD(date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Date (UTC-полночь) из "YYYY-MM-DD" */
export function fromYMD(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Строит контекст календаря из списка переопределений (строк production_calendar).
 *
 * nonWorkingDays — Set "YYYY-MM-DD": день нерабочий (праздник/выходной).
 *                  Вычитается из плановых дней/часов любого графика.
 * shortMinutes   — Map "YYYY-MM-DD" → минуты сокращения дня.
 * byDate         — Map "YYYY-MM-DD" → исходная строка переопределения.
 */
export function buildCalendarContext(overrides = []) {
  const nonWorkingDays = new Set();
  const shortMinutes = new Map();
  const byDate = new Map();

  for (const row of overrides || []) {
    if (!row?.date) continue;
    const key = toYMD(row.date);
    byDate.set(key, row);

    if (NON_WORKING_TYPES.has(row.day_type)) {
      nonWorkingDays.add(key);
      continue;
    }

    if (row.day_type === DAY_TYPES.SHORT) {
      shortMinutes.set(key, Number(row.short_minutes ?? DEFAULT_SHORT_MINUTES));
    }
  }

  return { nonWorkingDays, shortMinutes, byDate };
}

/**
 * Приводит строки production_calendar к виду для клиента:
 * дата как "YYYY-MM-DD", без служебных полей.
 */
export function serializeOverrides(overrides = []) {
  return (overrides || [])
    .filter((r) => r?.date)
    .map((r) => ({
      date: toYMD(r.date),
      day_type: r.day_type,
      name: r.name || null,
      short_minutes:
        r.day_type === DAY_TYPES.SHORT
          ? Number(r.short_minutes ?? DEFAULT_SHORT_MINUTES)
          : null,
    }));
}

/** Пустой контекст — когда календарь не загружен (расчёт по чистому графику) */
export function emptyCalendarContext() {
  return {
    nonWorkingDays: new Set(),
    shortMinutes: new Map(),
    byDate: new Map(),
  };
}

/**
 * Разворачивает диапазон [from, to] в список дней. Дни без переопределения
 * получают day_type = "default" — работают по графику сотрудника.
 */
export function resolveDays(from, to, overrides = []) {
  const byDate = new Map(
    (overrides || []).filter((r) => r?.date).map((r) => [toYMD(r.date), r]),
  );

  const start = fromYMD(toYMD(from));
  const end = fromYMD(toYMD(to));
  const days = [];

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = toYMD(d);
    const override = byDate.get(key);
    const dayType = override?.day_type || DEFAULT_DAY_TYPE;

    days.push({
      date: key,
      day_type: dayType,
      name: override?.name || null,
      short_minutes:
        dayType === DAY_TYPES.SHORT
          ? Number(override?.short_minutes ?? DEFAULT_SHORT_MINUTES)
          : null,
      is_override: Boolean(override),
      id: override?.id ?? null,
    });
  }

  return days;
}

/** Сводка по дням (resolveDays): сколько дней помечено календарём */
export function summarizeDays(days) {
  const summary = {
    totalDays: days.length,
    weekendDays: 0,
    holidayDays: 0,
    shortDays: 0,
    shortMinutes: 0,
  };

  for (const day of days) {
    switch (day.day_type) {
      case DAY_TYPES.HOLIDAY:
        summary.holidayDays++;
        break;
      case DAY_TYPES.WEEKEND:
        summary.weekendDays++;
        break;
      case DAY_TYPES.SHORT:
        summary.shortDays++;
        summary.shortMinutes += Number(day.short_minutes ?? DEFAULT_SHORT_MINUTES);
        break;
      default:
        break;
    }
  }

  return summary;
}
