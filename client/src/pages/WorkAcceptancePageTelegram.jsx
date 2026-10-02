import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getWorkStickers, revertWorkSticker, getWorkStickerTemplate } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

import ScanWorkSticker from "../components/ScanWorkSticker";
import CenterModal from "../components/CenterModal";
import {
  IconSearch,
  IconClose,
  IconCopy,
  IconUndo,
  IconChevronDown,
  IconUsers,
  IconScan,
  IconClock,
  IconLayers,
  IconCheck,
} from "../components/tg/tgIcons";
import { goodQuantity, totalAmount } from "../utils/quantity";
import { reworkOriginLabel } from "../utils/reworkOrigin";
import styles from "./WorkAcceptancePageTelegram.module.scss";

const PAGE_SIZE = 20;

const fmtNum = (value) =>
  value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 4 });

const formatDateTime = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

const personName = (person) => [person?.last_name, person?.first_name].filter(Boolean).join(" ") || "—";

// Копирование кода: Clipboard API есть только в secure context — иначе через временный textarea.
const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

// Лента стикеров одного статуса с поиском и бесконечной прокруткой.
// pane — ref прокручиваемого контейнера ленты (корень IntersectionObserver).
function useStickerFeed(status, paneRef, onError) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");

  const searchRef = useRef("");
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
        const { data: rows, pagination } = await getWorkStickers({
          page,
          pageSize: PAGE_SIZE,
          // По правам логина: доступные операции и, если включено, только свои.
          filters: { status, by_production_access: true, search: searchRef.current },
        });
        if (requestId !== requestIdRef.current) return;

        const list = rows || [];
        setData((prev) => (page === 1 ? list : [...prev, ...list]));
        // Счётчик вкладки — без учёта поиска, иначе бейдж «прыгает» при вводе запроса.
        if (!searchRef.current) setTotal(pagination?.totalItems ?? null);
        pageRef.current = page;
        hasMoreRef.current = page < (pagination?.totalPages || 1);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error(err);
        onError?.();
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [status, onError],
  );

  const reload = useCallback(() => fetchPage(1, true), [fetchPage]);

  useEffect(() => {
    fetchPage(1);
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  const changeSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchRef.current = value.trim();
      fetchPage(1);
    }, 350);
  };

  const sentinelRef = useCallback(
    (node) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) fetchPage(pageRef.current + 1);
        },
        { root: paneRef.current, rootMargin: "300px" },
      );
      observerRef.current.observe(node);
    },
    [fetchPage, paneRef],
  );

  return { data, total, loading, loadingMore, search, changeSearch, reload, sentinelRef };
}

const SearchBar = ({ value, onChange, placeholder }) => (
  <div className={styles.searchBar}>
    <label className={styles.searchBox}>
      <span className={styles.searchIcon}>
        <IconSearch />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
      />
      {value && (
        <button type="button" className={styles.clearBtn} onClick={() => onChange("")} aria-label="clear">
          <IconClose />
        </button>
      )}
    </label>
  </div>
);

const SkeletonCard = () => (
  <div className={styles.skeleton}>
    <span className={styles.skLine} style={{ width: "40%" }} />
    <span className={styles.skLine} style={{ width: "70%", height: 18 }} />
    <span className={styles.skLine} style={{ width: "90%", height: 40 }} />
  </div>
);

const EmptyState = ({ icon, text }) => (
  <div className={styles.empty}>
    <span className={styles.emptyIcon}>{icon}</span>
    <p>{text}</p>
  </div>
);

const MoreLoader = () => (
  <div className={styles.moreLoader}>
    <span />
    <span />
    <span />
  </div>
);

const CodeChip = ({ code, onCopy, t }) => (
  <button
    type="button"
    className={styles.codeChip}
    onClick={(e) => {
      e.stopPropagation();
      onCopy(code);
    }}
    aria-label={t("copyCode")}
  >
    <span>{code}</span>
    <IconCopy />
  </button>
);

const PrevInfo = ({ parent, origin, onCopy, t }) =>
  parent ? (
    <div className={styles.prevInfo}>
      <span>
        {t("workStickerPrevOperation")}: <b>{parent.operationType?.name || "—"}</b>
      </span>
      <span>
        {t("workStickerPrevSticker")}:{" "}
        <b
          className={styles.prevCode}
          onClick={(e) => {
            e.stopPropagation();
            onCopy(parent.sticker_code);
          }}
        >
          {parent.sticker_code}
        </b>
      </span>
      {origin && origin.id !== parent.id && (
        <span>
          {t("workStickerReworkOriginFrom")}: <b>{reworkOriginLabel(origin)}</b>
        </span>
      )}
    </div>
  ) : null;

// Стикер, который ждёт скана: код, операция, партия и количество к приёму.
const PendingCard = ({ row, onOpen, onCopy, innerRef, t }) => (
  <div
    ref={innerRef}
    className={styles.card}
    role="button"
    tabIndex={0}
    onClick={() => onOpen(row)}
    onKeyDown={(e) => e.key === "Enter" && onOpen(row)}
  >
    <div className={styles.cardHead}>
      <CodeChip code={row.sticker_code} onCopy={onCopy} t={t} />
      <span className={styles.cardDate}>{formatDateTime(row.added_at)}</span>
    </div>

    <div className={styles.cardTitleRow}>
      <h3 className={styles.operation}>{row.operationType?.name || "—"}</h3>
      {/* Подпись над номером — в «Ждут» партию сверяют с бумажным стикером. */}
      <span className={`${styles.batchChip} ${styles.batchChipLabeled}`}>
        <small>{t("batchNumber")}</small>
        <b>{row.batchReceiptItem?.receipt?.batch_number || "—"}</b>
      </span>
    </div>

    <PrevInfo parent={row.parent} origin={row.origin} onCopy={onCopy} t={t} />

    <div className={styles.tiles}>
      <div className={`${styles.tile} ${styles.tileMuted}`}>
        <span>{t("workStickerFieldQuantity")}</span>
        <b>{fmtNum(row.planned_quantity)}</b>
      </div>
      {/* Размер — строка ("XL", "42-44"), не число: без fmtNum. */}
      {row.batchReceiptItem?.size && (
        <div className={`${styles.tile} ${styles.tileMuted}`}>
          <span>{t("size")}</span>
          <b>{row.batchReceiptItem.size}</b>
        </div>
      )}
    </div>
  </div>
);

// Принятый стикер: исполнители, разложение количества, сумма и «Вернуть».
const HistoryCard = ({ row, onOpen, onCopy, onReturn, canReturn, innerRef, t }) => {
  const [teamOpen, setTeamOpen] = useState(false);

  const workers = [
    { key: "main", person: row.employee, quantity: row.actual_quantity },
    ...(row.shares || []).map((share) => ({ key: share.id, person: share.employee, quantity: share.actual_quantity })),
  ];
  const isTeam = workers.length > 1;

  const tiles = [
    { key: "good", label: t("workStickerActualQuantity"), value: goodQuantity(row), tone: styles.tileGood },
    {
      key: "defect",
      label: t("workStickerDefectQuantity"),
      value: row.defect_quantity ?? 0,
      tone: Number(row.defect_quantity) > 0 ? styles.tileBad : styles.tileMuted,
    },
    {
      key: "rework",
      label: t("workStickerSplitRework"),
      value: row.rework_quantity ?? 0,
      tone: Number(row.rework_quantity) > 0 ? styles.tileWarn : styles.tileMuted,
    },
    ...(Number(row.incomplete_quantity) > 0
      ? [{ key: "incomplete", label: t("workStickerIncompleteQuantity"), value: row.incomplete_quantity, tone: styles.tileInfo }]
      : []),
  ];

  const canReturnRow = canReturn && (row.children?.length || 0) === 0 && !row.merged_into_id && !row.awaiting_merge;

  return (
    <div
      ref={innerRef}
      className={`${styles.card} ${styles.cardDone}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(row)}
    >
      <div className={styles.cardHead}>
        <CodeChip code={row.sticker_code} onCopy={onCopy} t={t} />
        <span className={styles.cardDate}>{formatDateTime(row.scanned_at)}</span>
      </div>

      <div className={styles.cardTitleRow}>
        <h3 className={styles.operation}>{row.operationType?.name || "—"}</h3>
        <span className={styles.batchChip}>{row.batchReceiptItem?.receipt?.batch_number || "—"}</span>
      </div>

      <PrevInfo parent={row.parent} origin={row.origin} onCopy={onCopy} t={t} />

      {row.merged_into_id && row.mergedInto && (
        <div className={`${styles.prevInfo} ${styles.noteInfo}`}>
          <span>
            {t("workStickerMergedIntoTitle")}: <b>{row.mergedInto.sticker_code}</b>
          </span>
          <span>
            {t("workStickerNextOperation")}: <b>{row.mergedInto.operationType?.name || "—"}</b>
          </span>
        </div>
      )}

      {row.awaiting_merge && !row.merged_into_id && (
        <div className={`${styles.prevInfo} ${styles.noteInfo}`}>
          <span>{t("workStickerAwaitingMergeTitle")}</span>
        </div>
      )}

      {row.employee && (
        <div className={styles.workers}>
          {isTeam ? (
            <button
              type="button"
              className={`${styles.teamToggle} ${teamOpen ? styles.teamToggleOpen : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setTeamOpen((v) => !v);
              }}
            >
              <IconUsers />
              <span>{t("workStickerTeamWork")}</span>
              <b>{workers.length}</b>
              <IconChevronDown />
            </button>
          ) : (
            <div className={styles.worker}>
              <span>{personName(row.employee)}</span>
            </div>
          )}
          {isTeam && teamOpen && (
            <div className={styles.teamList}>
              {workers.map((worker) => (
                <div className={styles.worker} key={worker.key}>
                  <span>{personName(worker.person)}</span>
                  <b>{fmtNum(worker.quantity)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.key} className={`${styles.tile} ${tile.tone}`}>
            <span>{tile.label}</span>
            <b>{fmtNum(tile.value)}</b>
          </div>
        ))}
      </div>

      <div className={styles.moneyRow}>
        <div className={styles.money}>
          <span>{t("price")}</span>
          <b>{fmtNum(row.rate)}</b>
        </div>
        <div className={`${styles.money} ${styles.moneyTotal}`}>
          <span>{t("amount")}</span>
          <b>{fmtNum(totalAmount(row))}</b>
        </div>
        {canReturnRow && (
          <button
            type="button"
            className={styles.returnBtn}
            onClick={(e) => {
              e.stopPropagation();
              onReturn(row);
            }}
          >
            <IconUndo />
            <span>{t("workStickerReturn")}</span>
          </button>
        )}
      </div>
    </div>
  );
};

// Приём работы в Telegram: три вкладки — «Скан» (приём и раздача стикера), «Ждут»
// (стикеры, ещё не принятые) и «История» (принятые). Выбор карточки в списках
// открывает стикер на вкладке «Скан», как будто его только что считали.
const WorkAcceptancePageTelegram = ({ routePath = "/work-acceptance" }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { canDelete } = usePermissionsTelegram(routePath);

  const [tab, setTab] = useState("scan");
  const [stickerTemplate, setStickerTemplate] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  // Закреплённый низ страницы: сюда порталом уходят «Принять» и «Раздать дальше».
  const [dockNode, setDockNode] = useState(null);

  const scanRef = useRef(null);
  const scanPaneRef = useRef(null);
  const pendingPaneRef = useRef(null);
  const historyPaneRef = useRef(null);

  const onLoadError = useCallback(() => showAlert(t("errorLoading"), "error"), [showAlert, t]);
  const pending = useStickerFeed("pending", pendingPaneRef, onLoadError);
  const history = useStickerFeed("done", historyPaneRef, onLoadError);

  useEffect(() => {
    getWorkStickerTemplate()
      .then((res) => setStickerTemplate(res.data))
      .catch((err) => console.error(err));
  }, []);

  const reloadPending = pending.reload;
  const reloadHistory = history.reload;
  const refreshLists = useCallback(() => {
    reloadPending();
    reloadHistory();
  }, [reloadPending, reloadHistory]);

  usePullToRefresh(reloadPending, pendingPaneRef, pending.loading);
  usePullToRefresh(reloadHistory, historyPaneRef, history.loading);

  const handleCopy = async (code) => {
    try {
      await copyText(code);
      showAlert(t("copied"), "success");
    } catch {
      showAlert(t("error"), "error");
    }
  };

  // Открыть стикер во вкладке «Скан». Раздан дальше — вместе с созданными из него стикерами.
  const openSticker = async (row) => {
    // Ждёт скана — идём тем же путём, что и при считывании кода (проверки, цена, команда).
    if (row.status === "pending") {
      setTab("scan");
      scanRef.current?.scanCode(row.sticker_code);
      return;
    }

    let children = [];
    if ((row.children?.length || 0) > 0) {
      try {
        const { data } = await getWorkStickers({ pageSize: 500, filters: { parent_sticker_id: row.id } });
        children = data || [];
      } catch (err) {
        showAlert(err?.response?.data?.error || t("error"), "error");
        return;
      }
    }
    setTab("scan");
    scanRef.current?.openSticker(row, children);
  };

  // Принятый стикер удалять нельзя (по нему начислена оплата) — его возвращают в
  // pending: приём отменяется, стикер можно принять заново.
  const handleReturn = async () => {
    if (!returnTarget) return;
    try {
      const { success } = await revertWorkSticker(returnTarget.sticker_code);
      if (!success) return showAlert(t("error"), "error");
      showAlert(t("success"), "success");
      refreshLists();
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setReturnTarget(null);
    }
  };

  const tabs = [
    { key: "scan", label: t("tgTabScan"), icon: <IconScan /> },
    { key: "pending", label: t("tgTabPending"), icon: <IconClock />, count: pending.total },
    { key: "history", label: t("tgTabHistory"), icon: <IconCheck /> },
  ];
  const activeIndex = tabs.findIndex((item) => item.key === tab);

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <header className={styles.head}>
        <h1 className={styles.title}>{t("work-acceptance")}</h1>

        <nav className={styles.segment} role="tablist">
          <span className={styles.segmentPill} style={{ transform: `translateX(${activeIndex * 100}%)` }} />
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`${styles.segmentBtn} ${tab === item.key ? styles.segmentBtnActive : ""}`}
              onClick={() => setTab(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.count > 0 && <b>{item.count}</b>}
            </button>
          ))}
        </nav>
      </header>

      <div className={styles.panes}>
        <div ref={scanPaneRef} className={`${styles.pane} ${tab === "scan" ? "" : styles.paneHidden}`}>
          <ScanWorkSticker
            ref={scanRef}
            stickerTemplate={stickerTemplate}
            canDelete={canDelete}
            onDone={refreshLists}
            dockNode={dockNode}
            compact
          />
        </div>

        <div ref={pendingPaneRef} className={`${styles.pane} ${tab === "pending" ? "" : styles.paneHidden}`}>
          <SearchBar value={pending.search} onChange={pending.changeSearch} placeholder={t("search")} />
          <div className={styles.list}>
            {pending.loading ? (
              Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)
            ) : pending.data.length === 0 ? (
              <EmptyState icon={<IconLayers />} text={t("noData")} />
            ) : (
              pending.data.map((row, index) => (
                <PendingCard
                  key={row.id}
                  row={row}
                  t={t}
                  onOpen={openSticker}
                  onCopy={handleCopy}
                  innerRef={index === pending.data.length - 3 ? pending.sentinelRef : null}
                />
              ))
            )}
            {pending.loadingMore && <MoreLoader />}
          </div>
        </div>

        <div ref={historyPaneRef} className={`${styles.pane} ${tab === "history" ? "" : styles.paneHidden}`}>
          <SearchBar value={history.search} onChange={history.changeSearch} placeholder={t("search")} />
          <div className={styles.list}>
            {history.loading ? (
              Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)
            ) : history.data.length === 0 ? (
              <EmptyState icon={<IconLayers />} text={t("noData")} />
            ) : (
              history.data.map((row, index) => (
                <HistoryCard
                  key={row.id}
                  row={row}
                  t={t}
                  canReturn={canDelete}
                  onOpen={openSticker}
                  onCopy={handleCopy}
                  onReturn={setReturnTarget}
                  innerRef={index === history.data.length - 3 ? history.sentinelRef : null}
                />
              ))
            )}
            {history.loadingMore && <MoreLoader />}
          </div>
        </div>
      </div>

      {/* Низ вкладки «Скан»: под прокручиваемой областью, на сплошном фоне — данные не
          просвечивают. Пустой (нет карточки) или чужая вкладка — скрыт. */}
      <div ref={setDockNode} className={`${styles.dock} ${tab === "scan" ? "" : styles.dockHidden}`} />

      <CenterModal
        isOpen={returnTarget !== null}
        onClose={() => setReturnTarget(null)}
        onAccept={handleReturn}
        message={t("workStickerReturnConfirm")}
      />
    </div>
  );
};

export default WorkAcceptancePageTelegram;
