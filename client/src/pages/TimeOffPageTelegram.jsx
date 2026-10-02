import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getTimeOff, deleteTimeOff, getActiveBranches, getActiveDepartments, getActivePositions } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useOpenAddTimeOff } from "../hooks/useOpenAddTimeOff";
import { useOpenEditTimeOff } from "../hooks/useOpenEditTimeOff";
import { useScreenStack } from "../context/ScreenStackContext";
import { formatIsoToLocalDate, formatIsoToLocalDateTime } from "../utils/date";

import CenterModal from "../components/CenterModal";
import {
  IconSearch,
  IconClose,
  IconFilter,
  IconPlus,
  IconClock,
  IconCalendar,
  IconSun,
  IconCalendarOff,
  IconTrash,
} from "../components/tg/tgIcons";

import styles from "./TimeOffPageTelegram.module.scss";

const PAGE_SIZE = 30;

const TYPE_CHIP = { hour: "chipHour", day_off: "chipDayOff", vacation: "chipVacation" };

const EMPTY_FILTERS = {
  date_from: "",
  date_to: "",
  branch_id: "",
  department_id: "",
  position_id: "",
};

const countActiveFilters = (f) =>
  Object.values(f).filter((v) => v !== "" && v !== null && v !== undefined).length;

const SkeletonCard = () => (
  <div className={styles.skeleton}>
    <div className={styles.skRow}>
      <span className={styles.skAvatar} />
      <div className={styles.skLines}>
        <span className={styles.skLine} style={{ width: "55%" }} />
        <span className={styles.skLine} style={{ width: "35%" }} />
      </div>
    </div>
    <span className={styles.skLine} style={{ width: "70%" }} />
    <span className={styles.skLine} style={{ width: "40%", height: 20 }} />
  </div>
);

const TimeOffCard = ({ item, index, canEdit, canDelete, onOpen, onDelete, innerRef, t }) => {
  const chipTone = TYPE_CHIP[item.type] || TYPE_CHIP.hour;
  const isFullDay = item.type !== "hour";
  const fmt = isFullDay ? formatIsoToLocalDate : formatIsoToLocalDateTime;

  return (
    <div
      ref={innerRef}
      className={`${styles.card} ${canEdit ? styles.cardTappable : ""}`}
      style={{ "--i": index % 8 }}
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={() => canEdit && onOpen(item.id)}
      onKeyDown={(e) => canEdit && e.key === "Enter" && onOpen(item.id)}
    >
      <div className={styles.cardTop}>
        <div className={styles.who}>
          <p className={styles.name}>{item.employeeFullName || t("unknown")}</p>
          <p className={styles.sub}>
            {[item.position_name, item.department_name].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>

        {canDelete && (
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.trashBtn}`}
              aria-label={t("delete")}
              onClick={() => onDelete(item.id)}
            >
              <IconTrash />
            </button>
          </div>
        )}
      </div>

      <div className={styles.dateRow}>
        <IconCalendar />
        <span>
          {fmt(item.date_from)} — {fmt(item.date_to)}
        </span>
      </div>

      <div className={styles.chipsRow}>
        <span className={`${styles.chip} ${styles[chipTone]}`}>{t(item.type)}</span>
        <span className={`${styles.chip} ${item.is_company_paid ? styles.chipPaid : styles.chipUnpaid}`}>
          {item.is_company_paid ? t("companyPaid") : t("no")}
        </span>
      </div>

      {item.reason && <p className={styles.reason}>{item.reason}</p>}
    </div>
  );
};

// Страница «Заявки на отсутствие» в Telegram: плитки-типы (сводка и быстрый фильтр),
// поиск, расширенные фильтры (период / филиал / отдел / должность), карточки заявок
// с подгрузкой по скроллу. Добавление и правка открываются экраном поверх.
const TimeOffPageTelegram = ({ routePath = "/time-off" }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { pushScreen, popScreen } = useScreenStack();
  const { canAdd, canEdit, canDelete } = usePermissionsTelegram(routePath);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [counts, setCounts] = useState({ all: null, hour: null, day_off: null, vacation: null });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [deleteId, setDeleteId] = useState(null);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  const scrollRef = useRef(null);
  const searchRef = useRef("");
  const typeRef = useRef("all");
  const filtersRef = useRef(EMPTY_FILTERS);
  const searchTimerRef = useRef(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const requestIdRef = useRef(0);
  const observerRef = useRef(null);

  const fetchPage = useCallback(
    async (page = 1, silent = false) => {
      if (page > 1 && (loadingMoreRef.current || !hasMoreRef.current)) return;

      const requestId = ++requestIdRef.current;
      if (page === 1) {
        hasMoreRef.current = true;
        loadingMoreRef.current = false;
        setLoadingMore(false);
        if (!silent) setLoading(true);
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      try {
        const { data: rows, pagination } = await getTimeOff({
          page,
          pageSize: PAGE_SIZE,
          filters: {
            search: searchRef.current,
            type: typeRef.current === "all" ? undefined : typeRef.current,
            date_from: filtersRef.current.date_from || undefined,
            date_to: filtersRef.current.date_to || undefined,
            branch_id: filtersRef.current.branch_id || undefined,
            department_id: filtersRef.current.department_id || undefined,
            position_id: filtersRef.current.position_id || undefined,
          },
        });
        if (requestId !== requestIdRef.current) return;

        const list = rows || [];
        setData((prev) => (page === 1 ? list : [...prev, ...list]));
        pageRef.current = page;
        hasMoreRef.current = page < (pagination?.totalPages || 1);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error("Ошибка при получении заявок:", err);
        showAlert(t("errorLoading"), "error");
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [showAlert, t],
  );

  // Счётчики плиток — без учёта поиска/фильтров, иначе цифры «прыгают» при вводе.
  const fetchCounts = useCallback(async () => {
    try {
      const [all, hour, dayOff, vacation] = await Promise.all([
        getTimeOff({ page: 1, pageSize: 1, filters: {} }),
        getTimeOff({ page: 1, pageSize: 1, filters: { type: "hour" } }),
        getTimeOff({ page: 1, pageSize: 1, filters: { type: "day_off" } }),
        getTimeOff({ page: 1, pageSize: 1, filters: { type: "vacation" } }),
      ]);
      setCounts({
        all: all.pagination?.totalItems ?? 0,
        hour: hour.pagination?.totalItems ?? 0,
        day_off: dayOff.pagination?.totalItems ?? 0,
        vacation: vacation.pagination?.totalItems ?? 0,
      });
    } catch (err) {
      console.error("Ошибка при получении счётчиков заявок:", err);
    }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const [branchRes, deptRes, posRes] = await Promise.all([
        getActiveBranches(),
        getActiveDepartments(),
        getActivePositions(),
      ]);
      if (branchRes?.success) setBranches(branchRes.data);
      if (deptRes?.success) setDepartments(deptRes.data);
      if (posRes?.success) setPositions(posRes.data);
    } catch (err) {
      console.error("Ошибка загрузки справочников:", err);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchPage(1, true);
    fetchCounts();
  }, [fetchPage, fetchCounts]);

  useEffect(() => {
    fetchPage(1);
    fetchCounts();
    fetchMeta();
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  usePullToRefresh(refreshAll, scrollRef, loading);

  const changeSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchRef.current = value.trim();
      fetchPage(1);
    }, 350);
  };

  const changeType = (value) => {
    if (value === typeRef.current) return;
    typeRef.current = value;
    setActiveType(value);
    scrollRef.current?.scrollTo({ top: 0 });
    fetchPage(1);
  };

  const sentinelRef = useCallback(
    (node) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) fetchPage(pageRef.current + 1);
        },
        { root: scrollRef.current, rootMargin: "400px" },
      );
      observerRef.current.observe(node);
    },
    [fetchPage],
  );

  const openAdd = useOpenAddTimeOff(refreshAll);
  const openEdit = useOpenEditTimeOff(refreshAll);

  const handleDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    if (!id) return;
    try {
      await deleteTimeOff(id);
      showAlert(t("success"), "success");
      refreshAll();
    } catch (err) {
      console.error("Ошибка при удалении заявки:", err);
      showAlert(t("error"), "error");
    }
  };

  const openFilter = () => {
    pushScreen(
      "time-off-filter",
      <FilterScreen
        filters={filters}
        branches={branches}
        departments={departments}
        positions={positions}
        onApply={(next) => {
          setFilters(next);
          filtersRef.current = next;
          popScreen();
          fetchPage(1);
        }}
        t={t}
      />,
    );
  };

  const filterCount = countActiveFilters(filters);

  const tiles = [
    { key: "all", label: t("all"), icon: <IconCalendarOff />, value: counts.all, tone: styles.toneIndigo },
    { key: "hour", label: t("hour"), icon: <IconClock />, value: counts.hour, tone: styles.toneAmber },
    { key: "day_off", label: t("day_off"), icon: <IconCalendar />, value: counts.day_off, tone: styles.toneBlue },
    { key: "vacation", label: t("vacation"), icon: <IconSun />, value: counts.vacation, tone: styles.tonePurple },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        <header className={styles.head}>
          <h1 className={styles.title}>{t("time-off")}</h1>
          {counts.all != null && <span className={styles.heroCount}>{counts.all}</span>}
        </header>

        <div className={styles.tiles} role="tablist">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              role="tab"
              aria-selected={activeType === tile.key}
              className={`${styles.tile} ${tile.tone} ${activeType === tile.key ? styles.tileActive : ""}`}
              onClick={() => changeType(tile.key)}
            >
              <span className={styles.tileIcon}>{tile.icon}</span>
              <span className={styles.tileText}>
                <b className={styles.tileValue}>{tile.value ?? "–"}</b>
                <span className={styles.tileLabel}>{tile.label}</span>
              </span>
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <label className={styles.searchBox}>
            <span className={styles.searchIcon}>
              <IconSearch />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              placeholder={t("search")}
              enterKeyHint="search"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => changeSearch("")}
                aria-label="clear"
              >
                <IconClose />
              </button>
            )}
          </label>

          <button
            type="button"
            className={`${styles.filterBtn} ${filterCount > 0 ? styles.filterBtnActive : ""}`}
            onClick={openFilter}
          >
            <IconFilter />
            {filterCount > 0 && <span className={styles.filterBadge}>{filterCount}</span>}
          </button>
        </div>

        <div className={styles.cardList}>
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          ) : data.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <IconCalendarOff />
              </span>
              <p>{t("noData")}</p>
            </div>
          ) : (
            data.map((item, index) => (
              <TimeOffCard
                key={item.id}
                item={item}
                index={index}
                canEdit={canEdit}
                canDelete={canDelete}
                onOpen={openEdit}
                onDelete={setDeleteId}
                innerRef={index === data.length - 5 ? sentinelRef : null}
                t={t}
              />
            ))
          )}
          {loadingMore && (
            <div className={styles.bottomLoader}>
              <span className={styles.bottomLoaderDot} />
              <span className={styles.bottomLoaderDot} />
              <span className={styles.bottomLoaderDot} />
            </div>
          )}
        </div>
      </div>

      {canAdd && (
        <button type="button" className={styles.fab} onClick={openAdd} aria-label={t("addTimeOff")}>
          <IconPlus />
        </button>
      )}

      <CenterModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onAccept={handleDelete}
        tag={t("deletion")}
      />
    </div>
  );
};

// ── Экран фильтров ─────────────────────────────────────────────────────────────
const FilterScreen = ({ filters, branches, departments, positions, onApply, t }) => {
  const [local, setLocal] = useState(filters);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocal((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className={styles.filterPage}>
      <div className={styles.filterHeader}>
        <span className={styles.filterTitle}>{t("filters")}</span>
      </div>

      <div className={styles.filterBody}>
        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("period")}</label>
          <div className={styles.filterRow}>
            <input
              className={styles.dateInput}
              type="date"
              name="date_from"
              value={local.date_from}
              onChange={handleChange}
              onFocus={(e) => e.target.showPicker?.()}
            />
            <input
              className={styles.dateInput}
              type="date"
              name="date_to"
              value={local.date_to}
              onChange={handleChange}
              onFocus={(e) => e.target.showPicker?.()}
            />
          </div>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("branch")}</label>
          <select className={styles.select} name="branch_id" value={local.branch_id} onChange={handleChange}>
            <option value="">{t("all")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("department")}</label>
          <select
            className={styles.select}
            name="department_id"
            value={local.department_id}
            onChange={handleChange}
          >
            <option value="">{t("all")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("position")}</label>
          <select className={styles.select} name="position_id" value={local.position_id} onChange={handleChange}>
            <option value="">{t("all")}</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.filterFooter}>
        <button type="button" className={styles.resetBtn} onClick={() => setLocal(EMPTY_FILTERS)}>
          {t("clearAll")}
        </button>
        <button type="button" className={styles.applyBtn} onClick={() => onApply(local)}>
          {t("apply")}
        </button>
      </div>
    </div>
  );
};

export default TimeOffPageTelegram;
