import { useState, useEffect } from "react";
import styles from "./HomeTelegram.module.scss";

// ─── Icons (inline SVG, same pattern as your Icons file) ─────────────────────
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
  user: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
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
};

const MONTHS_SHORT = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

// ─── STATUS config (same as AttendancePage) ───────────────────────────────────
const STATUSES = [
  { key: "present", label: "Пришли", color: "#4ade80", dot: "#16a34a" },
  { key: "absent", label: "Не пришли", color: "#f87171", dot: "#dc2626" },
  { key: "late", label: "Опоздали", color: "#fbbf24", dot: "#d97706" },
  { key: "inside", label: "На месте", color: "#60a5fa", dot: "#2563eb" },
  { key: "left", label: "Ушли", color: "#a78bfa", dot: "#7c3aed" },
];

// ─── Helper: initials from full name ─────────────────────────────────────────
const getInitials = (name = "") =>
  name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// ─── Helper: format minutes → "X ч Y мин" ────────────────────────────────────
const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export const EmployeeHomePage = ({
  employee,
  shift,
  monthStats,
  onMonthChange,
}) => {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const prevMonth = () => {
    let m = month - 1,
      y = year;
    if (m < 0) {
      m = 11;
      y--;
    }
    setMonth(m);
    setYear(y);
    onMonthChange?.({ month: m + 1, year: y });
  };

  const nextMonth = () => {
    let m = month + 1,
      y = year;
    if (m > 11) {
      m = 0;
      y++;
    }
    setMonth(m);
    setYear(y);
    onMonthChange?.({ month: m + 1, year: y });
  };

  const isCurrentMonth =
    month === today.getMonth() && year === today.getFullYear();

  // Status config for shift badge
  const shiftStatusMap = {
    present: { label: "Пришёл", cls: styles.badgeGreen },
    absent: { label: "Не пришёл", cls: styles.badgeRed },
    late: { label: "Опоздал", cls: styles.badgeAmber },
    inside: { label: "На месте", cls: styles.badgeBlue },
    left: { label: "Ушёл", cls: styles.badgePurple },
    leftEarly: { label: "Ушёл рано", cls: styles.badgePink },
  };
  const shiftStatus = shiftStatusMap[shift?.status] || {
    label: "—",
    cls: styles.badgeGray,
  };

  return (
    <div className={styles.page}>
      {/* ── 1. Employee card ── */}
      <div className={styles.card}>
        <div className={styles.empHead}>
          <div className={styles.avatar}>{getInitials(employee?.name)}</div>
          <div className={styles.empInfo}>
            <div className={styles.empName}>{employee?.name || "—"}</div>
            <div className={styles.empPosition}>
              {employee?.position || "—"}
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.row}>
          <span className={styles.rowLabel}>Отдел</span>
          <span className={styles.rowValue}>{employee?.department || "—"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Филиал</span>
          <span className={styles.rowValue}>{employee?.branch || "—"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>График</span>
          <span className={styles.rowValue}>{employee?.schedule || "—"}</span>
        </div>
      </div>

      {/* ── 2. Current shift ── */}
      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.sectionLabel} style={{ marginBottom: 0 }}>
            {HomeIcons.clock}
            Текущая смена
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

        {shift?.workedMinutes != null && (
          <>
            <div className={styles.bigTime}>
              {formatDuration(shift.workedMinutes)}
            </div>
            <div className={styles.bigTimeSub}>Время на работе сегодня</div>
          </>
        )}

        <div className={styles.divider} />

        <div className={styles.row}>
          <span className={styles.rowLabel}>Пришёл</span>
          <span className={styles.rowValue}>{shift?.checkIn || "—"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Ушёл</span>
          <span className={styles.rowValue}>{shift?.checkOut || "—"}</span>
        </div>

        {shift?.lateMinutes > 0 && (
          <div className={styles.row}>
            <span className={styles.rowLabel}>Опоздание</span>
            <span className={`${styles.badge} ${styles.badgeAmber}`}>
              +{formatDuration(shift.lateMinutes)}
            </span>
          </div>
        )}

        {shift?.extraMinutes > 0 && (
          <div className={styles.row}>
            <span className={styles.rowLabel}>Переработка</span>
            <span className={`${styles.badge} ${styles.badgePurple}`}>
              +{formatDuration(shift.extraMinutes)}
            </span>
          </div>
        )}
      </div>

      {/* ── 3. Month stats ── */}
      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.sectionLabel} style={{ marginBottom: 0 }}>
            {HomeIcons.calendar}
            За месяц
          </div>
          <div className={styles.monthNav}>
            <button className={styles.monthBtn} onClick={prevMonth}>
              {HomeIcons.chevronLeft}
            </button>
            <span className={styles.monthLabel}>
              {MONTHS_SHORT[month]} {year}
            </span>
            <button
              className={styles.monthBtn}
              onClick={nextMonth}
              disabled={isCurrentMonth}
            >
              {HomeIcons.chevronRight}
            </button>
          </div>
        </div>

        <div className={styles.divider} />

        <MonthStatRow
          color="#4ade80"
          label="Рабочих дней"
          value={
            monthStats
              ? `${monthStats.workedDays} / ${monthStats.totalDays}`
              : "—"
          }
        />
        <MonthStatRow
          color="#60a5fa"
          label="Всего часов"
          value={monthStats ? formatDuration(monthStats.totalMinutes) : "—"}
        />
        <MonthStatRow
          color="#fbbf24"
          label="Опозданий"
          value={monthStats ? `${monthStats.lateCount} раз` : "—"}
          valueColor={monthStats?.lateCount > 0 ? "#fbbf24" : undefined}
        />
        <MonthStatRow
          color="#a78bfa"
          label="Доп. время"
          value={
            monthStats?.extraMinutes > 0
              ? `+${formatDuration(monthStats.extraMinutes)}`
              : "—"
          }
          valueColor="#a78bfa"
        />
        <MonthStatRow
          color="#f87171"
          label="Пропусков"
          value={monthStats ? `${monthStats.absentDays} дн.` : "—"}
          valueColor={monthStats?.absentDays > 0 ? "#f87171" : undefined}
        />
        <MonthStatRow
          color="#34d399"
          label="Ушёл вовремя"
          value={monthStats ? `${monthStats.onTimeLeave} раз` : "—"}
        />
        <MonthStatRow
          color="#f472b6"
          label="Ушёл раньше"
          value={monthStats ? `${monthStats.earlyLeave} раз` : "—"}
          valueColor={monthStats?.earlyLeave > 0 ? "#f472b6" : undefined}
        />
      </div>
    </div>
  );
};

// small helper row
const MonthStatRow = ({ color, label, value, valueColor }) => (
  <div className={styles.statRow}>
    <div className={styles.statRowLeft}>
      <span className={styles.statDot} style={{ background: color }} />
      <span className={styles.rowLabel}>{label}</span>
    </div>
    <span
      className={styles.rowValue}
      style={valueColor ? { color: valueColor } : {}}
    >
      {value}
    </span>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN / USER PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export const AdminHomePage = ({ branch, stats, departments }) => {
  const total = stats?.total || 0;

  const getPercent = (count) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  const maxDeptCount = departments?.length
    ? Math.max(...departments.map((d) => d.present))
    : 1;

  return (
    <div className={styles.page}>
      {/* ── 1. Branch card ── */}
      <div className={styles.card}>
        <div className={styles.sectionLabel}>
          {HomeIcons.building}
          Филиал
        </div>

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

        <div className={styles.row}>
          <span className={styles.rowLabel}>Всего сотрудников</span>
          <span className={styles.rowValue}>
            {branch?.totalEmployees ?? "—"}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Отделов</span>
          <span className={styles.rowValue}>
            {branch?.departmentCount ?? "—"}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Активны сейчас</span>
          <span className={`${styles.badge} ${styles.badgeBlue}`}>
            {stats?.inside ?? 0}
          </span>
        </div>
      </div>

      {/* ── 2. Today's stats ── */}
      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.sectionLabel} style={{ marginBottom: 0 }}>
            {HomeIcons.users}
            Статистика за сегодня
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
            <div className={styles.totalNum}>{total}</div>
            <div className={styles.totalLabel}>сотрудников всего</div>
          </div>
          <div className={styles.totalBar}>
            {STATUSES.filter((s) =>
              ["present", "absent", "late"].includes(s.key),
            ).map((s) => {
              const count = stats?.[s.key] || 0;
              const pct = getPercent(count);
              return pct > 0 ? (
                <div
                  key={s.key}
                  className={styles.totalBarSegment}
                  style={{ width: `${pct}%`, background: s.dot }}
                  title={`${s.label}: ${count}`}
                />
              ) : null;
            })}
          </div>
        </div>

        <div className={styles.statusList}>
          {STATUSES.filter((s) => stats?.[s.key] != null).map((s) => {
            const count = stats[s.key] || 0;
            const pct = getPercent(count);
            return (
              <div className={styles.statusRow} key={s.key}>
                <div className={styles.statusLeft}>
                  <span
                    className={styles.statusDot}
                    style={{ background: s.dot }}
                  />
                  <span className={styles.statusName}>{s.label}</span>
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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. By department ── */}
      {departments?.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionLabel}>
            {HomeIcons.briefcase}
            Присутствие по отделам
          </div>

          <div className={styles.deptList}>
            {departments.map((dep, i) => {
              const barPct =
                maxDeptCount > 0
                  ? Math.round((dep.present / maxDeptCount) * 100)
                  : 0;
              const depPct =
                dep.total > 0 ? Math.round((dep.present / dep.total) * 100) : 0;

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
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — switches by role
// ═══════════════════════════════════════════════════════════════════════════════
const HomeTelegram = ({
  role = "employee", // "employee" | "admin"
  employee,
  shift,
  monthStats,
  onMonthChange,
  branch,
  stats,
  departments,
}) => {
  if (role === "admin") {
    return (
      <AdminHomePage branch={branch} stats={stats} departments={departments} />
    );
  }

  return (
    <EmployeeHomePage
      employee={employee}
      shift={shift}
      monthStats={monthStats}
      onMonthChange={onMonthChange}
    />
  );
};

export default HomeTelegram;
