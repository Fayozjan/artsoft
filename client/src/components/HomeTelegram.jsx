import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { t as i18t } from "i18next";
import { useAuthStore } from "../stores/authStore";
import styles from "./HomeTelegram.module.scss";

// ─── Icons ────────────────────────────────────────────────────────────────────
const HomeIcons = {
  building: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9M9 7h.01M15 7h.01M9 11h.01M15 11h.01" />
    </svg>
  ),
  clock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  ),
  chevronLeft: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  chevronRight: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  mapPin: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5z" />
      <circle cx="12" cy="8.5" r="2.5" />
    </svg>
  ),
  calendar: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  ),
  briefcase: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="17" />
      <line x1="9" y1="14.5" x2="15" y2="14.5" />
    </svg>
  ),
  users: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  layers: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  close: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

const getMonthsShort = () => [
  i18t("monthJan"), i18t("monthFeb"), i18t("monthMar"), i18t("monthApr"),
  i18t("monthMay"), i18t("monthJun"), i18t("monthJul"), i18t("monthAug"),
  i18t("monthSep"), i18t("monthOct"), i18t("monthNov"), i18t("monthDec"),
];

const STATUSES = [
  { key: "present", labelKey: "attended", color: "#4ade80", dot: "#16a34a" },
  { key: "absent", labelKey: "notAttended", color: "#f87171", dot: "#dc2626" },
  { key: "late", labelKey: "lateGroup", color: "#fbbf24", dot: "#d97706" },
  { key: "inside", labelKey: "onSite", color: "#60a5fa", dot: "#2563eb" },
  { key: "left", labelKey: "checkedOut", color: "#a78bfa", dot: "#7c3aed" },
];

const getPanelLabels = () => ({
  all: i18t("allEmployees"),
  present: i18t("attended"),
  absent: i18t("notAttended"),
  late: i18t("lateGroup"),
  inside: i18t("onSite"),
  left: i18t("checkedOut"),
});

const getInitials = (name = "") =>
  name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} ${i18t("minutesShort")}`;
  if (m === 0) return `${h} ${i18t("hoursShort")}`;
  return `${h} ${i18t("hoursShort")} ${m} ${i18t("minutesShort")}`;
};

// ─── Greeting ─────────────────────────────────────────────────────────────────
const getGreetingKey = (hour) => {
  if (hour >= 5 && hour < 12) return "greetingMorning";
  if (hour >= 12 && hour < 18) return "greetingAfternoon";
  return "greetingEvening";
};

const Greeting = () => {
  const { t } = useTranslation();
  const firstName = useAuthStore((s) => s.user?.first_name);

  return (
    <div className={styles.greeting}>
      {t(getGreetingKey(new Date().getHours()))}
      {firstName ? `, ${firstName}` : ""}!
    </div>
  );
};

// ─── Time badges per panel type ───────────────────────────────────────────────
const renderTimeBadges = (emp, panelKey) => {
  if (panelKey === "late") {
    return (
      <div className={styles.panelTimeBadges}>
        {emp.actualStart && (
          <span
            className={styles.panelTimeBadge}
            style={{
              color: "#f87171",
              borderColor: "rgba(220,38,38,0.25)",
              background: "rgba(220,38,38,0.08)",
            }}
          >
            {emp.actualStart}
          </span>
        )}
        {emp.scheduledStart && (
          <span
            className={styles.panelTimeBadge}
            style={{
              color: "#555",
              borderColor: "rgba(255,255,255,0.07)",
              background: "transparent",
            }}
          >
            {i18t("schedPrefix")} {emp.scheduledStart}
          </span>
        )}
        {emp.lateMinutes > 0 && (
          <span
            className={styles.panelTimeBadge}
            style={{
              color: "#fbbf24",
              borderColor: "rgba(217,119,6,0.3)",
              background: "rgba(217,119,6,0.1)",
            }}
          >
            +{emp.lateMinutes} {i18t("minutesShort")}
          </span>
        )}
        {emp.breakReturnLateMinutes > 0 && (
          <span
            className={styles.panelTimeBadge}
            style={{
              color: "#fb923c",
              borderColor: "rgba(234,88,12,0.3)",
              background: "rgba(234,88,12,0.1)",
            }}
          >
            {i18t("breakPrefix")} +{emp.breakReturnLateMinutes} {i18t("minutesShort")}
          </span>
        )}
      </div>
    );
  }

  if (panelKey === "present" || panelKey === "inside" || panelKey === "left") {
    return (
      <div className={styles.panelTimeBadges}>
        {emp.firstEntry && (
          <span
            className={styles.panelTimeBadge}
            style={{
              color: "#4ade80",
              borderColor: "rgba(22,163,74,0.3)",
              background: "rgba(22,163,74,0.08)",
            }}
          >
            {emp.firstEntry}
          </span>
        )}
        {panelKey === "inside" ? (
          <span
            className={styles.panelTimeBadge}
            style={{
              color: "#60a5fa",
              borderColor: "rgba(37,99,235,0.3)",
              background: "rgba(37,99,235,0.08)",
            }}
          >
            <span className={styles.panelPulseDot} /> {i18t("onSiteLow")}
          </span>
        ) : null}
      </div>
    );
  }

  if (panelKey === "absent" && emp.scheduledStart) {
    return (
      <div className={styles.panelTimeBadges}>
        <span
          className={styles.panelTimeBadge}
          style={{
            color: "#555",
            borderColor: "rgba(255,255,255,0.07)",
            background: "transparent",
          }}
        >
          {i18t("planPrefix")} {emp.scheduledStart}
        </span>
      </div>
    );
  }

  return null;
};

// ─── Employee list panel ──────────────────────────────────────────────────────
const EmployeeListPanel = ({ title, employees, panelKey, onClose }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  if (!employees) return null;

  const filtered = search.trim()
    ? employees.filter((e) =>
        (e.employeeFullName || "").toLowerCase().includes(search.toLowerCase()),
      )
    : employees;

  return (
    <div className={styles.panelOverlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.panelHandle} />
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>
            {title} ({employees.length})
          </span>
          <button className={styles.panelCloseBtn} onClick={onClose}>
            {HomeIcons.close}
          </button>
        </div>

        {/* search */}
        <div className={styles.panelSearch}>
          <input
            className={styles.panelSearchInput}
            placeholder={t("searchByName")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.panelList}>
          {filtered.length === 0 ? (
            <div className={styles.panelEmpty}>
              {search ? t("notFound2") : t("noData")}
            </div>
          ) : (
            filtered.map((emp, i) => {
              const name = emp.employeeFullName || emp.fullName || "—";
              const dep = emp?.departmentName;
              const pos = emp?.positionName;
              const photo = emp.employeePhoto || emp.photo;

              return (
                <div
                  className={styles.panelEmpRow}
                  key={emp.employeeId || emp.id || i}
                >
                  <div className={styles.panelAvatar}>
                    {photo ? (
                      <img
                        src={`/api/employees/image/${photo}`}
                        alt={name}
                        loading="lazy"
                        decoding="async"
                        className={styles.panelAvatarImg}
                      />
                    ) : (
                      getInitials(name)
                    )}
                  </div>
                  <div className={styles.panelEmpInfo}>
                    <div className={styles.panelEmpName}>{name}</div>
                    {dep && <div className={styles.panelEmpSub}>{dep}</div>}
                    {pos && <div className={styles.panelEmpSub}>{pos}</div>}
                    {renderTimeBadges(emp, panelKey)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const svgIcon = (children) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const EmployeeIcons = {
  logIn: svgIcon(
    <>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </>,
  ),
  logOut: svgIcon(
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>,
  ),
  alarm: svgIcon(
    <>
      <circle cx="12" cy="13" r="8" />
      <polyline points="12 9 12 13 14.5 14.5" />
      <path d="M5 3 2 6M22 6l-3-3" />
    </>,
  ),
  userX: svgIcon(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="22" y2="13" />
      <line x1="22" y1="8" x2="17" y2="13" />
    </>,
  ),
  zap: svgIcon(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  pause: svgIcon(
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="10" y1="9" x2="10" y2="15" />
      <line x1="14" y1="9" x2="14" y2="15" />
    </>,
  ),
  flag: svgIcon(
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </>,
  ),
};

// статус смены → цветовая схема бейджей темы (--tg-badge-<tone>-*)
const SHIFT_TONES = {
  present: "green",
  inside: "green",
  late: "amber",
  absent: "red",
  left: "purple",
  leftEarly: "pink",
};

const toneStyle = (tone = "gray") => ({
  "--eh-color": `var(--tg-badge-${tone}-color)`,
  "--eh-bg": `var(--tg-badge-${tone}-bg)`,
  "--eh-border": `var(--tg-badge-${tone}-border)`,
});

// Кнопка «Начать работу» / «Завершить работу»; workPunch = { direction, onClick } или
// null, когда логину это не разрешено (Настройки логина → Настройки телеграм приложения)
const WorkPunchButton = ({ workPunch }) => {
  const { t } = useTranslation();
  if (!workPunch) return null;

  const isExit = workPunch.direction === "exit";
  return (
    <button
      type="button"
      className={`${styles.punchBtn} ${isExit ? styles.punchBtnExit : ""}`}
      onClick={workPunch.onClick}
    >
      <span className={styles.punchBtnIcon}>
        {isExit ? EmployeeIcons.logOut : EmployeeIcons.logIn}
      </span>
      {isExit ? t("finishWork") : t("startWork")}
    </button>
  );
};

const percentOf = (value, total) =>
  total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

// сервер отдаёт "00:00" когда отклонения нет
const hasTime = (v) => !!v && v !== "00:00";

const ProgressRing = ({ percent }) => {
  const r = 34;
  const circumference = 2 * Math.PI * r;
  return (
    <div className={styles.ehRing}>
      <svg viewBox="0 0 80 80" className={styles.ehRingSvg}>
        <circle className={styles.ehRingTrack} cx="40" cy="40" r={r} />
        <circle
          className={styles.ehRingFill}
          cx="40"
          cy="40"
          r={r}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </svg>
      <span className={styles.ehRingPct}>{percent}%</span>
    </div>
  );
};

export const EmployeeHomePage = ({
  employee,
  shift,
  monthStats,
  onMonthChange,
  workPunch,
}) => {
  const { t } = useTranslation();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const changeMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
    onMonthChange?.({ month: next.getMonth() + 1, year: next.getFullYear() });
  };

  const isCurrentMonth =
    month === today.getMonth() && year === today.getFullYear();

  const shiftStatusMap = {
    present: { label: t("arrived"), cls: styles.badgeGreen },
    absent: { label: t("notArrived"), cls: styles.badgeRed },
    late: { label: t("lateLabel"), cls: styles.badgeAmber },
    inside: { label: t("onSite"), cls: styles.badgeBlue },
    left: { label: t("leftLabel"), cls: styles.badgePurple },
    leftEarly: { label: t("leftEarlyLabel"), cls: styles.badgePink },
  };
  const shiftStatus = shiftStatusMap[shift?.status] || {
    label: "—",
    cls: styles.badgeGray,
  };
  const tone = SHIFT_TONES[shift?.status] || "gray";
  // нет сессии за сегодня (нет ни графика, ни отметок) — нижнюю часть смены не показываем
  const hasShift = !!(
    shift?.checkIn ||
    shift?.checkOut ||
    shift?.workDuration ||
    shift?.scheduledIn ||
    shift?.scheduledOut
  );
  const hhmm = (v) => (v ? String(v).slice(0, 5) : "—");

  const timesLabel = (count, minutes) => ({
    value: `${count} ${t("times")}`,
    sub: minutes > 0 ? formatDuration(minutes) : null,
  });

  const monthTiles = monthStats
    ? [
        {
          key: "late",
          tone: "red",
          icon: EmployeeIcons.alarm,
          label: t("lateAtWork"),
          active: monthStats.lateCount > 0,
          ...timesLabel(monthStats.lateCount, monthStats.lateTotalMinutes),
        },
        {
          key: "absent",
          tone: "gray",
          icon: EmployeeIcons.userX,
          label: t("absences"),
          active: monthStats.absentDays > 0,
          value: `${monthStats.absentDays} ${t("daysAbbr")}`,
        },
        {
          key: "early",
          tone: "amber",
          icon: EmployeeIcons.logOut,
          label: t("leftEarly"),
          active: monthStats.earlyLeave > 0,
          ...timesLabel(monthStats.earlyLeave, monthStats.earlyLeaveMinutes),
        },
        {
          key: "lateLeave",
          tone: "green",
          icon: EmployeeIcons.zap,
          label: t("leftLate"),
          active: monthStats.lateLeaveCount > 0,
          ...timesLabel(monthStats.lateLeaveCount, monthStats.lateLeaveMinutes),
        },
        monthStats.breakReturnLateCount > 0 && {
          key: "breakLate",
          tone: "red",
          icon: EmployeeIcons.pause,
          label: t("lateAfterBreak"),
          active: true,
          ...timesLabel(
            monthStats.breakReturnLateCount,
            monthStats.breakReturnLateMinutes,
          ),
        },
        monthStats.pastNoExitCount > 0 && {
          key: "noExit",
          tone: "purple",
          icon: EmployeeIcons.flag,
          label: t("noExit"),
          active: true,
          value: `${monthStats.pastNoExitCount} ${t("daysAbbr")}`,
        },
      ].filter(Boolean)
    : [];

  const shiftAlerts = [
    hasTime(shift?.late) && {
      key: "late",
      cls: styles.badgeRed,
      label: t("lateCol"),
      value: shift.late,
    },
    hasTime(shift?.breakReturnLate) && {
      key: "breakLate",
      cls: styles.badgeAmber,
      label: t("lateAfterBreak"),
      value: shift.breakReturnLate,
    },
    hasTime(shift?.lateLeave) && {
      key: "overtime",
      cls: styles.badgePurple,
      label: t("overtime"),
      value: shift.lateLeave,
    },
  ].filter(Boolean);

  return (
    <div className={styles.page}>
      <div className={styles.header} />

      {/* ── 1. Employee hero ── */}
      <section
        className={`${styles.ehCard} ${styles.ehHero}`}
        style={toneStyle(tone)}
      >
        <div className={styles.ehHeroTop}>
          <div className={styles.ehAvatar}>
            {employee?.photo ? (
              <img
                src={`/api/employees/image/${employee.photo}`}
                alt={employee.name}
                className={styles.ehAvatarImg}
              />
            ) : (
              getInitials(employee?.name)
            )}
          </div>
          <div className={styles.ehIdentity}>
            <div className={styles.ehName}>{employee?.name || "—"}</div>
            <div className={styles.ehPosition}>
              <span className={styles.ehPositionText}>
                {employee?.position || "—"}
              </span>
              {employee?.id ? (
                <span className={styles.ehId}>#{employee.id}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.ehChips}>
          <span className={styles.ehChip} title={t("department")}>
            {HomeIcons.layers}
            <span className={styles.ehChipText}>
              {employee?.department || "—"}
            </span>
          </span>
          <span className={styles.ehChip} title={t("branch")}>
            {HomeIcons.building}
            <span className={styles.ehChipText}>{employee?.branch || "—"}</span>
          </span>
          <span className={styles.ehChip} title={t("scheduleLabel")}>
            {HomeIcons.clock}
            <span className={styles.ehChipText}>
              {employee?.schedule || "—"}
            </span>
          </span>
        </div>
      </section>

      <WorkPunchButton workPunch={workPunch} />

      {/* ── 2. Current shift ── */}
      <section
        className={styles.ehCard}
        style={{ ...toneStyle(tone), "--eh-delay": "70ms" }}
      >
        <div className={styles.ehCardHead}>
          <div className={styles.ehCardTitle}>
            {HomeIcons.clock}
            {t("currentShift")}
          </div>
          {shift?.status && (
            <span className={`${styles.badge} ${shiftStatus.cls}`}>
              {shift.status === "inside" && (
                <span className={styles.pulseDot} />
              )}
              {shiftStatus.label}
            </span>
          )}
        </div>

        {hasShift && (
          <>
            <div className={styles.ehDuration}>
              <span className={styles.ehDurationValue}>
                {shift?.workDuration || "—"}
              </span>
              <span className={styles.ehDurationLabel}>
                {t("workDurationToday")}
              </span>
            </div>

            <div className={styles.ehPunches}>
              <div className={styles.ehPunch} style={toneStyle("green")}>
                <span className={styles.ehPunchIcon}>
                  {EmployeeIcons.logIn}
                </span>
                <span className={styles.ehPunchLabel}>{t("checkIn")}</span>
                <span className={styles.ehPunchTime}>
                  {shift?.checkIn || "—"}
                </span>
                <span className={styles.ehPunchSched}>
                  {t("scheduleLabel")} {hhmm(shift?.scheduledIn)}
                </span>
              </div>
              <div className={styles.ehPunch} style={toneStyle("purple")}>
                <span className={styles.ehPunchIcon}>
                  {EmployeeIcons.logOut}
                </span>
                <span className={styles.ehPunchLabel}>{t("checkOut")}</span>
                <span className={styles.ehPunchTime}>
                  {shift?.checkOut || "—"}
                </span>
                <span className={styles.ehPunchSched}>
                  {t("scheduleLabel")} {hhmm(shift?.scheduledOut)}
                </span>
              </div>
            </div>

            {shiftAlerts.length > 0 && (
              <div className={styles.ehAlerts}>
                {shiftAlerts.map(({ key, cls, label, value }) => (
                  <span key={key} className={`${styles.badge} ${cls}`}>
                    {label} +{value}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── 3. Month stats ── */}
      <section className={styles.ehCard} style={{ "--eh-delay": "140ms" }}>
        <div className={styles.ehCardHead}>
          <div className={styles.ehCardTitle}>
            {HomeIcons.calendar}
            {t("forMonth")}
          </div>
          <div className={styles.ehNav}>
            <button
              type="button"
              className={styles.ehNavBtn}
              onClick={() => changeMonth(-1)}
            >
              {HomeIcons.chevronLeft}
            </button>
            <span className={styles.ehNavLabel}>
              {getMonthsShort()[month]} {year}
            </span>
            <button
              type="button"
              className={styles.ehNavBtn}
              onClick={() => changeMonth(1)}
              disabled={isCurrentMonth}
            >
              {HomeIcons.chevronRight}
            </button>
          </div>
        </div>

        <div className={styles.ehMonthTop}>
          <ProgressRing
            percent={percentOf(monthStats?.workedDays, monthStats?.totalDays)}
          />
          <div className={styles.ehMonthMeta}>
            <div className={styles.ehMeta}>
              <span className={styles.ehMetaLabel}>{t("workedDaysMonth")}</span>
              <span className={styles.ehMetaValue}>
                {monthStats ? (
                  <>
                    {monthStats.workedDays}
                    <small>
                      {" "}
                      / {monthStats.totalDays} {t("daysAbbr")}
                    </small>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className={styles.ehMeta}>
              <span className={styles.ehMetaLabel}>{t("totalHoursMonth")}</span>
              <span className={styles.ehMetaValue}>
                {monthStats ? (
                  <>
                    {formatDuration(monthStats.totalMinutes)}
                    <small> / {formatDuration(monthStats.scheduledMinutes)}</small>
                  </>
                ) : (
                  "—"
                )}
              </span>
              <div className={styles.ehBar}>
                <div
                  className={styles.ehBarFill}
                  style={{
                    width: `${percentOf(monthStats?.totalMinutes, monthStats?.scheduledMinutes)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {monthTiles.length > 0 && (
          <div className={styles.ehStatGrid}>
            {monthTiles.map(({ key, tone: tileTone, icon, label, value, sub, active }) => (
              <div key={key} className={styles.ehStat} style={toneStyle(tileTone)}>
                <span className={styles.ehStatIcon}>{icon}</span>
                <div className={styles.ehStatBody}>
                  <span
                    className={`${styles.ehStatValue} ${active ? styles.ehStatValueActive : ""}`}
                  >
                    {value}
                  </span>
                  <span className={styles.ehStatLabel}>{label}</span>
                  {sub && <span className={styles.ehStatSub}>{sub}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ─── Branch selector ──────────────────────────────────────────────────────────
const BranchSelector = ({ branches, selectedBranchId, onBranchChange }) => {
  if (!branches?.length || branches.length <= 1) return null;
  return (
    <div className={styles.branchSelector}>
      {branches.map((b) => (
        <button
          key={b.id}
          className={`${styles.branchPill} ${b.id === selectedBranchId ? styles.branchPillActive : ""}`}
          onClick={() => onBranchChange(b.id)}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PAGE — branch mode (also used as drill-down in absolute mode)
// ═══════════════════════════════════════════════════════════════════════════════
export const AdminHomePage = ({
  branch,
  stats,
  departments,
  employeeLists,
  branches,
  selectedBranchId,
  onBranchChange,
  loading,
  workPunch,
}) => {
  const { t } = useTranslation();
  const [openPanel, setOpenPanel] = useState(null);

  const total = stats?.total || 0;
  const getPercent = (count) =>
    total > 0 ? Math.round((count / total) * 100) : 0;
  const maxDeptCount = departments?.length
    ? Math.max(...departments.map((d) => d.present), 1)
    : 1;

  const panelEmployees = openPanel ? employeeLists?.[openPanel] || [] : null;
  const panelTitle = openPanel ? getPanelLabels()[openPanel] : "";

  return (
    <div className={styles.page}>
      <div className={styles.header} />

      <Greeting />

      <WorkPunchButton workPunch={workPunch} />

      {/* branch selector (branch mode only, when multiple branches) */}
      {branches?.length > 1 && (
        <BranchSelector
          branches={branches}
          selectedBranchId={selectedBranchId}
          onBranchChange={onBranchChange}
        />
      )}

      {/* ── 1. Branch card ── */}
      <div className={styles.card}>
        <div className={styles.sectionLabel}>{HomeIcons.building} {t("branch")}</div>
        <div className={styles.branchHead}>
          <div className={styles.branchIcon}>{HomeIcons.building}</div>
          <div className={styles.branchInfo}>
            <div className={styles.branchName}>{branch?.name || "—"}</div>
            <div className={styles.branchAddr}>
              {HomeIcons.mapPin}
              {branch?.address || "—"}
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        <div
          className={`${styles.row} ${employeeLists?.all?.length ? styles.rowClickable : ""}`}
          onClick={() => employeeLists?.all?.length && setOpenPanel("all")}
        >
          <span className={styles.rowLabel}>{t("totalEmployeesLabel")}</span>
          <span className={styles.rowValue}>
            {branch?.totalEmployees ?? "—"}
            {employeeLists?.all?.length ? (
              <span className={styles.rowChevron}>
                {HomeIcons.chevronRight}
              </span>
            ) : null}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t("departmentsCount")}</span>
          <span className={styles.rowValue}>
            {branch?.departmentCount ?? "—"}
          </span>
        </div>
      </div>

      {/* ── 2. Today's stats ── */}
      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.sectionLabel} style={{ marginBottom: 0 }}>
            {HomeIcons.users} {t("todayStats")}
          </div>
          <span className={styles.dateLabel}>
            {new Date().toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>

        <div className={styles.totalBanner}>
          <div>
            <div className={styles.totalNum}>{loading ? "…" : total}</div>
            <div className={styles.totalLabel}>{t("totalEmpAll")}</div>
          </div>
          <div className={styles.totalBar}>
            {!loading &&
              STATUSES.filter((s) => ["present", "absent"].includes(s.key)).map(
                (s) => {
                  const count = stats?.[s.key] || 0;
                  const pct = getPercent(count);
                  return pct > 0 ? (
                    <div
                      key={s.key}
                      className={styles.totalBarSegment}
                      style={{ width: `${pct}%`, background: s.dot }}
                      title={`${t(s.labelKey)}: ${count}`}
                    />
                  ) : null;
                },
              )}
          </div>
        </div>

        {!loading && (
          <div className={styles.statusList}>
            {STATUSES.filter((s) => stats?.[s.key] != null).map((s) => {
              const count = stats[s.key] || 0;
              const pct = getPercent(count);
              const hasEmployees = employeeLists?.[s.key]?.length > 0;
              return (
                <div
                  className={`${styles.statusRow} ${hasEmployees ? styles.statusRowClickable : ""}`}
                  key={s.key}
                  onClick={() => hasEmployees && setOpenPanel(s.key)}
                >
                  <div className={styles.statusLeft}>
                    <span
                      className={styles.statusDot}
                      style={{ background: s.dot }}
                    />
                    <span className={styles.statusName}>{t(s.labelKey)}</span>
                  </div>
                  <div className={styles.statusRight}>
                    <span className={styles.statusCount}>{count}</span>
                    {pct > 0 && (
                      <span
                        className={styles.statusPct}
                        style={{ color: s.color }}
                      >
                        {pct}%
                      </span>
                    )}
                    {hasEmployees && (
                      <span className={styles.statusChevron}>
                        {HomeIcons.chevronRight}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. By department ── */}
      {!loading && departments?.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionLabel}>
            {HomeIcons.briefcase} {t("deptPresence")}
          </div>
          <div className={styles.deptList}>
            {departments.map((dep, i) => {
              const barPct =
                dep.total > 0 ? (dep.present / dep.total) * 100 : 0;
              const barColors = [
                "#60a5fa",
                "#4ade80",
                "#fbbf24",
                "#a78bfa",
                "#f472b6",
                "#34d399",
                "#fb923c",
              ];
              const color = barColors[i % barColors.length];
              return (
                <div className={styles.deptRow} key={dep.id || dep.name}>
                  <div className={styles.deptLabel}>{dep.name}</div>
                  <div className={styles.deptBarWrap}>
                    <div className={styles.deptBarBg}>
                      <div
                        className={styles.deptBarFill}
                        style={{ width: `${barPct}%`, background: color }}
                      />
                    </div>
                  </div>
                  <div className={styles.deptNums}>
                    <span className={styles.deptPresent} style={{ color }}>
                      {dep.present}
                    </span>
                    <span className={styles.deptTotal}>/{dep.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Employee list panel ── */}
      {openPanel && (
        <EmployeeListPanel
          title={panelTitle}
          employees={panelEmployees}
          panelKey={openPanel}
          onClose={() => setOpenPanel(null)}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ALL BRANCHES PAGE — absolute mode
// ═══════════════════════════════════════════════════════════════════════════════
export const AllBranchesPage = ({ allBranchesData, loading, workPunch }) => {
  const { t } = useTranslation();
  const [detailIdx, setDetailIdx] = useState(null);

  // scroll to top on any navigation
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [detailIdx]);

  // Telegram native BackButton
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    if (detailIdx !== null) {
      tg.BackButton.show();
      const handleBack = () => setDetailIdx(null);
      tg.BackButton.onClick(handleBack);
      return () => {
        tg.BackButton.offClick(handleBack);
        tg.BackButton.hide();
      };
    } else {
      tg.BackButton.hide();
    }
  }, [detailIdx]);

  // drill-down: show selected branch detail
  if (detailIdx !== null && allBranchesData?.[detailIdx]) {
    const item = allBranchesData[detailIdx];
    return (
      <AdminHomePage
        branch={item.branch}
        stats={item.stats}
        departments={item.departments}
        employeeLists={item.employeeLists}
        loading={false}
        workPunch={workPunch}
      />
    );
  }

  const totalEmployees = (allBranchesData || []).reduce(
    (s, d) => s + (d.stats?.total || 0),
    0,
  );
  const totalPresent = (allBranchesData || []).reduce(
    (s, d) => s + (d.stats?.present || 0),
    0,
  );
  const totalInside = (allBranchesData || []).reduce(
    (s, d) => s + (d.stats?.inside || 0),
    0,
  );
  const totalLate = (allBranchesData || []).reduce(
    (s, d) => s + (d.stats?.late || 0),
    0,
  );

  const overallPct =
    totalEmployees > 0 ? (totalPresent / totalEmployees) * 100 : 0;

  return (
    <div className={styles.page}>
      <div className={styles.header} />

      <Greeting />

      <WorkPunchButton workPunch={workPunch} />

      {/* ── Summary card ── */}
      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.sectionLabel} style={{ marginBottom: 0 }}>
            {HomeIcons.layers} {t("allBranches")}
          </div>
          <span className={styles.dateLabel}>
            {new Date().toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>

        <div className={styles.totalBanner}>
          <div>
            <div className={styles.totalNum}>
              {loading ? "…" : totalEmployees}
            </div>
            <div className={styles.totalLabel}>{t("totalEmpAll")}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className={styles.totalBar}>
              {!loading && overallPct > 0 && (
                <div
                  className={styles.totalBarSegment}
                  style={{
                    width: `${overallPct}%`,
                    minWidth: totalPresent > 0 ? "3px" : "0px",
                    backgroundColor: "#16a34a",
                  }}
                />
              )}
            </div>
            {!loading && (
              <div className={styles.allBranchSummaryRow}>
                <span
                  className={styles.allBranchSummaryItem}
                  style={{ color: "#4ade80" }}
                >
                  {totalPresent} {t("attendedLow")}
                </span>
                {totalInside > 0 && (
                  <span
                    className={styles.allBranchSummaryItem}
                    style={{ color: "#60a5fa" }}
                  >
                    {totalInside} {t("onSiteLow")}
                  </span>
                )}
                {totalLate > 0 && (
                  <span
                    className={styles.allBranchSummaryItem}
                    style={{ color: "#fbbf24" }}
                  >
                    {totalLate} {t("lateGroupLow")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Per-branch cards (clickable → drill-down) ── */}
      {!loading &&
        (allBranchesData || []).map((item, idx) => {
          const { branch, stats } = item;
          const total = stats?.total || 0;
          const present = stats?.present || 0;
          const inside = stats?.inside || 0;
          const late = stats?.late || 0;
          const absent = stats?.absent || 0;
          const presentPct =
            total > 0 ? Math.round((present / total) * 100) : 0;

          const barColors = [
            "#60a5fa",
            "#4ade80",
            "#fbbf24",
            "#a78bfa",
            "#f472b6",
            "#34d399",
            "#fb923c",
          ];
          const color = barColors[idx % barColors.length];

          return (
            <div
              className={`${styles.card} ${styles.cardClickable}`}
              key={branch?.id || idx}
              onClick={() => setDetailIdx(idx)}
            >
              <div className={styles.allBranchCardHeader}>
                <div
                  className={styles.allBranchIcon}
                  style={{
                    background: `${color}18`,
                    borderColor: `${color}30`,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={color}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="18"
                    height="18"
                  >
                    <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9M9 7h.01M15 7h.01M9 11h.01M15 11h.01" />
                  </svg>
                </div>
                <div className={styles.allBranchNameBlock}>
                  <div className={styles.allBranchName}>
                    {branch?.name || "—"}
                  </div>
                  {branch?.address && branch.address !== "—" && (
                    <div className={styles.allBranchAddr}>
                      {HomeIcons.mapPin}
                      {branch.address}
                    </div>
                  )}
                </div>
                <div className={styles.allBranchCountBlock}>
                  <span className={styles.allBranchPresent}>{present}</span>
                  <span className={styles.allBranchTotal}>/{total}</span>
                  <span className={styles.allBranchChevron}>
                    {HomeIcons.chevronRight}
                  </span>
                </div>
              </div>

              {/* progress bar */}
              <div className={styles.allBranchBarBg}>
                <div
                  className={styles.allBranchBarFill}
                  style={{
                    width: `${presentPct}%`,
                    minWidth: present > 0 ? "3px" : "0px",
                    background: color,
                  }}
                />
              </div>

              {/* mini stats */}
              <div className={styles.allBranchMiniStats}>
                <span className={styles.allBranchMiniStat}>
                  <span
                    className={styles.allBranchMiniDot}
                    style={{ background: "#2563eb" }}
                  />
                  <span style={{ color: "#60a5fa" }}>{inside}</span>
                  <span className={styles.allBranchMiniLabel}>{t("onSiteLow")}</span>
                </span>
                {late > 0 && (
                  <span className={styles.allBranchMiniStat}>
                    <span
                      className={styles.allBranchMiniDot}
                      style={{ background: "#d97706" }}
                    />
                    <span style={{ color: "#fbbf24" }}>{late}</span>
                    <span className={styles.allBranchMiniLabel}>{t("lateGroupLow")}</span>
                  </span>
                )}
                <span
                  className={styles.allBranchMiniStat}
                  style={{ marginLeft: "auto" }}
                >
                  <span
                    className={styles.allBranchMiniDot}
                    style={{ background: "#dc2626" }}
                  />
                  <span style={{ color: "#f87171" }}>{absent}</span>
                  <span className={styles.allBranchMiniLabel}>{t("absentLow")}</span>
                </span>
              </div>
            </div>
          );
        })}

      {loading && (
        <div className={styles.card}>
          <div className={styles.loadingText}>{t("loading")}</div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
const HomeTelegram = ({
  role = "employee",
  employee,
  shift,
  monthStats,
  onMonthChange,
  viewMode = "branch",
  loading = false,
  branch,
  stats,
  departments,
  employeeLists,
  branches,
  selectedBranchId,
  onBranchChange,
  allBranchesData,
  workPunch,
}) => {
  if (role === "admin") {
    if (viewMode === "absolute") {
      return (
        <AllBranchesPage
          allBranchesData={allBranchesData}
          loading={loading}
          workPunch={workPunch}
        />
      );
    }
    return (
      <AdminHomePage
        branch={branch}
        stats={stats}
        departments={departments}
        employeeLists={employeeLists}
        branches={branches}
        selectedBranchId={selectedBranchId}
        onBranchChange={onBranchChange}
        loading={loading}
        workPunch={workPunch}
      />
    );
  }

  return (
    <EmployeeHomePage
      employee={employee}
      shift={shift}
      monthStats={monthStats}
      onMonthChange={onMonthChange}
      workPunch={workPunch}
    />
  );
};

export default HomeTelegram;
