import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getBatchReceipts, getBatchReceiptsStats } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { parseScan } from "../utils/batchScan";
import { playScanSound } from "../utils/scanSound";
import { useCameraScanner } from "../hooks/useCameraScanner";

import BatchReceiptDetailTelegram from "../components/BatchReceiptDetailTelegram";
import BatchScanSheetTelegram from "../components/BatchScanSheetTelegram";
import TgSheet from "../components/tg/TgSheet";
import {
  IconSearch,
  IconClose,
  IconFilter,
  IconScan,
  IconCalendar,
  IconHash,
  IconUser,
  IconLayers,
  IconChevronRight,
  IconBox,
} from "../components/tg/tgIcons";
import ui from "../components/tg/TgUi.module.scss";
import styles from "./BatchReceiptsPageTelegram.module.scss";

const PAGE_SIZE = 20;

const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString("ru-RU") : "—");

const EMPTY_FILTERS = { search: "", status: "", date_from: "", date_to: "" };

const BatchCard = ({ row, onOpen, innerRef, t }) => {
  const accepted = row.status === "accepted";
  return (
    <div
      ref={innerRef}
      className={`${styles.card} ${accepted ? styles.cardAccepted : styles.cardDraft}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(row)}
    >
      <span className={styles.cardAccent} />

      <div className={styles.cardMain}>
        <div className={styles.cardTop}>
          <h3 className={styles.cardTitle}>{row.batch_number}</h3>
          <span className={`${styles.pill} ${accepted ? styles.pillAccepted : styles.pillDraft}`}>{t(row.status)}</span>
        </div>

        <div className={styles.cardMeta}>
          <span>
            <IconCalendar />
            {formatDate(row.receipt_date)}
          </span>
          {row.order_number && (
            <span>
              <IconHash />
              {row.order_number}
            </span>
          )}
          <span>
            <IconLayers />
            {t("lineItems")}: {row._count?.items ?? 0}
          </span>
        </div>

        {row.customer && (
          <div className={styles.cardCustomer}>
            <IconUser />
            <span>{row.customer}</span>
          </div>
        )}

        {row.comment && <p className={styles.cardComment}>{row.comment}</p>}
      </div>

      <span className={styles.cardChevron}>
        <IconChevronRight />
      </span>
    </div>
  );
};

const SkeletonCard = () => (
  <div className={styles.skeleton}>
    <span className={styles.skLine} style={{ width: "38%" }} />
    <span className={styles.skLine} style={{ width: "62%", height: 20 }} />
    <span className={styles.skLine} style={{ width: "80%" }} />
  </div>
);

// Приход партии в Telegram: список партий с быстрым фильтром по статусу, поиском и
// бесконечной прокруткой; карточка партии открывается экраном поверх.
const BatchReceiptsPageTelegram = ({ routePath = "/batch-receipts" }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { pushScreen, popScreen } = useScreenStack();
  const { canAdd, canEdit, canDelete } = usePermissionsTelegram(routePath);
  const camera = useCameraScanner();

  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dates, setDates] = useState({ date_from: "", date_to: "" });
  const [sheet, setSheet] = useState(null); // "filter" | "scan" | null
  const [firstCode, setFirstCode] = useState(""); // код, считанный камерой до открытия шторки
  const [draftDates, setDraftDates] = useState({ date_from: "", date_to: "" });

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
        const { data: rows, pagination } = await getBatchReceipts({
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

  const fetchStats = useCallback(async () => {
    try {
      const res = await getBatchReceiptsStats();
      if (res?.success) setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const reload = useCallback(() => {
    fetchPage(1, true);
    fetchStats();
  }, [fetchPage, fetchStats]);

  // Карточка партии (экран поверх) зовёт reload через ref — замыкание из момента открытия не устаревает.
  refreshRef.current = reload;

  useEffect(() => {
    reload();
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
    setDraftDates(dates);
    setSheet("filter");
  };

  const applyDates = () => {
    setDates(draftDates);
    setSheet(null);
    applyFilters(draftDates);
  };

  const resetDates = () => {
    const empty = { date_from: "", date_to: "" };
    setDraftDates(empty);
    setDates(empty);
    setSheet(null);
    applyFilters(empty);
  };

  // С телефона сразу открываем камеру: считанная позиция открывает шторку с партией,
  // дальше добавляют ещё позиции. Без камеры (ПК со сканером) — шторка с полем для кода.
  const startScan = () => {
    if (!camera.available) {
      setFirstCode("");
      setSheet("scan");
      return;
    }

    camera.start((value) => {
      if (!parseScan(value)) {
        playScanSound("error");
        showAlert(t("invalidScanData"), "error");
        return;
      }
      playScanSound("success");
      setFirstCode(value);
      setSheet("scan");
    });
  };

  const openBatch = useCallback(
    (row) => {
      const id = typeof row === "object" ? row.id : row;
      pushScreen(
        `batch-receipt-${id}`,
        <BatchReceiptDetailTelegram
          id={id}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={popScreen}
          onChanged={() => refreshRef.current?.()}
        />,
      );
    },
    [pushScreen, popScreen, canAdd, canEdit, canDelete],
  );

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

  const activeDateFilters = [dates.date_from, dates.date_to].filter(Boolean).length;

  const tabs = [
    { value: "", label: t("filterAll"), count: stats?.total, tone: "all" },
    { value: "draft", label: t("draft"), count: stats?.draft, tone: "draft" },
    { value: "accepted", label: t("accepted"), count: stats?.accepted, tone: "accepted" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <div className={styles.scroll} ref={scrollRef}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t("batch-receipts")}</h1>
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

            <button
              type="button"
              className={`${styles.roundBtn} ${activeDateFilters > 0 ? styles.roundBtnActive : ""}`}
              onClick={openFilter}
              aria-label={t("filters")}
            >
              <IconFilter />
              {activeDateFilters > 0 && <span className={styles.badge}>{activeDateFilters}</span>}
            </button>
          </div>

          <div className={styles.tabs} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.value || "all"}
                type="button"
                role="tab"
                aria-selected={status === tab.value}
                className={`${styles.tab} ${styles[`tab_${tab.tone}`] || ""} ${status === tab.value ? styles.tabActive : ""}`}
                onClick={() => selectStatus(tab.value)}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && <b>{tab.count}</b>}
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
                <IconBox />
              </span>
              <p>{t("noData")}</p>
              {canAdd && (
                <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${styles.emptyBtn}`} onClick={startScan}>
                  <IconScan />
                  {t("addByScan")}
                </button>
              )}
            </div>
          ) : (
            data.map((row, index) => (
              <BatchCard
                key={row.id}
                row={row}
                t={t}
                onOpen={openBatch}
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
        <button type="button" className={styles.fab} onClick={startScan} aria-label={t("addByScan")}>
          <IconScan />
        </button>
      )}

      {camera.element}

      <BatchScanSheetTelegram
        isOpen={sheet === "scan"}
        initialCode={firstCode}
        onClose={() => setSheet(null)}
        onSaved={(id) => {
          setSheet(null);
          reload();
          if (id) openBatch(id);
        }}
      />

      <TgSheet
        isOpen={sheet === "filter"}
        onClose={() => setSheet(null)}
        title={t("filters")}
        footer={
          <div className={ui.btnRow}>
            <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={resetDates}>
              {t("clearAll")}
            </button>
            <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={applyDates}>
              {t("apply")}
            </button>
          </div>
        }
      >
        <div className={ui.form}>
          <div className={ui.field}>
            <label className={ui.label}>{t("dateFrom")}</label>
            <input
              className={ui.input}
              type="date"
              value={draftDates.date_from}
              onChange={(e) => setDraftDates((prev) => ({ ...prev, date_from: e.target.value }))}
            />
          </div>
          <div className={ui.field}>
            <label className={ui.label}>{t("dateTo")}</label>
            <input
              className={ui.input}
              type="date"
              value={draftDates.date_to}
              onChange={(e) => setDraftDates((prev) => ({ ...prev, date_to: e.target.value }))}
            />
          </div>
        </div>
      </TgSheet>
    </div>
  );
};

export default BatchReceiptsPageTelegram;
