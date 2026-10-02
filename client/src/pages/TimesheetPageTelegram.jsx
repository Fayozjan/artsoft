import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getTimesheet, recalculateTimesheet } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import {
  downloadAttendanceToExcel,
  downloadFullAttendanceToExcel,
  downloadLatenessAttendanceToExcel,
} from "../utils/DownloadAttendanceToExcel";
import {
  getCurrentMonthISO,
  shiftMonth,
  monthLabel,
  buildCalendarByDay,
  employeeHasEvents,
  matchesEmployeeQuery,
  percent,
} from "../utils/timesheetTelegram";

import TimesheetEmployeesTelegram from "../components/TimesheetEmployeesTelegram";
import TimesheetMonthSheetTelegram from "../components/TimesheetMonthSheetTelegram";
import TgSheet from "../components/tg/TgSheet";
import AttendanceSummaryTelegram from "../components/AttendanceSummaryTelegram";
import {
  IconSearch,
  IconClose,
  IconFilter,
  IconRefresh,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconUsers,
  IconSun,
  IconAlarm,
  IconFlash,
  IconCalculator,
  IconDownload,
  IconLayers,
  IconUserOff,
} from "../components/tg/tgIcons";
import ui from "../components/tg/TgUi.module.scss";
import shell from "./AttendancePageTelegram.module.scss";
import styles from "./TimesheetPageTelegram.module.scss";

const EMPTY_SCOPE = { branch: "", department: "", position: "" };

const SelectField = ({ value, onChange, options, allLabel }) => (
  <span className={shell.select}>
    <select className={ui.input} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
    <IconChevronDown />
  </span>
);

const ListSkeleton = () => (
  <div className={shell.skeletonList}>
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className={shell.skeletonCard}>
        <span className={shell.skAvatar} />
        <div className={shell.skLines}>
          <span className={shell.skLine} style={{ width: "58%" }} />
          <span className={shell.skLine} style={{ width: "80%", height: 11 }} />
          <span className={shell.skLine} style={{ width: "42%", height: 22 }} />
        </div>
      </div>
    ))}
  </div>
);

// Табель в Telegram: месяц, сводка, карточки сотрудников с календарём дней.
const TimesheetPageTelegram = () => {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlertStore();
  const { viewMode } = useAuthStore((s) => s.userSettings) || {};
  const isBranchMode = viewMode === "branch";
  const language = i18n.language;

  const currentMonth = getCurrentMonthISO();
  const [month, setMonth] = useState(currentMonth);
  const monthRef = useRef(month);

  const [statusFilter, setStatusFilter] = useState("true");
  const statusRef = useRef(statusFilter);

  const [data, setData] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [hasEventsFilter, setHasEventsFilter] = useState("");
  const [scope, setScope] = useState(EMPTY_SCOPE);
  const [draft, setDraft] = useState({ scope: EMPTY_SCOPE, status: "true" });
  const [sheet, setSheet] = useState(null); // "month" | "filter" | "download" | "recalc" | null
  const [downloading, setDownloading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const scrollRef = useRef(null);
  const requestIdRef = useRef(0);

  const fetchData = useCallback(
    async (targetMonth = monthRef.current, status = statusRef.current) => {
      const requestId = ++requestIdRef.current;
      setRefreshing(true);

      try {
        const { data: rows, calendar: cal } = await getTimesheet({
          page: 1,
          pageSize: 99999,
          filters: {
            viewMode: "month",
            month: targetMonth,
            status,
            hasEvents: "",
            branch_ids: [],
            department_ids: [],
            position_ids: [],
            employee_ids: [],
          },
        });
        if (requestId !== requestIdRef.current) return;

        setData(rows || []);
        setCalendar(cal || []);
        setMonth(targetMonth);
        monthRef.current = targetMonth;
        setStatusFilter(status);
        statusRef.current = status;
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Ошибка при получении табеля:", error.message);
        showAlert(t("error"), "error");
      } finally {
        if (requestId === requestIdRef.current) {
          setRefreshing(false);
          setInitialLoading(false);
        }
      }
    },
    [showAlert, t],
  );

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePullToRefresh(() => fetchData(), scrollRef, refreshing);

  const changeMonth = (next) => {
    setSheet(null);
    if (next === month) return;
    fetchData(next, statusFilter);
  };

  const stepMonth = (direction) => {
    const next = shiftMonth(month, direction);
    if (next > currentMonth) return;
    changeMonth(next);
  };

  const calendarByDay = useMemo(() => buildCalendarByDay(calendar), [calendar]);

  const fallbacks = useMemo(
    () => ({ noBranch: t("noBranch"), noDepartment: t("noDepartment") }),
    [t],
  );

  const scopeEmployees = useMemo(
    () =>
      data.filter(
        (emp) =>
          (!scope.branch || (emp.branchName || fallbacks.noBranch) === scope.branch) &&
          (!scope.department ||
            (emp.departmentName || fallbacks.noDepartment) === scope.department) &&
          (!scope.position || emp.positionName === scope.position),
      ),
    [data, scope, fallbacks],
  );

  const withEventsIds = useMemo(() => {
    const set = new Set();
    scopeEmployees.forEach((emp) => {
      if (employeeHasEvents(emp)) set.add(emp.employeeId);
    });
    return set;
  }, [scopeEmployees]);

  const query = search.trim().toLowerCase();

  const listEmployees = useMemo(
    () =>
      scopeEmployees.filter((emp) => {
        if (!matchesEmployeeQuery(emp, query)) return false;
        if (hasEventsFilter === "yes") return withEventsIds.has(emp.employeeId);
        if (hasEventsFilter === "no") return !withEventsIds.has(emp.employeeId);
        return true;
      }),
    [scopeEmployees, query, hasEventsFilter, withEventsIds],
  );

  // ── Сводка ─────────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const total = scopeEmployees.length;
    const withEvents = scopeEmployees.filter((emp) => withEventsIds.has(emp.employeeId)).length;
    const withoutEvents = total - withEvents;

    const holidaysCount = [...calendarByDay.values()].filter(
      (d) => d.day_type === "holiday" || d.day_type === "weekend",
    ).length;

    const totals = scopeEmployees.reduce(
      (acc, emp) => {
        acc.late += emp.totalLateCount || 0;
        acc.overtime += emp.totalOvertimeMinutes || 0;
        acc.timeOffDays += emp.totalPaidTimeOffDays || 0;
        return acc;
      },
      { late: 0, overtime: 0, timeOffDays: 0 },
    );

    const rate = percent(withEvents, total);

    return {
      hero: {
        caption: t("timesheetTg.heroCaption"),
        value: withEvents,
        of: total,
        rate,
        rateLabel: t("attendanceTg.rate"),
        segments: [
          { tone: "green", value: withEvents },
          { tone: "red", value: withoutEvents },
        ],
        legend: [
          { tone: "green", label: t("withAttendance") },
          { tone: "red", label: t("withoutAttendance") },
        ],
      },
      tiles: [
        {
          key: "withEvents",
          tone: "green",
          label: t("withAttendance"),
          value: withEvents,
          icon: <IconUsers />,
          filterable: true,
        },
        {
          key: "withoutEvents",
          tone: "red",
          label: t("withoutAttendance"),
          value: withoutEvents,
          icon: <IconUserOff />,
          filterable: true,
        },
        {
          key: "holidays",
          tone: "purple",
          label: t("holidaysLabel"),
          value: holidaysCount,
          icon: <IconSun />,
        },
        {
          key: "late",
          tone: "amber",
          label: t("lateHours"),
          value: totals.late,
          icon: <IconAlarm />,
        },
        {
          key: "overtime",
          tone: "teal",
          label: t("overtimeHours"),
          value: `${Math.round(totals.overtime / 60)} ${t("hoursShort")}`,
          icon: <IconFlash />,
        },
      ],
    };
  }, [scopeEmployees, withEventsIds, calendarByDay, t]);

  const toggleHasEvents = (key) => {
    const value = key === "withEvents" ? "yes" : "no";
    setHasEventsFilter((prev) => (prev === value ? "" : value));
  };

  const activeTileKeys = useMemo(() => {
    const set = new Set();
    if (hasEventsFilter === "yes") set.add("withEvents");
    if (hasEventsFilter === "no") set.add("withoutEvents");
    return set;
  }, [hasEventsFilter]);

  // ── Фильтры ──────────────────────────────────────────────────────────────────

  const openFilter = () => {
    setDraft({ scope, status: statusFilter });
    setSheet("filter");
  };

  const applyFilter = () => {
    setScope(draft.scope);
    setSheet(null);
    if (draft.status !== statusFilter) fetchData(month, draft.status);
  };

  const resetDraft = () => setDraft({ scope: EMPTY_SCOPE, status: "true" });

  const branchOptions = useMemo(
    () => [...new Set(data.map((emp) => emp.branchName || fallbacks.noBranch))].sort(),
    [data, fallbacks],
  );

  const departmentOptions = useMemo(() => {
    const names = new Set();
    data
      .filter((emp) => !draft.scope.branch || (emp.branchName || fallbacks.noBranch) === draft.scope.branch)
      .forEach((emp) => names.add(emp.departmentName || fallbacks.noDepartment));
    return [...names].sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));
  }, [data, draft.scope.branch, fallbacks]);

  const positionOptions = useMemo(
    () => [...new Set(data.map((emp) => emp.positionName).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ru", { sensitivity: "base" }),
    ),
    [data],
  );

  const statusOptions = [
    { value: "", label: t("all") },
    { value: "true", label: t("active") },
    { value: "false", label: t("terminated") },
  ];

  const activeChips = [
    scope.branch && {
      key: "branch",
      label: scope.branch,
      onClear: () => setScope((prev) => ({ ...prev, branch: "" })),
    },
    scope.department && {
      key: "department",
      label: scope.department,
      onClear: () => setScope((prev) => ({ ...prev, department: "" })),
    },
    scope.position && {
      key: "position",
      label: scope.position,
      onClear: () => setScope((prev) => ({ ...prev, position: "" })),
    },
    statusFilter !== "true" && {
      key: "status",
      label: statusOptions.find((o) => o.value === statusFilter)?.label,
      onClear: () => fetchData(month, "true"),
    },
  ].filter(Boolean);

  const filterCount =
    (scope.branch ? 1 : 0) +
    (scope.department ? 1 : 0) +
    (scope.position ? 1 : 0) +
    (statusFilter !== "true" ? 1 : 0);

  // ── Пересчёт и скачивание ────────────────────────────────────────────────────

  const isPastMonth = month < currentMonth;

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await recalculateTimesheet(month);
      await fetchData(month, statusFilter);
      showAlert(t("recalculateTimesheetSuccess"), "success");
      setSheet(null);
    } catch (error) {
      console.error("Ошибка при пересчёте табеля:", error.message);
      showAlert(t("error"), "error");
    } finally {
      setRecalculating(false);
    }
  };

  const handleDownload = (type) => {
    setDownloading(true);
    setSheet(null);
    try {
      if (type === "summary") downloadAttendanceToExcel(listEmployees, month, "employeeFullName", "asc", null);
      else if (type === "full") downloadFullAttendanceToExcel(listEmployees, month, "employeeFullName", "asc", null);
      else downloadLatenessAttendanceToExcel(listEmployees, month, "employeeFullName", "asc", null);
    } catch (err) {
      console.error("Ошибка при скачивании:", err.message);
    } finally {
      setDownloading(false);
    }
  };

  const canStepForward = month < currentMonth;
  const stale = refreshing && !initialLoading;

  return (
    <div className={shell.page}>
      <div className={shell.topGlass} />

      <div className={shell.scroll} ref={scrollRef}>
        <header className={shell.header}>
          <h1 className={shell.title}>{t("timesheet")}</h1>

          <div className={styles.headerActions}>
            {isPastMonth && (
              <button
                type="button"
                className={shell.roundBtn}
                onClick={() => setSheet("recalc")}
                aria-label={t("timesheetTg.recalcTitle")}
              >
                <IconCalculator />
              </button>
            )}
            <button
              type="button"
              className={shell.roundBtn}
              onClick={() => setSheet("download")}
              aria-label={t("timesheetTg.download")}
            >
              <IconDownload />
            </button>
            <button
              type="button"
              className={`${shell.roundBtn} ${refreshing ? shell.spin : ""}`}
              onClick={() => fetchData()}
              aria-label={t("dashboard.refresh")}
            >
              <IconRefresh />
            </button>
          </div>
        </header>

        <div className={shell.dateBar}>
          <button
            type="button"
            className={shell.navBtn}
            onClick={() => stepMonth(-1)}
            aria-label={t("attendanceTg.prev")}
          >
            <IconChevronLeft />
          </button>

          <button type="button" className={shell.datePill} onClick={() => setSheet("month")}>
            <span className={shell.dateIcon}>
              <IconCalendar />
            </span>
            <span className={shell.dateText}>
              <b>{monthLabel(month, language)}</b>
            </span>
          </button>

          <button
            type="button"
            className={shell.navBtn}
            disabled={!canStepForward}
            onClick={() => stepMonth(1)}
            aria-label={t("attendanceTg.next")}
          >
            <IconChevronRight />
          </button>
        </div>

        <div className={`${shell.content} ${stale ? shell.stale : ""}`}>
          <AttendanceSummaryTelegram
            loading={initialLoading}
            hero={summary.hero}
            tiles={summary.tiles}
            activeKeys={activeTileKeys}
            onToggle={toggleHasEvents}
          />

          <div className={shell.sticky}>
            <div className={shell.searchRow}>
              <label className={shell.searchBox}>
                <span className={shell.searchIcon}>
                  <IconSearch />
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("search")}
                  enterKeyHint="search"
                  autoComplete="off"
                />
                {search && (
                  <button type="button" className={shell.clearBtn} onClick={() => setSearch("")} aria-label="clear">
                    <IconClose />
                  </button>
                )}
              </label>

              <button
                type="button"
                className={`${shell.roundBtn} ${shell.filterBtn} ${filterCount > 0 ? shell.roundBtnActive : ""}`}
                onClick={openFilter}
                aria-label={t("filters")}
              >
                <IconFilter />
                {filterCount > 0 && <span className={shell.badge}>{filterCount}</span>}
              </button>
            </div>

            {activeChips.length > 0 && (
              <div className={shell.activeChips}>
                {activeChips.map((chip) => (
                  <span key={chip.key} className={shell.activeChip}>
                    {chip.label}
                    <button type="button" onClick={chip.onClear} aria-label="clear">
                      <IconClose />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {initialLoading ? (
            <ListSkeleton />
          ) : (
            <TimesheetEmployeesTelegram
              employees={listEmployees}
              month={month}
              calendarByDay={calendarByDay}
              scrollRootRef={scrollRef}
            />
          )}
        </div>
      </div>

      <TimesheetMonthSheetTelegram
        isOpen={sheet === "month"}
        onClose={() => setSheet(null)}
        month={month}
        onApply={changeMonth}
      />

      <TgSheet
        isOpen={sheet === "filter"}
        onClose={() => setSheet(null)}
        title={t("filters")}
        footer={
          <div className={ui.btnRow}>
            <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={resetDraft}>
              {t("clearAll")}
            </button>
            <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={applyFilter}>
              {t("apply")}
            </button>
          </div>
        }
      >
        <div className={ui.form}>
          {!isBranchMode && (
            <div className={ui.field}>
              <label className={ui.label}>{t("branch")}</label>
              <SelectField
                value={draft.scope.branch}
                onChange={(branch) => setDraft((prev) => ({ ...prev, scope: { ...prev.scope, branch, department: "" } }))}
                options={branchOptions}
                allLabel={t("all")}
              />
            </div>
          )}

          <div className={ui.field}>
            <label className={ui.label}>{t("department")}</label>
            <SelectField
              value={draft.scope.department}
              onChange={(department) => setDraft((prev) => ({ ...prev, scope: { ...prev.scope, department } }))}
              options={departmentOptions}
              allLabel={t("all")}
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>{t("position")}</label>
            <SelectField
              value={draft.scope.position}
              onChange={(position) => setDraft((prev) => ({ ...prev, scope: { ...prev.scope, position } }))}
              options={positionOptions}
              allLabel={t("all")}
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>{t("status")}</label>
            <div className={styles.segmentedRow}>
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.segmentedBtn} ${draft.status === opt.value ? styles.segmentedBtnActive : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, status: opt.value }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </TgSheet>

      <TgSheet
        isOpen={sheet === "recalc"}
        onClose={() => setSheet(null)}
        title={t("timesheetTg.recalcTitle")}
        subtitle={t("recalculateTimesheetConfirm", { month: monthLabel(month, language) })}
        footer={
          <div className={ui.btnRow}>
            <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={() => setSheet(null)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnPrimary}`}
              disabled={recalculating}
              onClick={handleRecalculate}
            >
              <IconCalculator />
              {t("apply")}
            </button>
          </div>
        }
      >
        <div />
      </TgSheet>

      <TgSheet isOpen={sheet === "download"} onClose={() => setSheet(null)} title={t("timesheetTg.download")}>
        <div className={styles.downloadList}>
          <button type="button" className={styles.downloadItem} disabled={downloading} onClick={() => handleDownload("summary")}>
            <span className={styles.downloadIcon}>
              <IconLayers />
            </span>
            <span className={styles.downloadText}>
              <b>{t("summaryTimesheet")}</b>
              <small>{t("summaryData")}</small>
            </span>
          </button>

          <button type="button" className={styles.downloadItem} disabled={downloading} onClick={() => handleDownload("full")}>
            <span className={styles.downloadIcon}>
              <IconCalendar />
            </span>
            <span className={styles.downloadText}>
              <b>{t("detailedTimesheet")}</b>
              <small>{t("detailedData")}</small>
            </span>
          </button>

          <button type="button" className={styles.downloadItem} disabled={downloading} onClick={() => handleDownload("lateness")}>
            <span className={styles.downloadIcon}>
              <IconAlarm />
            </span>
            <span className={styles.downloadText}>
              <b>{t("latenessTimesheet")}</b>
              <small>{t("latenessData")}</small>
            </span>
          </button>
        </div>
      </TgSheet>
    </div>
  );
};

export default TimesheetPageTelegram;
