import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getWorkSchedules, deleteWorkScheduleById } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useScreenStack } from "../context/ScreenStackContext";
import { formatWorkScheduleTime } from "../utils/workSchedule";

import CenterModal from "../components/CenterModal";
import WorkScheduleFormScreenTelegram from "../components/WorkScheduleFormScreenTelegram";
import {
  IconSearch,
  IconClose,
  IconPlus,
  IconTrash,
  IconCheck,
  IconCalendar,
  IconUsers,
  IconClock,
  IconLayers,
  IconSliders,
  IconHome,
  IconChevronRight,
} from "../components/tg/tgIcons";

import styles from "./WorkSchedulesPageTelegram.module.scss";

const PAGE_SIZE = 50;

const STATUS_PARAM = { all: "", active: "true", inactive: "false" };

const TYPE_META = {
  fixed: { icon: IconClock, color: "#6366f1" },
  shift: { icon: IconLayers, color: "#8b5cf6" },
  flexible: { icon: IconSliders, color: "#f59e0b" },
  remote: { icon: IconHome, color: "#0ea5e9" },
};

const SkeletonCard = () => (
  <div className={styles.skeleton}>
    <div className={styles.skLines}>
      <span className={styles.skLine} style={{ width: "55%", height: 16 }} />
      <span className={styles.skLine} style={{ width: "35%" }} />
    </div>
    <span className={styles.skLine} style={{ width: "70%", height: 22 }} />
    <span className={styles.skLine} style={{ width: "90%", height: 14 }} />
  </div>
);

const ScheduleCard = ({ item, canEdit, canDelete, onOpen, onDelete, innerRef, t }) => {
  const active = item.status === true || item.status === "active";
  const meta = TYPE_META[item.type] || TYPE_META.fixed;
  const Icon = meta.icon;
  const typeLabel = item.type === "remote" ? t("remote") : t(`scheduleType.${item.type}`);
  const summary = formatWorkScheduleTime(item);

  return (
    <div
      ref={innerRef}
      className={`${styles.card} ${active ? "" : styles.cardOff} ${canEdit ? styles.cardTappable : ""}`}
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={() => canEdit && onOpen(item.id)}
      onKeyDown={(e) => canEdit && e.key === "Enter" && onOpen(item.id)}
    >
      <div className={styles.cardTop}>
        <span
          className={styles.typeIcon}
          style={{ background: `${meta.color}1c`, color: meta.color }}
        >
          <Icon />
        </span>

        <div className={styles.who}>
          <h3 className={styles.name}>{item.name}</h3>
          <p className={styles.sub}>
            <span>{typeLabel}</span>
            <em>#{item.id}</em>
          </p>
        </div>

        {canDelete ? (
          <button
            type="button"
            className={styles.trashBtn}
            aria-label={t("delete")}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <IconTrash />
          </button>
        ) : (
          canEdit && (
            <span className={styles.chevron}>
              <IconChevronRight />
            </span>
          )
        )}
      </div>

      <div className={styles.chips}>
        <span className={`${styles.chip} ${active ? styles.chipGreen : styles.chipRed}`}>
          <i />
          {active ? t("enabled") : t("disabled")}
        </span>
        <span className={`${styles.chip} ${styles.chipBlue}`} title={t("employees")}>
          <IconUsers />
          {item.employee_count ?? 0}
        </span>
        {!!item.weekly_hours && (
          <span className={styles.chip} title={t("weeklyHoursNorm")}>
            <IconClock />
            {item.weekly_hours} {t("hoursShort")}
          </span>
        )}
      </div>

      {summary !== "—" && <div className={styles.summary}>{summary}</div>}
    </div>
  );
};

// Страница «Отдел кадров → Рабочие графики» в Telegram: сводка-фильтр по
// статусу, поиск и карточки графиков с типом, часами и режимом работы.
// Добавление и правка открываются экраном поверх (стек экранов), как у отделов.
const WorkSchedulesPageTelegram = ({ routePath = "/work-schedules" }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { pushScreen } = useScreenStack();
  const { canAdd, canEdit, canDelete } = usePermissionsTelegram(routePath);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [counts, setCounts] = useState({ all: null, active: null });
  const [deleteId, setDeleteId] = useState(null);

  const scrollRef = useRef(null);
  const searchRef = useRef("");
  const filterRef = useRef("all");
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
        const { data: rows, pagination } = await getWorkSchedules({
          page,
          pageSize: PAGE_SIZE,
          filters: {
            search: searchRef.current,
            status: STATUS_PARAM[filterRef.current],
          },
        });
        // ответ устаревшего запроса (успели сменить поиск/фильтр) — выбрасываем
        if (requestId !== requestIdRef.current) return;

        const list = rows || [];
        setData((prev) => (page === 1 ? list : [...prev, ...list]));
        pageRef.current = page;
        hasMoreRef.current = page < (pagination?.totalPages || 1);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error("Ошибка при получении графиков:", err);
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

  // Счётчики плиток — без учёта поиска, иначе цифры «прыгают» при вводе запроса.
  const fetchCounts = useCallback(async () => {
    try {
      const [all, active] = await Promise.all([
        getWorkSchedules({ page: 1, pageSize: 1, filters: {} }),
        getWorkSchedules({ page: 1, pageSize: 1, filters: { status: "true" } }),
      ]);
      setCounts({
        all: all.pagination?.totalItems ?? 0,
        active: active.pagination?.totalItems ?? 0,
      });
    } catch (err) {
      console.error("Ошибка при получении счётчиков:", err);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchPage(1, true);
    fetchCounts();
  }, [fetchPage, fetchCounts]);

  useEffect(() => {
    fetchPage(1);
    fetchCounts();
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

  const changeFilter = (value) => {
    if (value === filterRef.current) return;
    filterRef.current = value;
    setFilter(value);
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

  const openForm = (id) =>
    pushScreen(
      id ? `edit-work-schedule-${id}` : "add-work-schedule",
      <WorkScheduleFormScreenTelegram id={id} onSaved={refreshAll} />,
    );

  const handleDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    if (!id) return;
    try {
      await deleteWorkScheduleById(id);
      showAlert(t("success"), "success");
      refreshAll();
    } catch (err) {
      console.error("Ошибка при удалении:", err);
      showAlert(err.response?.data?.error || t("error"), "error");
    }
  };

  const total = counts.all;
  const inactiveCount = total === null ? null : total - (counts.active ?? 0);
  const tiles = [
    { key: "all", label: t("all"), icon: <IconCalendar />, value: total, tone: styles.toneIndigo },
    { key: "active", label: t("enabled"), icon: <IconCheck />, value: counts.active, tone: styles.toneGreen },
    { key: "inactive", label: t("disabled"), icon: <IconClose />, value: inactiveCount, tone: styles.toneRed },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        <header className={styles.head}>
          <h1 className={styles.title}>{t("work-schedules")}</h1>
        </header>

        <div className={styles.tiles} role="tablist">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              role="tab"
              aria-selected={filter === tile.key}
              className={`${styles.tile} ${tile.tone} ${filter === tile.key ? styles.tileActive : ""}`}
              onClick={() => changeFilter(tile.key)}
            >
              <span className={styles.tileIcon}>{tile.icon}</span>
              <span className={styles.tileText}>
                <b className={styles.tileValue}>{tile.value ?? "–"}</b>
                <span className={styles.tileLabel}>{tile.label}</span>
              </span>
            </button>
          ))}
        </div>

        <div className={styles.searchBar}>
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
        </div>

        <div className={styles.list}>
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          ) : data.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <IconCalendar />
              </span>
              <p>{t("noData")}</p>
            </div>
          ) : (
            data.map((item, index) => (
              <ScheduleCard
                key={item.id}
                item={item}
                canEdit={canEdit}
                canDelete={canDelete}
                onOpen={openForm}
                onDelete={setDeleteId}
                innerRef={index === data.length - 5 ? sentinelRef : null}
                t={t}
              />
            ))
          )}
          {loadingMore && (
            <div className={styles.moreLoader}>
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      </div>

      {canAdd && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => openForm(null)}
          aria-label={t("addWorkSchedule")}
        >
          <IconPlus />
        </button>
      )}

      <CenterModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onAccept={handleDelete}
        message={t("areYouSureDelete")}
      />
    </div>
  );
};

export default WorkSchedulesPageTelegram;
