import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { usePermissions } from "../hooks/usePermissions";
import { useAlertStore } from "../stores/alertStore";
import { getWorkStickers, revertWorkSticker, getWorkStickerTemplate } from "../api";

import ScanWorkSticker from "../components/ScanWorkSticker";
import Pagination from "../components/Pagination";
import Search from "../components/Search";
import Loading from "../components/Loading";
import CenterModal from "../components/CenterModal";
import EmployeeCell from "../components/EmployeeCell";

import { goodQuantity, totalAmount } from "../utils/quantity";
import { reworkOriginLabel } from "../utils/reworkOrigin";
import { Icons } from "../icons/icons";
import styles from "./WorkAcceptancePage.module.scss";

const fmtNum = (value) =>
  value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("ru-RU");

const formatDateTime = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("ru-RU");
};

// Правые блоки (история / ждут скана) — раскрыт только один сразу (accordion),
// выбор помним между визитами.
const ACTIVE_PANEL_KEY = "workAcceptanceActivePanel";

const WorkAcceptancePage = () => {
  const { t } = useTranslation();
  const currentPath = window.location.pathname;
  const { canDelete } = usePermissions(currentPath);
  const { showAlert } = useAlertStore();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [returnTarget, setReturnTarget] = useState(null);
  // Стикеры, ждущие скана (status: pending) — тот же список прав, что и у истории.
  const [pendingData, setPendingData] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(20);
  const [pendingTotalItems, setPendingTotalItems] = useState(0);
  // Режим объединения (тоггл в ScanWorkSticker, см. onMergeModeChange): пока он
  // активен, правые блоки скрыты, а их кнопки в верхней строке заблокированы.
  const [mergeModeActive, setMergeModeActive] = useState(false);
  // По умолчанию оба блока справа скрыты; раскрыт может быть только один.
  const [activePanel, setActivePanel] = useState(() => {
    const stored = localStorage.getItem(ACTIVE_PANEL_KEY);
    return stored === "history" || stored === "pending" ? stored : null;
  });
  // activePanel в режиме объединения не трогаем — выбранный блок вернётся после выхода из него.
  const historyHidden = activePanel !== "history" || mergeModeActive;
  const pendingHidden = activePanel !== "pending" || mergeModeActive;
  // Командная работа (больше одного сотрудника) свёрнута по умолчанию — id стикеров, раскрытых вручную.
  const [expandedTeams, setExpandedTeams] = useState(() => new Set());

  const toggleTeam = (e, id) => {
    e.stopPropagation();
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Раскрыть один из правых блоков — второй сворачивается сам (одно и то же состояние).
  const openPanel = (panel) => {
    setActivePanel(panel);
    localStorage.setItem(ACTIVE_PANEL_KEY, panel);
  };

  // Свернуть текущий раскрытый блок в узкую полосу.
  const closePanel = () => {
    setActivePanel(null);
    localStorage.removeItem(ACTIVE_PANEL_KEY);
  };

  // Поле ввода (formData) и применённый запрос (searchRef): fetchData живёт в
  // useCallback([]), поэтому читает поиск из ref — обновление/удаление сохраняют его.
  const [formData, setFormData] = useState({ search: "" });
  const searchRef = useRef("");
  const [pendingFormData, setPendingFormData] = useState({ search: "" });
  const pendingSearchRef = useRef("");

  const scanRef = useRef(null);
  const [stickerTemplate, setStickerTemplate] = useState(null);

  // Кнопки правых блоков в верхней строке: если с подписями они не помещаются
  // рядом с полем скана (уходят на вторую строку) — остаются только иконки.
  // Замер всегда в "полном" виде (класс снимаем), иначе после сжатия кнопки
  // казались бы помещающимися и вид прыгал бы туда-сюда. Класс ставим прямо в DOM:
  // замер и переключение — в одном кадре, без лишнего рендера.
  const scanPanelRef = useRef(null);
  const pendingToggleRef = useRef(null);
  useLayoutEffect(() => {
    const panel = scanPanelRef.current;
    const firstToggle = pendingToggleRef.current;
    // Кнопки стоят сразу после поля скана (topBarExtra в ScanWorkSticker).
    const scanBox = firstToggle?.previousElementSibling;
    if (!panel || !scanBox) return undefined;

    const measure = () => {
      panel.classList.remove(styles.togglesCompact);
      const wrapped = firstToggle.getBoundingClientRect().top - scanBox.getBoundingClientRect().top > 10;
      if (wrapped) panel.classList.add(styles.togglesCompact);
    };
    // Через rAF — иначе смена класса внутри колбэка ResizeObserver даёт "loop" в консоли.
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(panel);
    observer.observe(scanBox);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pendingTotalItems, mergeModeActive, t]);

  const fetchData = useCallback(async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const { data, pagination } = await getWorkStickers({
        page,
        pageSize: size,
        // История приёма — по правам логина: доступные операции и, если включено, только свои.
        filters: { status: "done", by_production_access: true, search: searchRef.current },
      });
      setData(data || []);
      setCurrentPage(pagination?.currentPage || 1);
      setTotalPages(pagination?.totalPages || 1);
      setTotalItems(pagination?.totalItems || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPending = useCallback(async (page = pendingCurrentPage, size = pendingPageSize) => {
    setPendingLoading(true);
    try {
      const { data, pagination } = await getWorkStickers({
        page,
        pageSize: size,
        // Ждут скана — по операциям, доступным логину. «Только свои» тут не при чём:
        // стикер ещё никем не принят, scanned_by пуст (см. backend).
        filters: { status: "pending", by_production_access: true, search: pendingSearchRef.current },
      });
      setPendingData(data || []);
      setPendingCurrentPage(pagination?.currentPage || 1);
      setPendingTotalPages(pagination?.totalPages || 1);
      setPendingTotalItems(pagination?.totalItems || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentPage, pageSize);
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchPending(pendingCurrentPage, pendingPageSize);
  }, [pendingCurrentPage, pendingPageSize]);

  useEffect(() => {
    getWorkStickerTemplate()
      .then((res) => setStickerTemplate(res.data))
      .catch((err) => console.error(err));
  }, []);

  // Плитки разложения стикера: выполнено — зелёная, брак — красная, исправление —
  // янтарная, не выполнено — фиолетовая (только если есть). Пустые брак /
  // исправление гасим в серый, чтобы цвет означал «есть».
  const getStats = (row) => [
    {
      key: "actual",
      label: t("workStickerActualQuantity"),
      value: goodQuantity(row),
      toneClass: styles.statGood,
    },
    {
      key: "defect",
      label: t("workStickerDefectQuantity"),
      value: row.defect_quantity ?? 0,
      toneClass: Number(row.defect_quantity) > 0 ? styles.statBad : styles.statMuted,
    },
    {
      key: "rework",
      label: t("workStickerSplitRework"),
      value: row.rework_quantity ?? 0,
      toneClass: Number(row.rework_quantity) > 0 ? styles.statWarn : styles.statMuted,
    },
    ...(Number(row.incomplete_quantity) > 0
      ? [
          {
            key: "incomplete",
            label: t("workStickerIncompleteQuantity"),
            value: row.incomplete_quantity,
            toneClass: styles.statInfo,
          },
        ]
      : []),
  ];

  // Основной исполнитель + доли остальных (команда) — единый список для карточки.
  const getWorkers = (row) => [
    { key: "main", person: row.employee, quantity: row.actual_quantity },
    ...(row.shares || []).map((share) => ({
      key: share.id,
      person: share.employee,
      quantity: share.actual_quantity,
    })),
  ];

  const getMoneyStats = (row) => [
    {
      key: "price",
      label: t("price"),
      value: row.rate,
      toneClass: styles.statMuted,
    },
    {
      key: "amount",
      label: t("amount"),
      value: totalAmount(row),
      toneClass: styles.statAmount,
    },
  ];

  // Карточка открывается в панели слева (там же распределяют после скана).
  // Не распределён — обычная карточка с распределением; распределён — карточка
  // и под ней стикеры, на которые он разделён.
  const handleRowClick = async (e, row) => {
    // Кнопки карточки и фото сотрудника (превью) не должны открывать стикер.
    if (e.target.closest("button, img")) return;
    // Выделили текст в карточке (скопировать партию, код и т.п.) — это не открытие.
    if (window.getSelection()?.toString()) return;

    if ((row.children?.length || 0) === 0) {
      scanRef.current?.openSticker(row);
      return;
    }

    try {
      const { data } = await getWorkStickers({
        pageSize: 500,
        filters: { parent_sticker_id: row.id },
      });
      scanRef.current?.openSticker(row, data || []);
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    }
  };

  const handleSearch = (data = formData) => {
    searchRef.current = (data.search || "").trim();
    setCurrentPage(1);
    fetchData(1, pageSize);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage(1);
  };

  const handlePendingSearch = (data = pendingFormData) => {
    pendingSearchRef.current = (data.search || "").trim();
    setPendingCurrentPage(1);
    fetchPending(1, pendingPageSize);
  };

  const handlePendingPageChange = (page) => {
    if (page >= 1 && page <= pendingTotalPages) setPendingCurrentPage(page);
  };

  const handlePendingChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPendingPageSize(size);
    setPendingCurrentPage(1);
  };

  // Принятый стикер удалять нельзя (по нему начислена оплата) — его возвращают
  // в pending: приём отменяется, стикер можно принять заново. Пока не раздан дальше.
  // Возвращённый снова появляется среди ждущих скана — обновляем и этот список.
  const handleReturnSticker = async () => {
    if (!returnTarget) return;
    try {
      const { success } = await revertWorkSticker(returnTarget.sticker_code);
      if (!success) return showAlert(t("error"), "error");
      showAlert(t("success"), "success");
      fetchData(currentPage, pageSize);
      fetchPending(pendingCurrentPage, pendingPageSize);
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setReturnTarget(null);
    }
  };

  // Клик по номеру стикера — копирует код в буфер, не открывая карточку.
  // Clipboard API доступен только в secure context (https/localhost) — на
  // обычном http внутри цеха его может не быть, тогда запасной путь через
  // временный textarea + execCommand.
  const handleCopyCode = async (e, code) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      showAlert(t("copied"), "success");
    } catch {
      showAlert(t("error"), "error");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div ref={scanPanelRef} className={styles.scanPanel}>
          <ScanWorkSticker
            ref={scanRef}
            stickerTemplate={stickerTemplate}
            canDelete={canDelete}
            onDone={() => {
              fetchData(1, pageSize);
              fetchPending(pendingCurrentPage, pendingPageSize);
            }}
            onMergeModeChange={setMergeModeActive}
            topBarExtra={
              // Кнопки правых блоков — в верхней строке после поля скана. Открыт
              // максимум один блок (accordion): повторный клик по нажатой закрывает его.
              <>
                <button
                  ref={pendingToggleRef}
                  type="button"
                  className={`${styles.topToggle} ${!pendingHidden ? styles.topToggleActive : ""}`}
                  aria-pressed={!pendingHidden}
                  title={t("workStickerAwaitingScan")}
                  disabled={mergeModeActive}
                  onClick={() => (pendingHidden ? openPanel("pending") : closePanel())}
                >
                  {Icons.clock}
                  <span className={styles.topToggleLabel}>{t("workStickerAwaitingScan")}</span>
                  {pendingTotalItems > 0 && <b className={styles.topToggleBadge}>{pendingTotalItems}</b>}
                </button>
                <button
                  type="button"
                  className={`${styles.topToggle} ${!historyHidden ? styles.topToggleActive : ""}`}
                  aria-pressed={!historyHidden}
                  title={t("workStickerHistory")}
                  disabled={mergeModeActive}
                  onClick={() => (historyHidden ? openPanel("history") : closePanel())}
                >
                  {Icons.check}
                  <span className={styles.topToggleLabel}>{t("workStickerHistory")}</span>
                </button>
              </>
            }
          />
        </div>

        <div className={`${styles.sidePanel} ${historyHidden ? styles.sidePanelHidden : ""}`}>
          <div className={styles.mainHeader}>
            <h3>{t("workStickerHistory")}</h3>
            <button type="button" className={styles.hideBtn} onClick={closePanel} title={t("hide")}>
              <span>{t("hide")}</span>
              {Icons.arrowRight}
            </button>
            <div className={styles.headerRight}>
              <div className={styles.searchWrap}>
                <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />
              </div>
              <div className={styles.refreshBtn} onClick={() => fetchData(currentPage, pageSize)}>
                {Icons.refresh}
              </div>
              <div className={styles.paginationWrap}>
                <Pagination
                  centered
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  totalPages={totalPages}
                  handleChangePageSize={handleChangePageSize}
                  handlePageChange={handlePageChange}
                />
              </div>
            </div>
          </div>

          <div className={styles.cardsContainer}>
            {loading ? (
              <Loading />
            ) : data.length > 0 ? (
              <div className={styles.cards}>
                {data.map((row) => {
                  const workers = getWorkers(row);
                  const isTeam = workers.length > 1;
                  const teamOpen = expandedTeams.has(row.id);
                  return (
                  <div key={row.id} className={styles.card} onClick={(e) => handleRowClick(e, row)}>
                    <div className={styles.cardHeader}>
                      {/* Код не открывает стикер — клик по нему копирует номер в буфер. */}
                      <span
                        className={styles.stickerCode}
                        onClick={(e) => handleCopyCode(e, row.sticker_code)}
                        title={t("copyCode")}
                      >
                        {row.sticker_code}
                      </span>
                      <span className={styles.cardDate}>{formatDateTime(row.scanned_at)}</span>
                    </div>

                    <div className={styles.cardTitle}>
                      <span className={styles.operationName}>{row.operationType?.name || "—"}</span>
                      <span className={styles.batchChip}>
                        {t("batchNumber")}: <b>{row.batchReceiptItem?.receipt?.batch_number || "—"}</b>
                      </span>
                    </div>

                    {/* Стикер получен разделением родителя — показываем, откуда пришла работа. */}
                    {row.parent && (
                      <div className={styles.prevInfo}>
                        <span>
                          {t("workStickerPrevOperation")}: <b>{row.parent.operationType?.name || "—"}</b>
                        </span>
                        <span>
                          {t("workStickerPrevSticker")}:{" "}
                          <b
                            className={styles.prevCode}
                            onClick={(e) => handleCopyCode(e, row.parent.sticker_code)}
                            title={t("copyCode")}
                          >
                            {row.parent.sticker_code}
                          </b>
                        </span>
                        {row.origin && row.origin.id !== row.parent?.id && (
                          <span>
                            {t("workStickerReworkOriginFrom")}: <b>{reworkOriginLabel(row.origin)}</b>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Годное объединили с другими и передали на след. операцию одним
                        стикером — без этого непонятно, куда стикер делся и почему его
                        больше нельзя вернуть/раздать отдельно. */}
                    {row.merged_into_id && row.mergedInto && (
                      <div className={`${styles.prevInfo} ${styles.mergedInfo}`}>
                        <span>
                          {t("workStickerMergedIntoTitle")}:{" "}
                          <b
                            className={styles.prevCode}
                            onClick={(e) => handleCopyCode(e, row.mergedInto.sticker_code)}
                            title={t("copyCode")}
                          >
                            {row.mergedInto.sticker_code}
                          </b>
                        </span>
                        <span>
                          {t("workStickerNextOperation")}: <b>{row.mergedInto.operationType?.name || "—"}</b>
                        </span>
                      </div>
                    )}

                    {/* Отмечен для объединения, но ещё не объединён — карточка не в
                        "чужом" состоянии сама по себе, просто раздать/вернуть нельзя,
                        пока отметку не снимут (см. кнопку на карточке WorkStickerRoutePanel). */}
                    {row.awaiting_merge && !row.merged_into_id && (
                      <div className={`${styles.prevInfo} ${styles.mergedInfo}`}>
                        <span>{t("workStickerAwaitingMergeTitle")}</span>
                      </div>
                    )}

                    {/* Работу могли выполнить несколько сотрудников — каждый со своей долей.
                        Команда (>1 чел.) свёрнута в чип, разворачивается по клику. */}
                    {row.employee && (
                      <div className={styles.workers}>
                        {isTeam && (
                          <button
                            type="button"
                            className={styles.teamToggle}
                            onClick={(e) => toggleTeam(e, row.id)}
                          >
                            {Icons.arrowRight}
                            <span>{t("workStickerTeamWork")}</span>
                            <b>{workers.length}</b>
                          </button>
                        )}
                        {(!isTeam || teamOpen) &&
                          workers.map((worker) => (
                            <div className={styles.employee} key={worker.key}>
                              <EmployeeCell
                                compact
                                hidePhoto
                                lastName={worker.person?.last_name}
                                firstName={worker.person?.first_name}
                                middleName={worker.person?.middle_name}
                                id={worker.person?.id}
                                active={worker.person?.status}
                              />
                              {isTeam && <b className={styles.workerQty}>{fmtNum(worker.quantity)}</b>}
                            </div>
                          ))}
                      </div>
                    )}

                    <div className={styles.statsRow}>
                      {getStats(row).map((stat) => (
                        <div key={stat.key} className={`${styles.stat} ${stat.toneClass}`}>
                          <span>{stat.label}</span>
                          <b>{fmtNum(stat.value)}</b>
                        </div>
                      ))}
                    </div>

                    <div className={styles.moneyRow}>
                      {getMoneyStats(row).map((stat) => (
                        <div key={stat.key} className={`${styles.stat} ${stat.toneClass}`}>
                          <span>{stat.label}</span>
                          <b>{fmtNum(stat.value)}</b>
                        </div>
                      ))}
                      {/* Раздан дальше (в т.ч. объединён с другими) — вернуть нельзя, кнопки нет. */}
                      {canDelete && (row.children?.length || 0) === 0 && !row.merged_into_id && !row.awaiting_merge && (
                        <button type="button" className={styles.returnBtn} onClick={() => setReturnTarget(row)}>
                          {Icons.undo}
                          <span>{t("workStickerReturn")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.noData}>{t("noData")}</div>
            )}
          </div>
        </div>

        <div className={`${styles.sidePanel} ${pendingHidden ? styles.sidePanelHidden : ""}`}>
          <div className={styles.mainHeader}>
            <h3>{t("workStickerAwaitingScan")}</h3>
            <button type="button" className={styles.hideBtn} onClick={closePanel} title={t("hide")}>
              <span>{t("hide")}</span>
              {Icons.arrowRight}
            </button>
            <div className={styles.headerRight}>
              <div className={styles.searchWrap}>
                <Search formData={pendingFormData} setFormData={setPendingFormData} onSearch={handlePendingSearch} />
              </div>
              <div className={styles.refreshBtn} onClick={() => fetchPending(pendingCurrentPage, pendingPageSize)}>
                {Icons.refresh}
              </div>
              <div className={styles.paginationWrap}>
                <Pagination
                  centered
                  currentPage={pendingCurrentPage}
                  pageSize={pendingPageSize}
                  totalItems={pendingTotalItems}
                  totalPages={pendingTotalPages}
                  handleChangePageSize={handlePendingChangePageSize}
                  handlePageChange={handlePendingPageChange}
                />
              </div>
            </div>
          </div>

          {/* Карточки без "принято/брак/сотрудник" — стикер ещё не отсканирован,
              этих данных пока нет. Клик открывает его в скан-панели слева, как
              будто только что считали (см. handleRowClick / openStickerCard). */}
          <div className={styles.cardsContainer}>
            {pendingLoading ? (
              <Loading />
            ) : pendingData.length > 0 ? (
              <div className={styles.cards}>
                {pendingData.map((row) => (
                  <div key={row.id} className={styles.card} onClick={(e) => handleRowClick(e, row)}>
                    <div className={styles.cardHeader}>
                      <span
                        className={styles.stickerCode}
                        onClick={(e) => handleCopyCode(e, row.sticker_code)}
                        title={t("copyCode")}
                      >
                        {row.sticker_code}
                      </span>
                      <span className={styles.cardDate}>{formatDateTime(row.added_at)}</span>
                    </div>

                    <div className={styles.cardTitle}>
                      <span className={styles.operationName}>{row.operationType?.name || "—"}</span>
                      <span className={`${styles.batchChip} ${styles.batchChipLabelSm}`}>
                        {t("batchNumber")}: <b>{row.batchReceiptItem?.receipt?.batch_number || "—"}</b>
                      </span>
                    </div>

                    {row.parent && (
                      <div className={styles.prevInfo}>
                        <span>
                          {t("workStickerPrevOperation")}: <b>{row.parent.operationType?.name || "—"}</b>
                        </span>
                        <span>
                          {t("workStickerPrevSticker")}:{" "}
                          <b
                            className={styles.prevCode}
                            onClick={(e) => handleCopyCode(e, row.parent.sticker_code)}
                            title={t("copyCode")}
                          >
                            {row.parent.sticker_code}
                          </b>
                        </span>
                        {row.origin && row.origin.id !== row.parent?.id && (
                          <span>
                            {t("workStickerReworkOriginFrom")}: <b>{reworkOriginLabel(row.origin)}</b>
                          </span>
                        )}
                      </div>
                    )}

                    <div className={styles.statsRow}>
                      <div className={`${styles.stat} ${styles.statMuted} ${styles.statLarge}`}>
                        <span>{t("workStickerFieldQuantity")}</span>
                        <b>{fmtNum(row.planned_quantity)}</b>
                      </div>
                      {/* Размер — строка ("XL", "42-44"), не число: без fmtNum. */}
                      {row.batchReceiptItem?.size && (
                        <div className={`${styles.stat} ${styles.statLarge}`}>
                          <span>{t("size")}</span>
                          <b>{row.batchReceiptItem.size}</b>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noData}>{t("noData")}</div>
            )}
          </div>
        </div>
      </div>

      <CenterModal
        isOpen={returnTarget !== null}
        onClose={() => setReturnTarget(null)}
        onAccept={handleReturnSticker}
        message={t("workStickerReturnConfirm")}
      />
    </div>
  );
};

export default WorkAcceptancePage;
