import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getLateEmployees } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import {
  buildAttendanceFilters,
  daysInRange,
  formatDate,
  shiftISODate,
  todayISO,
  toneStyle,
} from "../utils/attendanceTelegram";
import {
  SEVERITY_TONES,
  SORT_KEYS,
  buildLateDays,
  buildLateEmployees,
  buildLateGroups,
  formatMoney,
  hhmm,
  matchesQuery,
  severityOf,
  sortEmployees,
  summarize,
} from "../utils/lateTelegram";

import LateSummaryTelegram from "../components/LateSummaryTelegram";
import LateEmployeesTelegram from "../components/LateEmployeesTelegram";
import LateGroupsTelegram from "../components/LateGroupsTelegram";
import LateDaysTelegram from "../components/LateDaysTelegram";
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
  IconClock,
  IconCoffee,
  IconFlag,
  IconTrend,
  IconWallet,
} from "../components/tg/tgIcons";
import ui from "../components/tg/TgUi.module.scss";
// Каркас страницы (шапка, выбор даты, поиск, переключатель вида, скелетон) общий
// с «Посещаемостью» — обе страницы должны выглядеть одинаково
import shell from "./AttendancePageTelegram.module.scss";
import styles from "./LateEmployeesPageTelegram.module.scss";

const EMPTY_SCOPE = { branch: "", department: "" };
const SEVERITY_KEYS = ["low", "mid", "high"];

const SelectField = ({ value, onChange, options, allLabel }) => (
  <span className={shell.select}>
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

// Опоздание в Telegram: за день или период, сводка с полосой тяжести, сотрудники,
// отделы и филиалы. Данные и режимы те же, что в веб-версии.
const LateEmployeesPageTelegram = () => {
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
  // Диапазон и флаг обеда, для которых пришли показанные данные — режим считаем
  // по ним, чтобы экран не перестраивался, пока грузится следующий запрос
  const [applied, setApplied] = useState(range);
  const [includeLunch, setIncludeLunch] = useState(false);
  const lunchRef = useRef(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [severityFilters, setSeverityFilters] = useState(() => new Set());
  const [scope, setScope] = useState(EMPTY_SCOPE);
  const [sortKey, setSortKey] = useState("minutes");
  const [draft, setDraft] = useState({ scope: EMPTY_SCOPE, lunch: false, sort: "minutes" });
  const [view, setView] = useState("employees"); // employees | departments | branches | days | groups
  const [sheet, setSheet] = useState(null); // "date" | "filter" | null

  const scrollRef = useRef(null);
  const requestIdRef = useRef(0);

  // ── Загрузка ───────────────────────────────────────────────────────────────

  const fetchData = useCallback(
    async (target = rangeRef.current, lunch = lunchRef.current) => {
      const requestId = ++requestIdRef.current;
      setRefreshing(true);

      try {
        // Весь список сразу: на телефоне пагинация не нужна, а поиск, группы
        // и итоги считаем по загруженным строкам
        const { data: rows } = await getLateEmployees({
          page: 1,
          pageSize: "all",
          filters: {
            ...buildAttendanceFilters(target),
            include_lunch_late: lunch,
            sort_by: "late_minutes",
            sort_order: "desc",
          },
        });
        if (requestId !== requestIdRef.current) return;

        setData(rows);
        setApplied(target);
        setIncludeLunch(lunch);
        lunchRef.current = lunch;
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("getLateEmployees failed", error.response?.status, error.message);
        showAlert(
          error.response?.data?.error || t("errorLoading"),
          "error",
        );
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
    // Тяжесть считается по-разному за день и за период — прежний выбор не подходит
    setSeverityFilters(new Set());

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

  const allEmployees = useMemo(
    () => (data ? buildLateEmployees(data, isPeriod) : []),
    [data, isPeriod],
  );

  // Филиал и отдел — по выбранной группе; итоги и группы считаются от них
  const scopeEmployees = useMemo(
    () =>
      allEmployees.filter(
        (emp) =>
          (!scope.branch || (emp.branch || fallbacks.noBranch) === scope.branch) &&
          (!scope.department ||
            (emp.department || fallbacks.noDepartment) === scope.department),
      ),
    [allEmployees, scope, fallbacks],
  );

  const summary = useMemo(() => summarize(scopeEmployees), [scopeEmployees]);

  const severityCounts = useMemo(() => {
    const counts = { low: 0, mid: 0, high: 0 };
    scopeEmployees.forEach((emp) => {
      counts[severityOf(emp, isPeriod)] += 1;
    });
    return counts;
  }, [scopeEmployees, isPeriod]);

  const query = search.trim().toLowerCase();

  const listEmployees = useMemo(
    () =>
      sortEmployees(
        scopeEmployees.filter(
          (emp) =>
            matchesQuery(emp, query) &&
            (severityFilters.size === 0 ||
              severityFilters.has(severityOf(emp, isPeriod))),
        ),
        sortKey,
      ),
    [scopeEmployees, query, severityFilters, isPeriod, sortKey],
  );

  const branchCount = useMemo(
    () => new Set(allEmployees.map((emp) => emp.branch || fallbacks.noBranch)).size,
    [allEmployees, fallbacks],
  );

  const activeView = useMemo(() => {
    const allowed = isPeriod
      ? ["employees", "days", "groups"]
      : ["employees", "departments", ...(isBranchMode ? [] : ["branches"])];
    return allowed.includes(view) ? view : "employees";
  }, [view, isPeriod, isBranchMode]);

  const groupView =
    isBranchMode || activeView === "departments" ? "departments" : "branches";

  const groups = useMemo(
    () =>
      activeView === "departments" || activeView === "branches" || activeView === "groups"
        ? buildLateGroups(scopeEmployees, { view: groupView, fallbacks, query })
        : [],
    [scopeEmployees, activeView, groupView, fallbacks, query],
  );

  const days = useMemo(
    () =>
      isPeriod && activeView === "days"
        ? buildLateDays(
            data?.lateByBranchAndDay,
            new Set(listEmployees.map((emp) => String(emp.employeeId))),
            fallbacks.noBranch,
          )
        : [],
    [isPeriod, activeView, data, listEmployees, fallbacks],
  );

  const hasMoney = summary.money > 0;

  // ── Сводка ─────────────────────────────────────────────────────────────────

  const summaryProps = useMemo(() => {
    const severityLabel = (key) =>
      t(`lateTg.severity.${isPeriod ? "period" : "day"}.${key}`);

    const tiles = [
      {
        key: "time",
        tone: "amber",
        label: t("lateTg.totalTime"),
        value: hhmm(summary.minutes),
        sub: t("hoursShort"),
        icon: <IconClock />,
      },
      {
        key: "average",
        tone: "purple",
        label: t("average"),
        value: hhmm(summary.average),
        sub: t("hoursShort"),
        icon: <IconTrend />,
      },
    ];

    if (isPeriod && summary.count > 0) {
      tiles.push({
        key: "cases",
        tone: "red",
        label: t("lateOccurrences"),
        value: summary.count,
        icon: <IconFlag />,
      });
    }

    if (includeLunch && summary.breakCount > 0) {
      tiles.push({
        key: "break",
        tone: "orange",
        label: t("afterBreak"),
        value: summary.breakCount,
        sub: summary.breakMinutes > 0 ? hhmm(summary.breakMinutes) : undefined,
        icon: <IconCoffee />,
      });
    }

    if (hasMoney) {
      tiles.push({
        key: "money",
        tone: "teal",
        label: t("latePenaltyAmount"),
        value: formatMoney(summary.money),
        icon: <IconWallet />,
      });
    }

    return {
      caption: isPeriod
        ? t("lateTg.heroPeriod")
        : isToday
          ? t("lateTg.heroToday")
          : t("lateTg.heroDay"),
      people: summary.people,
      unit: t("peopleShort"),
      severity: SEVERITY_KEYS.map((key) => ({
        key,
        tone: SEVERITY_TONES[key],
        label: severityLabel(key),
        value: severityCounts[key],
      })),
      tiles,
    };
  }, [summary, severityCounts, isPeriod, isToday, includeLunch, hasMoney, t]);

  // ── Управление фильтрами ───────────────────────────────────────────────────

  const toggleSeverity = (key) =>
    setSeverityFilters((prev) => {
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
    setDraft({ scope, lunch: includeLunch, sort: sortKey });
    setSheet("filter");
  };

  const applyFilter = () => {
    setScope(draft.scope);
    setSortKey(draft.sort);
    setSheet(null);

    // «После обеда» меняет сами данные — нужен новый запрос
    if (draft.lunch !== includeLunch) fetchData(rangeRef.current, draft.lunch);
  };

  const resetDraft = () =>
    setDraft({ scope: EMPTY_SCOPE, lunch: false, sort: "minutes" });

  const branchOptions = useMemo(
    () => [...new Set(allEmployees.map((emp) => emp.branch || fallbacks.noBranch))].sort(),
    [allEmployees, fallbacks],
  );

  const departmentOptions = useMemo(() => {
    const names = new Set();
    allEmployees
      .filter(
        (emp) =>
          !draft.scope.branch || (emp.branch || fallbacks.noBranch) === draft.scope.branch,
      )
      .forEach((emp) => names.add(emp.department || fallbacks.noDepartment));
    return [...names].sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));
  }, [allEmployees, draft.scope.branch, fallbacks]);

  const sortOptions = SORT_KEYS.filter((key) => {
    if (key === "count") return isPeriod;
    if (key === "money") return hasMoney;
    return true;
  });

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
    ...[...severityFilters].map((key) => ({
      key,
      tone: SEVERITY_TONES[key],
      label: t(`lateTg.severity.${isPeriod ? "period" : "day"}.${key}`),
      onClear: () => toggleSeverity(key),
    })),
  ].filter(Boolean);

  const filterCount =
    (scope.branch ? 1 : 0) +
    (scope.department ? 1 : 0) +
    (includeLunch ? 1 : 0) +
    (sortKey !== "minutes" ? 1 : 0);

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
        { value: "employees", label: t("attendanceTg.viewEmployees") },
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

  // ── Список ─────────────────────────────────────────────────────────────────

  let list;
  if (initialLoading) {
    list = <ListSkeleton />;
  } else if (activeView === "employees") {
    list = (
      <LateEmployeesTelegram
        employees={listEmployees}
        isPeriod={isPeriod}
        scrollRootRef={scrollRef}
      />
    );
  } else if (activeView === "days") {
    list = <LateDaysTelegram days={days} showBranches={!isBranchMode && branchCount > 1} />;
  } else {
    list = (
      <LateGroupsTelegram
        groups={groups}
        showBranchName={branchCount > 1}
        onSelect={selectGroup}
      />
    );
  }

  const canStepForward = range.to < today;

  return (
    <div className={shell.page}>
      <div className={shell.topGlass} />

      <div className={shell.scroll} ref={scrollRef}>
        <header className={shell.header}>
          <h1 className={shell.title}>{t("late-employees")}</h1>

          <button
            type="button"
            className={`${shell.roundBtn} ${refreshing ? shell.spin : ""}`}
            onClick={() => fetchData()}
            aria-label={t("dashboard.refresh")}
          >
            <IconRefresh />
          </button>
        </header>

        <div className={shell.dateBar}>
          <button
            type="button"
            className={shell.navBtn}
            onClick={() => stepRange(-1)}
            aria-label={t("attendanceTg.prev")}
          >
            <IconChevronLeft />
          </button>

          <button
            type="button"
            className={shell.datePill}
            onClick={() => setSheet("date")}
          >
            <span className={shell.dateIcon}>
              <IconCalendar />
            </span>
            <span className={shell.dateText}>
              <b>{dateLabel.title}</b>
              <small>{dateLabel.sub}</small>
            </span>
          </button>

          <button
            type="button"
            className={shell.navBtn}
            disabled={!canStepForward}
            onClick={() => stepRange(1)}
            aria-label={t("attendanceTg.next")}
          >
            <IconChevronRight />
          </button>
        </div>

        <div className={`${shell.content} ${stale ? shell.stale : ""}`}>
          <LateSummaryTelegram
            loading={initialLoading}
            activeKeys={severityFilters}
            onToggle={toggleSeverity}
            {...summaryProps}
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
                  <button
                    type="button"
                    className={shell.clearBtn}
                    onClick={() => setSearch("")}
                    aria-label="clear"
                  >
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

            <div className={shell.segment} role="tablist">
              {segments.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={activeView === item.value}
                  className={`${shell.segmentItem} ${activeView === item.value ? shell.segmentActive : ""}`}
                  onClick={() => setView(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {activeChips.length > 0 && (
              <div className={shell.activeChips}>
                {activeChips.map((chip) => (
                  <span
                    key={chip.key}
                    className={shell.activeChip}
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
              onClick={resetDraft}
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
                value={draft.scope.branch}
                onChange={(branch) =>
                  setDraft((prev) => ({ ...prev, scope: { branch, department: "" } }))
                }
                options={branchOptions}
                allLabel={t("all")}
              />
            </div>
          )}

          <div className={ui.field}>
            <label className={ui.label}>{t("department")}</label>
            <SelectField
              value={draft.scope.department}
              onChange={(department) =>
                setDraft((prev) => ({ ...prev, scope: { ...prev.scope, department } }))
              }
              options={departmentOptions}
              allLabel={t("all")}
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>{t("lateTg.sortBy")}</label>
            <div className={styles.sortChips}>
              {sortOptions.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.sortChip} ${draft.sort === key ? styles.sortChipActive : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, sort: key }))}
                >
                  {t(`lateTg.sort.${key}`)}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.switchRow}>
            <span className={styles.switchText}>
              <b>{t("includeLunchLate")}</b>
              <small>{t("lateTg.lunchHint")}</small>
            </span>
            <input
              type="checkbox"
              className={styles.switch}
              checked={draft.lunch}
              onChange={(e) => setDraft((prev) => ({ ...prev, lunch: e.target.checked }))}
            />
          </label>
        </div>
      </TgSheet>
    </div>
  );
};

export default LateEmployeesPageTelegram;
