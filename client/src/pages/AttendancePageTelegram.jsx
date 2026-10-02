import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getAttendance } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { prepareAttendanceData } from "../utils/prepareAttendanceData";
import { prepareAttendancePeriodData } from "../utils/prepareAttendancePeriodData";
import {
  STATUS_META,
  buildAttendanceFilters,
  daysInRange,
  formatDate,
  percent,
  shiftISODate,
  todayISO,
  toneStyle,
} from "../utils/attendanceTelegram";
import {
  buildDayGroups,
  buildPeriodGroups,
} from "../utils/attendanceGroupsTelegram";

import AttendanceSummaryTelegram from "../components/AttendanceSummaryTelegram";
import AttendanceTableTelegram from "../components/AttendanceTableTelegram";
import AttendanceGroupsTelegram from "../components/AttendanceGroupsTelegram";
import AttendancePeriodTelegram from "../components/AttendancePeriodTelegram";
import AttendanceDateSheetTelegram from "../components/AttendanceDateSheetTelegram";
import TgSheet from "../components/tg/TgSheet";
import {
  IconSearch,
  IconClose,
  IconFilter,
  IconRefresh,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconUserCheck,
  IconUserOff,
  IconClock,
  IconMapPin,
  IconLogOut,
  IconSun,
  IconUsers,
} from "../components/tg/tgIcons";
import ui from "../components/tg/TgUi.module.scss";
import styles from "./AttendancePageTelegram.module.scss";

const EMPTY_SCOPE = { branch: "", department: "" };

// Порядок плиток и их иконки; inside / left показываются только за сегодня
const DAY_TILE_KEYS = ["present", "absent", "late", "inside", "left", "onTimeOff"];

const TILE_ICONS = {
  present: <IconUserCheck />,
  absent: <IconUserOff />,
  late: <IconClock />,
  inside: <IconMapPin />,
  left: <IconLogOut />,
  onTimeOff: <IconSun />,
};

const SelectField = ({ value, onChange, options, allLabel }) => (
  <span className={styles.select}>
    <select
      className={ui.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
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
  <div className={styles.skeletonList}>
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className={styles.skeletonCard}>
        <span className={styles.skAvatar} />
        <div className={styles.skLines}>
          <span className={styles.skLine} style={{ width: "58%" }} />
          <span className={styles.skLine} style={{ width: "80%", height: 11 }} />
          <span className={styles.skLine} style={{ width: "42%", height: 22 }} />
        </div>
      </div>
    ))}
  </div>
);

// Посещаемость в Telegram: явка за день или период, плитки статусов, сотрудники,
// отделы и филиалы. Данные и режимы те же, что в веб-версии.
const AttendancePageTelegram = () => {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlertStore();
  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};
  const isBranchMode = viewMode === "branch";
  const language = i18n.language;

  const today = todayISO();

  const [range, setRange] = useState(() => ({ from: today, to: today }));
  const rangeRef = useRef(range);

  const [data, setData] = useState(null);
  // Диапазон, для которого пришли показанные данные — режим считаем по нему,
  // чтобы экран не перестраивался, пока грузится следующий
  const [applied, setApplied] = useState(range);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState(() => new Set());
  const [scope, setScope] = useState(EMPTY_SCOPE);
  const [draftScope, setDraftScope] = useState(EMPTY_SCOPE);
  const [view, setView] = useState("employees"); // employees | departments | branches
  const [periodView, setPeriodView] = useState("days"); // days | groups
  const [sheet, setSheet] = useState(null); // "date" | "filter" | null

  const scrollRef = useRef(null);
  const requestIdRef = useRef(0);

  // ── Загрузка ───────────────────────────────────────────────────────────────

  const fetchData = useCallback(
    async (target = rangeRef.current) => {
      const requestId = ++requestIdRef.current;
      setRefreshing(true);

      try {
        const { data: rows } = await getAttendance({
          filters: buildAttendanceFilters(target),
        });
        if (requestId !== requestIdRef.current) return;

        setData(rows);
        setApplied(target);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Ошибка при получении данных:", error.message);
        showAlert(t("errorLoading"), "error");
      } finally {
        if (requestId === requestIdRef.current) {
          setRefreshing(false);
          setInitialLoading(false);
        }
      }
    },
    [showAlert, t],
  );

  // В режиме одного филиала данные зависят от активного филиала
  const branchKey = isBranchMode ? activeBranchId : null;

  useEffect(() => {
    fetchData();
  }, [branchKey]);

  usePullToRefresh(() => fetchData(), scrollRef, refreshing);

  const changeRange = (next) => {
    setSheet(null);
    if (next.from === range.from && next.to === range.to) return;

    setRange(next);
    rangeRef.current = next;

    if (next.from !== next.to) {
      // За период нет ни статусов по сотрудникам, ни фильтра по группе
      setStatusFilters(new Set());
      setScope(EMPTY_SCOPE);
    } else if (next.from !== today) {
      // «На месте» / «ушли» — мгновенные статусы, для прошлых дат их нет
      setStatusFilters(
        (prev) =>
          new Set([...prev].filter((key) => !STATUS_META[key].todayOnly)),
      );
    }

    fetchData(next);
  };

  // Шаг стрелками: на день назад/вперёд, для периода — на его длину. В будущее не уходим.
  const stepRange = (direction) => {
    const length = daysInRange(range);
    let delta = direction * length;

    if (direction > 0) {
      const room = daysInRange({ from: range.to, to: today }) - 1;
      delta = Math.min(delta, room);
      if (delta <= 0) return;
    }

    changeRange({
      from: shiftISODate(range.from, delta),
      to: shiftISODate(range.to, delta),
    });
  };

  // ── Производные данные ─────────────────────────────────────────────────────

  const isPeriod = applied.from !== applied.to;
  const isToday = !isPeriod && applied.from === today;
  const stale =
    refreshing && (applied.from !== range.from || applied.to !== range.to);

  const fallbacks = useMemo(
    () => ({ noBranch: t("noBranch"), noDepartment: t("noDepartment") }),
    [t],
  );

  // День: филиал → отдел → сотрудники
  const dayBranches = useMemo(
    () =>
      !isPeriod && data?.employees
        ? prepareAttendanceData(data, fallbacks)
        : [],
    [data, isPeriod, fallbacks],
  );

  // Период: итоги по филиалам и отделам
  const periodRows = useMemo(
    () =>
      isPeriod && data?.employees
        ? prepareAttendancePeriodData(data, fallbacks)
        : [],
    [data, isPeriod, fallbacks],
  );

  const scopeEmployees = useMemo(() => {
    let list = dayBranches.flatMap((branch) => branch.employees);

    if (scope.branch) {
      list = list.filter(
        (emp) => (emp.branchName || fallbacks.noBranch) === scope.branch,
      );
    }
    if (scope.department) {
      list = list.filter(
        (emp) =>
          (emp.departmentName || fallbacks.noDepartment) === scope.department,
      );
    }
    return list;
  }, [dayBranches, scope, fallbacks]);

  const counts = useMemo(() => {
    const result = { total: scopeEmployees.length };
    DAY_TILE_KEYS.forEach((key) => {
      result[key] = scopeEmployees.filter((emp) => emp[key]).length;
    });
    return result;
  }, [scopeEmployees]);

  const showSearch = !isPeriod || periodView === "groups";
  const query = showSearch ? search.trim().toLowerCase() : "";

  const listEmployees = useMemo(
    () =>
      scopeEmployees.filter((emp) => {
        if (
          query &&
          ![
            emp.employeeFullName,
            emp.employeeNumber,
            emp.positionName,
            emp.departmentName,
            emp.branchName,
          ].some((value) => String(value ?? "").toLowerCase().includes(query))
        ) {
          return false;
        }

        return (
          statusFilters.size === 0 ||
          [...statusFilters].some((key) => emp[key] === true)
        );
      }),
    [scopeEmployees, query, statusFilters],
  );

  // График и длительность смены есть только в исходных списках дня
  const extras = useMemo(() => {
    const map = new Map();
    (data?.absent || []).forEach((item) =>
      map.set(item.employeeId, { scheduledStart: item.scheduledStart }),
    );
    (data?.present || []).forEach((item) =>
      map.set(item.employeeId, {
        scheduledStart: item.scheduledStart,
        workDuration: item.workDuration,
      }),
    );
    return map;
  }, [data]);

  const groupView = isBranchMode || view === "departments" ? "departments" : "branches";

  const dayGroups = useMemo(
    () =>
      isPeriod || view === "employees"
        ? []
        : buildDayGroups(dayBranches, {
            view: groupView,
            isToday,
            t,
            scope,
            query,
          }),
    [dayBranches, isPeriod, view, groupView, isToday, t, scope, query],
  );

  const periodGroups = useMemo(
    () =>
      isPeriod && periodView === "groups"
        ? buildPeriodGroups(periodRows, {
            view: isBranchMode ? "departments" : "branches",
            t,
            query,
          })
        : [],
    [isPeriod, periodView, periodRows, isBranchMode, t, query],
  );

  // ── Сводка ─────────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    if (isPeriod) {
      const totals = periodRows.reduce(
        (acc, row) => {
          acc.scheduled += row.scheduledDays;
          acc.worked += row.workedDays;
          acc.absent += row.absentDays;
          acc.timeOff += row.timeOffDays;
          acc.late += row.lateDays;
          return acc;
        },
        { scheduled: 0, worked: 0, absent: 0, timeOff: 0, late: 0 },
      );

      const days = data?.days || [];
      const workingDays = days.filter((day) => day.scheduledEmployees > 0).length;

      const latePct = percent(totals.late, totals.worked);
      const absentPct = percent(totals.absent, totals.scheduled);

      return {
        hero: {
          caption: t("attendanceTg.heroPeriod"),
          value: totals.worked,
          of: totals.scheduled,
          note: t("attendanceTg.daysCount", { count: days.length }),
          rate: percent(totals.worked, totals.scheduled),
          rateLabel: t("attendanceTg.rate"),
          segments: [
            { tone: "green", value: totals.worked },
            { tone: "teal", value: totals.timeOff },
            { tone: "red", value: totals.absent },
          ],
          legend: [
            { tone: "green", label: t("attendanceTg.workedShort") },
            { tone: "teal", label: t("attendanceTg.timeOffShort") },
            { tone: "red", label: t("attendanceTg.absentShort") },
          ],
        },
        tiles: [
          {
            key: "employees",
            tone: "blue",
            label: t("employees"),
            value: data?.employees?.length || 0,
            icon: <IconUsers />,
          },
          {
            key: "workingDays",
            tone: "green",
            label: t("attendanceTg.workingDays"),
            value: workingDays,
            icon: <IconCalendar />,
          },
          {
            key: "dayOffDays",
            tone: "gray",
            label: t("dayOffDaysLabel"),
            value: days.length - workingDays,
            icon: <IconSun />,
          },
          {
            key: "lateDays",
            tone: "amber",
            label: t("attendanceTg.lateDays"),
            value: totals.late,
            sub: latePct == null ? null : `${latePct}%`,
            progress: latePct ?? 0,
            icon: <IconClock />,
          },
          {
            key: "absentDays",
            tone: "red",
            label: t("attendanceTg.absentDays"),
            value: totals.absent,
            sub: absentPct == null ? null : `${absentPct}%`,
            progress: absentPct ?? 0,
            icon: <IconUserOff />,
          },
        ],
      };
    }

    // База процента: «пришли» и «не пришли» — от всех, остальное — от пришедших
    const baseFor = (key) =>
      key === "present" || key === "absent" || key === "onTimeOff"
        ? counts.total
        : counts.present;

    const tiles = DAY_TILE_KEYS.filter((key) => {
      if (STATUS_META[key].todayOnly && !isToday) return false;
      // «В отпуске» — редкий статус: без сотрудников плитку не занимаем
      return key !== "onTimeOff" || counts.onTimeOff > 0 || statusFilters.has(key);
    }).map((key) => {
      const pct = percent(counts[key], baseFor(key));
      return {
        key,
        tone: STATUS_META[key].tone,
        label: t(STATUS_META[key].labelKey),
        value: counts[key],
        sub: pct == null ? null : `${pct}%`,
        progress: pct ?? 0,
        icon: TILE_ICONS[key],
        filterable: true,
      };
    });

    return {
      hero: {
        caption: isToday ? t("attendanceTg.heroToday") : t("attendanceTg.heroDay"),
        value: counts.present,
        of: counts.total,
        rate: percent(counts.present, counts.total),
        rateLabel: t("attendanceTg.rate"),
        segments: [
          { tone: "green", value: counts.present },
          { tone: "teal", value: counts.onTimeOff },
          { tone: "red", value: counts.absent },
        ],
        legend: [
          { tone: "green", label: t("checkedIn") },
          { tone: "teal", label: t("onCompanyTimeOff") },
          { tone: "red", label: t("notCheckedIn") },
        ],
      },
      tiles,
    };
  }, [isPeriod, periodRows, data, counts, isToday, statusFilters, t]);

  // ── Управление фильтрами ───────────────────────────────────────────────────

  const toggleStatus = (key) =>
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Тап по карточке филиала / отдела: открываем список сотрудников этой группы
  const selectGroup = ({ branch = "", department = "" }) => {
    // В режиме одного филиала филиал и так один — отдельный фильтр не нужен
    setScope({ branch: isBranchMode ? "" : branch, department });
    setView("employees");
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openFilter = () => {
    setDraftScope(scope);
    setSheet("filter");
  };

  const applyFilter = () => {
    setScope(draftScope);
    setSheet(null);
  };

  const branchOptions = useMemo(
    () => dayBranches.map((branch) => branch.name),
    [dayBranches],
  );

  const departmentOptions = useMemo(() => {
    const names = new Set();
    dayBranches
      .filter((branch) => !draftScope.branch || branch.name === draftScope.branch)
      .forEach((branch) =>
        branch.departments.forEach((dept) => names.add(dept.name)),
      );
    return [...names].sort((a, b) =>
      a.localeCompare(b, "ru", { sensitivity: "base" }),
    );
  }, [dayBranches, draftScope.branch]);

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
    ...[...statusFilters].map((key) => ({
      key,
      tone: STATUS_META[key].tone,
      label: t(STATUS_META[key].labelKey),
      onClear: () => toggleStatus(key),
    })),
  ].filter(Boolean);

  const filterCount = (scope.branch ? 1 : 0) + (scope.department ? 1 : 0);

  // ── Подписи ────────────────────────────────────────────────────────────────

  const dateLabel = useMemo(() => {
    const fmt = (iso, options) => formatDate(iso, language, options);

    if (range.from === range.to) {
      const relative =
        range.from === today
          ? t("attendanceTg.today")
          : range.from === shiftISODate(today, -1)
            ? t("attendanceTg.yesterday")
            : null;

      if (relative) {
        return {
          title: relative,
          sub: fmt(range.from, { weekday: "long", day: "numeric", month: "long" }),
        };
      }

      return {
        title: fmt(range.from, { day: "numeric", month: "long" }),
        sub: fmt(range.from, { weekday: "long", year: "numeric" }),
      };
    }

    return {
      title: `${fmt(range.from, { day: "numeric", month: "short" })} — ${fmt(range.to, { day: "numeric", month: "short" })}`,
      sub: `${t("attendanceTg.daysCount", { count: daysInRange(range) })} · ${fmt(range.to, { year: "numeric" })}`,
    };
  }, [range, today, language, t]);

  const segments = isPeriod
    ? [
        { value: "days", label: t("attendanceTg.viewDays") },
        {
          value: "groups",
          label: isBranchMode
            ? t("attendanceTg.viewDepartments")
            : t("attendanceTg.viewBranches"),
        },
      ]
    : [
        { value: "employees", label: t("attendanceTg.viewEmployees") },
        { value: "departments", label: t("attendanceTg.viewDepartments") },
        ...(isBranchMode
          ? []
          : [{ value: "branches", label: t("attendanceTg.viewBranches") }]),
      ];

  const activeSegment = isPeriod ? periodView : view;
  const selectSegment = isPeriod ? setPeriodView : setView;

  // ── Список ─────────────────────────────────────────────────────────────────

  let list;
  if (initialLoading) {
    list = <ListSkeleton />;
  } else if (isPeriod) {
    list =
      periodView === "days" ? (
        <AttendancePeriodTelegram days={data?.days || []} isBranchMode={isBranchMode} />
      ) : (
        <AttendanceGroupsTelegram groups={periodGroups} />
      );
  } else if (view === "employees") {
    list = (
      <AttendanceTableTelegram
        employees={listEmployees}
        extras={extras}
        isToday={isToday}
        scrollRootRef={scrollRef}
      />
    );
  } else {
    list = <AttendanceGroupsTelegram groups={dayGroups} onSelect={selectGroup} />;
  }

  const canStepForward = range.to < today;

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <div className={styles.scroll} ref={scrollRef}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t("attendance")}</h1>

          <button
            type="button"
            className={`${styles.roundBtn} ${refreshing ? styles.spin : ""}`}
            onClick={() => fetchData()}
            aria-label={t("dashboard.refresh")}
          >
            <IconRefresh />
          </button>
        </header>

        <div className={styles.dateBar}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => stepRange(-1)}
            aria-label={t("attendanceTg.prev")}
          >
            <IconChevronLeft />
          </button>

          <button
            type="button"
            className={styles.datePill}
            onClick={() => setSheet("date")}
          >
            <span className={styles.dateIcon}>
              <IconCalendar />
            </span>
            <span className={styles.dateText}>
              <b>{dateLabel.title}</b>
              <small>{dateLabel.sub}</small>
            </span>
          </button>

          <button
            type="button"
            className={styles.navBtn}
            disabled={!canStepForward}
            onClick={() => stepRange(1)}
            aria-label={t("attendanceTg.next")}
          >
            <IconChevronRight />
          </button>
        </div>

        <div className={`${styles.content} ${stale ? styles.stale : ""}`}>
          <AttendanceSummaryTelegram
            loading={initialLoading}
            hero={summary.hero}
            tiles={summary.tiles}
            activeKeys={statusFilters}
            onToggle={toggleStatus}
          />

          <div className={styles.sticky}>
            {showSearch && (
              <div className={styles.searchRow}>
                <label className={styles.searchBox}>
                  <span className={styles.searchIcon}>
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
                    <button
                      type="button"
                      className={styles.clearBtn}
                      onClick={() => setSearch("")}
                      aria-label="clear"
                    >
                      <IconClose />
                    </button>
                  )}
                </label>

                {!isPeriod && (
                  <button
                    type="button"
                    className={`${styles.roundBtn} ${styles.filterBtn} ${filterCount > 0 ? styles.roundBtnActive : ""}`}
                    onClick={openFilter}
                    aria-label={t("filters")}
                  >
                    <IconFilter />
                    {filterCount > 0 && <span className={styles.badge}>{filterCount}</span>}
                  </button>
                )}
              </div>
            )}

            <div className={styles.segment} role="tablist">
              {segments.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={activeSegment === item.value}
                  className={`${styles.segmentItem} ${activeSegment === item.value ? styles.segmentActive : ""}`}
                  onClick={() => selectSegment(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {activeChips.length > 0 && (
              <div className={styles.activeChips}>
                {activeChips.map((chip) => (
                  <span
                    key={chip.key}
                    className={styles.activeChip}
                    style={chip.tone ? toneStyle(chip.tone) : undefined}
                  >
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.onClear}
                      aria-label="clear"
                    >
                      <IconClose />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {list}
        </div>
      </div>

      <AttendanceDateSheetTelegram
        isOpen={sheet === "date"}
        onClose={() => setSheet(null)}
        range={range}
        onApply={changeRange}
      />

      <TgSheet
        isOpen={sheet === "filter"}
        onClose={() => setSheet(null)}
        title={t("filters")}
        footer={
          <div className={ui.btnRow}>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onClick={() => setDraftScope(EMPTY_SCOPE)}
            >
              {t("clearAll")}
            </button>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnPrimary}`}
              onClick={applyFilter}
            >
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
                value={draftScope.branch}
                onChange={(branch) =>
                  setDraftScope((prev) => ({ ...prev, branch, department: "" }))
                }
                options={branchOptions}
                allLabel={t("all")}
              />
            </div>
          )}

          <div className={ui.field}>
            <label className={ui.label}>{t("department")}</label>
            <SelectField
              value={draftScope.department}
              onChange={(department) =>
                setDraftScope((prev) => ({ ...prev, department }))
              }
              options={departmentOptions}
              allLabel={t("all")}
            />
          </div>
        </div>
      </TgSheet>
    </div>
  );
};

export default AttendancePageTelegram;
