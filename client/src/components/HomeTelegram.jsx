import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { t as i18t } from "i18next";
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

// ─── Time badges per panel type ───────────────────────────────────────────────
const renderTimeBadges = (emp, panelKey) => {
  console.log("emp", emp);
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
export const EmployeeHomePage = ({
  employee,
  shift,
  monthStats,
  onMonthChange,
}) => {
  const { t } = useTranslation();
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

  return (
    <div className={styles.page}>
      <div className={styles.header} />

      {/* ── 1. Employee card ── */}
      <div className={styles.card}>
        <div className={styles.empHead}>
          <div className={styles.avatar}>
            {employee?.photo ? (
              <img
                src={`/api/employees/image/${employee.photo}`}
                alt={employee.name}
                className={styles.avatarImage}
              />
            ) : (
              getInitials(employee?.name)
            )}
          </div>
          <div className={styles.empInfo}>
            <div className={styles.empName}>
              {employee?.name || "—"} {employee?.id || ""}
            </div>
            <div className={styles.empPosition}>
              {employee?.position || "—"}
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.row}>
          <span className={styles.rowLabel}>{t("department")}</span>
          <span className={styles.rowValue}>{employee?.department || "—"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t("branch")}</span>
          <span className={styles.rowValue}>{employee?.branch || "—"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t("scheduleLabel")}</span>
          <span className={styles.rowValue}>{employee?.schedule || "—"}</span>
        </div>
      </div>

      {/* ── 2. Current shift ── */}
      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.sectionLabel} style={{ marginBottom: 0 }}>
            {HomeIcons.clock} {t("currentShift")}
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

        <div className={styles.shiftMainRow}>
          {shift?.workDuration && (
            <div className={styles.bigTime}>
              {shift.workDuration}
              <div className={styles.bigTimeSub}>{t("workDurationToday")}</div>
            </div>
          )}
          <div className={styles.checkInOutRow}>
            <div className={styles.checkCol}>
              <span className={styles.checkColLabel}>{t("checkIn")}</span>
              <span className={styles.rowValue}>{shift?.checkIn || "—"}</span>
              <span className={styles.checkColSched}>
                {shift?.scheduledIn || "—"}
              </span>
            </div>
            <div className={styles.checkCol}>
              <span className={styles.checkColLabel}>{t("checkOut")}</span>
              <span className={styles.rowValue}>{shift?.checkOut || "—"}</span>
              <span className={styles.checkColSched}>
                {shift?.scheduledOut || "—"}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        {shift?.late && (
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t("lateCol")}</span>
            <span className={`${styles.badge} ${styles.badgeRed}`}>
              +{shift.late}
            </span>
          </div>
        )}
        {shift?.breakReturnLate && (
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t("lateAfterBreak")}</span>
            <span className={`${styles.badge} ${styles.badgeAmber}`}>
              +{shift.breakReturnLate}
            </span>
          </div>
        )}
        {shift?.lateLeave && (
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t("overtime")}</span>
            <span className={`${styles.badge} ${styles.badgePurple}`}>
              +{shift.lateLeave}
            </span>
          </div>
        )}
      </div>

      {/* ── 3. Month stats ── */}
      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.sectionLabel} style={{ marginBottom: 0 }}>
            {HomeIcons.calendar} {t("forMonth")}
          </div>
          <div className={styles.monthNav}>
            <button className={styles.monthBtn} onClick={prevMonth}>
              {HomeIcons.chevronLeft}
            </button>
            <span className={styles.monthLabel}>
              {getMonthsShort()[month]} {year}
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
          color="#22c55e"
          label={t("workedDaysMonth")}
          value={
            monthStats
              ? `${monthStats.workedDays} / ${monthStats.totalDays} ${t("daysAbbr")}`
              : "—"
          }
        />
        <MonthStatRow
          color="#3b82f6"
          label={t("totalHoursMonth")}
          value={
            monthStats
              ? `${formatDuration(monthStats.totalMinutes)} / ${formatDuration(monthStats.scheduledMinutes)}`
              : "—"
          }
        />
        <MonthStatRow
          color="#ef4444"
          label={t("lateAtWork")}
          value={
            monthStats
              ? `${monthStats.lateCount} ${t("times")}${monthStats.lateTotalMinutes > 0 ? ` (${formatDuration(monthStats.lateTotalMinutes)})` : ""}`
              : "—"
          }
          valueColor={monthStats?.lateCount > 0 ? "#ef4444" : undefined}
        />
        {monthStats?.breakReturnLateCount > 0 && (
          <MonthStatRow
            color="#f87171"
            label={t("lateAfterBreak")}
            value={`${monthStats.breakReturnLateCount} ${t("times")}${monthStats.breakReturnLateMinutes > 0 ? ` (${formatDuration(monthStats.breakReturnLateMinutes)})` : ""}`}
            valueColor="#f87171"
          />
        )}
        <MonthStatRow
          color="#64748b"
          label={t("absences")}
          value={monthStats ? `${monthStats.absentDays} ${t("daysAbbr")}` : "—"}
          valueColor={monthStats?.absentDays > 0 ? "#64748b" : undefined}
        />
        <MonthStatRow
          color="#f59e0b"
          label={t("leftEarly")}
          value={
            monthStats
              ? `${monthStats.earlyLeave} ${t("times")}${monthStats.earlyLeaveMinutes > 0 ? ` (${formatDuration(monthStats.earlyLeaveMinutes)})` : ""}`
              : "—"
          }
          valueColor={monthStats?.earlyLeave > 0 ? "#f59e0b" : undefined}
        />
        <MonthStatRow
          color="#10b981"
          label={t("leftLate")}
          value={
            monthStats
              ? `${monthStats.lateLeaveCount} ${t("times")}${monthStats.lateLeaveMinutes > 0 ? ` (${formatDuration(monthStats.lateLeaveMinutes)})` : ""}`
              : "—"
          }
          valueColor={monthStats?.lateLeaveCount > 0 ? "#10b981" : undefined}
        />
        {monthStats?.pastNoExitCount > 0 && (
          <MonthStatRow
            color="#a855f7"
            label={t("noExit")}
            value={`${monthStats.pastNoExitCount} ${t("daysAbbr")}`}
            valueColor="#a855f7"
          />
        )}
      </div>
    </div>
  );
};

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
export const AllBranchesPage = ({ allBranchesData, loading }) => {
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
}) => {
  if (role === "admin") {
    if (viewMode === "absolute") {
      return (
        <AllBranchesPage allBranchesData={allBranchesData} loading={loading} />
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
      />
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
