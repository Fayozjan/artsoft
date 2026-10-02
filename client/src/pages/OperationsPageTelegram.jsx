import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getOperationTypes } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import {
  UNIT_OPTIONS,
  UNIT_LABEL_KEYS,
  COMPLEXITY_OPTIONS,
  COMPLEXITY_LABEL_KEYS,
  COMPLEXITY_META,
} from "../utils/operationType";

import OperationTypeFormTelegram from "../components/OperationTypeFormTelegram";
import OperationRouteMap from "../components/OperationRouteMap";
import TgSheet from "../components/tg/TgSheet";
import {
  IconSearch,
  IconClose,
  IconFilter,
  IconPlus,
  IconHash,
  IconUsers,
  IconRoute,
  IconArrowRight,
  IconChevronRight,
  IconLayers,
} from "../components/tg/tgIcons";
import ui from "../components/tg/TgUi.module.scss";
import styles from "./OperationsPageTelegram.module.scss";

const PAGE_SIZE = 20;

const EMPTY_FILTERS = { search: "", status: "", unit: "", complexity: "" };

// 1500 → "1 500", 12.5 → "12,5": группировка разрядов, без хвоста ".00".
const fmtPrice = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const relationNames = (relations, key) => (relations || []).map((rel) => rel[key]?.name).filter(Boolean);

// Роль операции в цепочке — короткие цветные метки на карточке.
const roleTags = (type, t) =>
  [
    type.is_first && { key: "first", tone: styles.tagBlue, label: t("operationRoleFirst") },
    type.is_final && { key: "final", tone: styles.tagPurple, label: t("operationRoleFinal") },
    type.is_rework && { key: "rework", tone: styles.tagAmber, label: t("isReworkOperation") },
    type.allow_merge && { key: "merge", tone: styles.tagPink, label: t("operationRoleMerge") },
    type.allow_incomplete && { key: "incomplete", tone: styles.tagGray, label: t("operationRoleIncomplete") },
  ].filter(Boolean);

// Сложность: три полоски цвета сложности + подпись.
const ComplexityMeter = ({ value, t }) => {
  const meta = COMPLEXITY_META[value];
  if (!meta) return null;
  return (
    <span className={styles.meter} style={{ "--meter-color": meta.color }}>
      <span className={styles.meterBars}>
        {[1, 2, 3].map((n) => (
          <i key={n} className={n <= meta.level ? styles.meterOn : ""} />
        ))}
      </span>
      {t(meta.labelKey)}
    </span>
  );
};

const OperationCard = ({ row, canEdit, onOpen, innerRef, t }) => {
  const meta = COMPLEXITY_META[row.complexity];
  const tags = roleTags(row, t);
  const nextNames = row.is_final ? [] : relationNames(row.nextOperations, "nextOperationType");
  const clickable = canEdit;

  return (
    <div
      ref={innerRef}
      className={`${styles.card} ${clickable ? styles.cardClickable : ""} ${row.is_active ? "" : styles.cardOff}`}
      style={meta ? { "--accent": meta.color } : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpen(row) : undefined}
      onKeyDown={clickable ? (e) => e.key === "Enter" && onOpen(row) : undefined}
    >
      <span className={styles.cardAccent} />

      <div className={styles.cardMain}>
        <div className={styles.cardTop}>
          <h3 className={styles.cardTitle}>{row.name}</h3>
          <div className={styles.price}>
            <b>{fmtPrice(row.price)}</b>
            {row.unit && <span>/ {t(UNIT_LABEL_KEYS[row.unit])}</span>}
          </div>
        </div>

        {(row.complexity || tags.length > 0 || !row.is_active) && (
          <div className={styles.tags}>
            {!row.is_active && <span className={`${styles.tag} ${styles.tagGray}`}>{t("false")}</span>}
            <ComplexityMeter value={row.complexity} t={t} />
            {tags.map((tag) => (
              <span key={tag.key} className={`${styles.tag} ${tag.tone}`}>
                {tag.label}
              </span>
            ))}
          </div>
        )}

        {nextNames.length > 0 && (
          <div className={styles.flow}>
            <IconArrowRight />
            <span>{nextNames.join(", ")}</span>
          </div>
        )}

        <div className={styles.meta}>
          <span>
            <IconHash />
            {row.sort_order ?? 0}
          </span>
          <span>
            <IconUsers />
            {row.employees?.length > 0 ? row.employees.length : t("all")}
          </span>
        </div>
      </div>

      {clickable && (
        <span className={styles.cardChevron}>
          <IconChevronRight />
        </span>
      )}
    </div>
  );
};

const SkeletonCard = () => (
  <div className={styles.skeleton}>
    <span className={styles.skLine} style={{ width: "62%", height: 18 }} />
    <span className={styles.skLine} style={{ width: "45%" }} />
    <span className={styles.skLine} style={{ width: "30%" }} />
  </div>
);

// Один вариант в шторке фильтров: чип с цветной точкой (у сложности) и подсветкой выбранного.
const FilterChip = ({ active, color, onClick, children }) => (
  <button
    type="button"
    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
    style={color ? { "--chip-color": color } : undefined}
    onClick={onClick}
  >
    {color && <i />}
    {children}
  </button>
);

// Типы операций в Telegram: список карточек с быстрым фильтром по статусу, поиском и
// бесконечной прокруткой; создание и правка типа открываются экраном поверх.
const OperationsPageTelegram = ({ routePath = "/operations" }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { pushScreen, popScreen } = useScreenStack();
  const { canAdd, canEdit, canDelete } = usePermissionsTelegram(routePath);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [extra, setExtra] = useState({ unit: "", complexity: "" });
  const [draft, setDraft] = useState({ unit: "", complexity: "" });
  const [filterOpen, setFilterOpen] = useState(false);

  const scrollRef = useRef(null);
  const observerRef = useRef(null);
  const filtersRef = useRef(EMPTY_FILTERS);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const requestIdRef = useRef(0);
  const searchTimerRef = useRef(null);
  const refreshRef = useRef(null);

  const fetchPage = useCallback(
    // silent — обновление без скелетона: список остаётся на экране, пока идёт запрос.
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
        const { data: rows, pagination } = await getOperationTypes({
          page,
          pageSize: PAGE_SIZE,
          filters: filtersRef.current,
        });
        if (requestId !== requestIdRef.current) return;

        const list = rows || [];
        setData((prev) => (page === 1 ? list : [...prev, ...list]));
        pageRef.current = page;
        hasMoreRef.current = page < (pagination?.totalPages || 1);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error(err);
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

  const reload = useCallback(() => fetchPage(1, true), [fetchPage]);

  // Экран типа (поверх страницы) зовёт reload через ref — замыкание из момента открытия не устаревает.
  refreshRef.current = reload;

  useEffect(() => {
    fetchPage(1);
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  const applyFilters = (next) => {
    filtersRef.current = { ...filtersRef.current, ...next };
    fetchPage(1);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => applyFilters({ search: value.trim() }), 350);
  };

  const clearSearch = () => {
    setSearch("");
    clearTimeout(searchTimerRef.current);
    applyFilters({ search: "" });
  };

  const selectStatus = (value) => {
    if (value === status) return;
    setStatus(value);
    applyFilters({ status: value });
  };

  const openFilter = () => {
    setDraft(extra);
    setFilterOpen(true);
  };

  const applyExtra = () => {
    setExtra(draft);
    setFilterOpen(false);
    applyFilters(draft);
  };

  const resetExtra = () => {
    const empty = { unit: "", complexity: "" };
    setDraft(empty);
    setExtra(empty);
    setFilterOpen(false);
    applyFilters(empty);
  };

  const openType = useCallback(
    (id) => {
      pushScreen(
        `operation-type-${id}`,
        <OperationTypeFormTelegram
          id={id === "new" ? null : id}
          canDelete={canDelete}
          onClose={popScreen}
          onChanged={() => refreshRef.current?.()}
        />,
      );
    },
    [pushScreen, popScreen, canDelete],
  );

  const openRoute = () => {
    pushScreen(
      "operation-route",
      <div className={styles.routeScreen}>
        <OperationRouteMap onClose={popScreen} />
      </div>,
    );
  };

  // Бесконечная прокрутка: наблюдаем за карточкой ближе к концу списка.
  const sentinelRef = useCallback(
    (node) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) fetchPage(pageRef.current + 1);
        },
        { root: scrollRef.current, rootMargin: "300px" },
      );
      observerRef.current.observe(node);
    },
    [fetchPage],
  );

  usePullToRefresh(reload, scrollRef, loading);

  const activeExtra = [extra.unit, extra.complexity].filter(Boolean).length;

  const tabs = [
    { value: "", label: t("filterAll"), tone: "all" },
    { value: "true", label: t("true"), tone: "on" },
    { value: "false", label: t("false"), tone: "off" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <div className={styles.scroll} ref={scrollRef}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t("operations")}</h1>
        </header>

        <div className={styles.sticky}>
          <div className={styles.searchRow}>
            <label className={styles.searchBox}>
              <span className={styles.searchIcon}>
                <IconSearch />
              </span>
              <input
                type="search"
                value={search}
                onChange={handleSearchChange}
                placeholder={t("search")}
                enterKeyHint="search"
                autoComplete="off"
              />
              {search && (
                <button type="button" className={styles.clearBtn} onClick={clearSearch} aria-label="clear">
                  <IconClose />
                </button>
              )}
            </label>

            <button type="button" className={styles.roundBtn} onClick={openRoute} aria-label={t("operationRoute")}>
              <IconRoute />
            </button>

            <button
              type="button"
              className={`${styles.roundBtn} ${activeExtra > 0 ? styles.roundBtnActive : ""}`}
              onClick={openFilter}
              aria-label={t("filters")}
            >
              <IconFilter />
              {activeExtra > 0 && <span className={styles.badge}>{activeExtra}</span>}
            </button>
          </div>

          <div className={styles.tabs} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.tone}
                type="button"
                role="tab"
                aria-selected={status === tab.value}
                className={`${styles.tab} ${styles[`tab_${tab.tone}`] || ""} ${status === tab.value ? styles.tabActive : ""}`}
                onClick={() => selectStatus(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.list}>
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          ) : data.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <IconLayers />
              </span>
              <p>{t("noData")}</p>
              {canAdd && (
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnPrimary} ${styles.emptyBtn}`}
                  onClick={() => openType("new")}
                >
                  <IconPlus />
                  {t("add")}
                </button>
              )}
            </div>
          ) : (
            data.map((row, index) => (
              <OperationCard
                key={row.id}
                row={row}
                t={t}
                canEdit={canEdit}
                onOpen={(type) => openType(type.id)}
                innerRef={index === data.length - 3 ? sentinelRef : null}
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
        <button type="button" className={styles.fab} onClick={() => openType("new")} aria-label={t("addOperationType")}>
          <IconPlus />
        </button>
      )}

      <TgSheet
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t("filters")}
        footer={
          <div className={ui.btnRow}>
            <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={resetExtra}>
              {t("clearAll")}
            </button>
            <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={applyExtra}>
              {t("apply")}
            </button>
          </div>
        }
      >
        <div className={ui.form}>
          <div className={ui.field}>
            <label className={ui.label}>{t("complexity")}</label>
            <div className={styles.chips}>
              <FilterChip active={draft.complexity === ""} onClick={() => setDraft((p) => ({ ...p, complexity: "" }))}>
                {t("all")}
              </FilterChip>
              {COMPLEXITY_OPTIONS.map((level) => (
                <FilterChip
                  key={level}
                  active={draft.complexity === level}
                  color={COMPLEXITY_META[level].color}
                  onClick={() => setDraft((p) => ({ ...p, complexity: level }))}
                >
                  {t(COMPLEXITY_LABEL_KEYS[level])}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className={ui.field}>
            <label className={ui.label}>{t("unit")}</label>
            <div className={styles.chips}>
              <FilterChip active={draft.unit === ""} onClick={() => setDraft((p) => ({ ...p, unit: "" }))}>
                {t("all")}
              </FilterChip>
              {UNIT_OPTIONS.map((unit) => (
                <FilterChip key={unit} active={draft.unit === unit} onClick={() => setDraft((p) => ({ ...p, unit }))}>
                  {t(UNIT_LABEL_KEYS[unit])}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
      </TgSheet>
    </div>
  );
};

export default OperationsPageTelegram;
