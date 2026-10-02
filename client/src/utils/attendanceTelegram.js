// Общее для Telegram-версии «Посещаемости»: статусы, цвета, работа с датами.

// Цвет статуса: rgb-тройка для rgba(var(--tone), α) и цвет текста, подобранный под тему.
export const TONES = {
  green: { rgb: "22, 163, 74", text: "var(--tg-badge-green-color)" },
  red: { rgb: "220, 38, 38", text: "var(--tg-badge-red-color)" },
  amber: { rgb: "217, 119, 6", text: "var(--tg-badge-amber-color)" },
  orange: { rgb: "234, 88, 12", text: "var(--tg-badge-orange-color, #ea580c)" },
  blue: { rgb: "37, 99, 235", text: "var(--tg-badge-blue-color)" },
  purple: { rgb: "124, 58, 237", text: "var(--tg-badge-purple-color)" },
  teal: { rgb: "13, 148, 136", text: "var(--tg-badge-teal-color)" },
  gray: { rgb: "100, 116, 139", text: "var(--text-secondary)" },
};

export const toneStyle = (tone) => {
  const { rgb, text } = TONES[tone] || TONES.gray;
  return { "--tone": rgb, "--tone-text": text };
};

// Статусы дня. inside / left — «мгновенные», имеют смысл только для сегодняшней даты.
export const STATUS_META = {
  present: { tone: "green", labelKey: "checkedIn", singularKey: "checkedInSingular" },
  absent: { tone: "red", labelKey: "notCheckedIn", singularKey: "notCheckedInSingular" },
  late: { tone: "amber", labelKey: "lateGroup", singularKey: "lateSingular" },
  inside: { tone: "blue", labelKey: "onSite", singularKey: "onSite", todayOnly: true },
  left: { tone: "purple", labelKey: "checkedOut", singularKey: "checkedOutSingular", todayOnly: true },
  onTimeOff: { tone: "teal", labelKey: "onCompanyTimeOff", singularKey: "onCompanyTimeOff" },
};

// Главный статус сотрудника — им красится аватар и плашка карточки.
export const primaryStatus = (emp, isToday) => {
  if (emp.onTimeOff) return "onTimeOff";
  if (emp.absent) return "absent";
  if (emp.late) return "late";
  if (isToday && emp.inside) return "inside";
  if (isToday && emp.left) return "left";
  return "present";
};

export const percent = (num, base) =>
  base > 0 ? Math.round((num / base) * 100) : null;

export const initialOf = (name) => (name || "").trim().charAt(0).toUpperCase() || "•";

// «12 мин» / «1 ч 05 мин»
export const formatMinutes = (minutes, t) => {
  const total = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} ${t("minutesShort")}`;
  return `${h} ${t("hoursShort")} ${String(m).padStart(2, "0")} ${t("minutesShort")}`;
};

// ── Даты ────────────────────────────────────────────────────────────────────
// Все даты — строки «yyyy-mm-dd» в локальной зоне устройства (не UTC:
// после полуночи по Ташкенту toISOString ещё отдавал бы вчера).

const pad = (n) => String(n).padStart(2, "0");

export const toISODate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISODate = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISODate(new Date());

export const shiftISODate = (iso, days) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

// Число дней в диапазоне, обе границы включительно
export const daysInRange = ({ from, to }) =>
  Math.round((parseISODate(to) - parseISODate(from)) / 86400000) + 1;

// Одна дата в обе стороны — режим «за день», разные — «за период»
export const buildAttendanceFilters = ({ from, to }) =>
  from === to
    ? { mode: "day", date: from }
    : { mode: "period", date_from: from, date_to: to };

export const buildPresets = (today = todayISO()) => {
  const now = parseISODate(today);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const yesterday = shiftISODate(today, -1);

  return [
    { key: "today", range: { from: today, to: today } },
    { key: "yesterday", range: { from: yesterday, to: yesterday } },
    { key: "last7", range: { from: shiftISODate(today, -6), to: today } },
    { key: "thisMonth", range: { from: toISODate(monthStart), to: today } },
    {
      key: "lastMonth",
      range: { from: toISODate(prevMonthStart), to: toISODate(prevMonthEnd) },
    },
  ];
};

const INTL_LOCALES = { ru: "ru", en: "en", uzLatn: "uz-Latn", uzCyrl: "uz-Cyrl" };

export const formatDate = (iso, language, options) =>
  new Intl.DateTimeFormat(INTL_LOCALES[language] || "ru", options).format(
    parseISODate(iso),
  );
