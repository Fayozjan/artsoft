import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Package, Clock, CheckCircle2 } from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";
import { useWidgetsStore } from "../stores/widgetsStore";

import { getBatchReceipts, getBatchReceiptsStats, deleteBatchReceiptById } from "../api";

import AddBatchReceipt from "../components/AddBatchReceipt";
import AddBatchReceiptItem from "../components/AddBatchReceiptItem";
import BatchReceiptDetail from "../components/BatchReceiptDetail";
import OnScreenKeyboard from "../components/OnScreenKeyboard";
import Button from "../components/Button";
import Pagination from "../components/Pagination";
import Loading from "../components/Loading";
import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import Search from "../components/Search";

import { Icons } from "../icons/icons";
import styles from "./BatchReceiptsPage.module.scss";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU");
};

const STATUS_META = {
  draft: { color: "#f59e0b", labelKey: "draft" },
  accepted: { color: "#16a34a", labelKey: "accepted" },
};

const StatusBadge = ({ status, t }) => {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return (
    <span
      className={styles.statusBadge}
      style={{ background: meta.color + "20", color: meta.color }}
    >
      {t(meta.labelKey)}
    </span>
  );
};

const StatWidget = ({ icon: Icon, color, label, value }) => (
  <div className={styles.statWidget}>
    <div className={styles.statWidgetInner}>
      <div className={styles.statWidgetIcon} style={{ background: color + "18" }}>
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div className={styles.statWidgetContent}>
        <span className={styles.statWidgetLabel}>{label}</span>
        <span className={styles.statWidgetValue} style={{ color }}>{value ?? "—"}</span>
      </div>
    </div>
  </div>
);

const BatchReceiptsPage = () => {
  const { t } = useTranslation();
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const { showAlert } = useAlertStore();
  const { widgetsVisible } = useWidgetsStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Открытая партия живёт в URL (?batch=ID): это отдельная "страница" внутри
  // пункта меню. Путь не меняется, поэтому права меню (по pathname) продолжают
  // работать, а кнопка "назад" браузера возвращает к списку.
  const openId = searchParams.get("batch");

  const [formData, setFormData] = useState({ search: "", status: "", date_from: "", date_to: "" });
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);

  // "add" — ручное создание партии (только шапка), "scan" — создание сканированием,
  // "edit" — правка партии, "addItem" — добавление позиции в открытую партию.
  const [modalType, setModalType] = useState(null); // "add" | "scan" | "edit" | "addItem" | null
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Инкремент пересоздаёт страницу партии (перезагрузка данных) после редактирования.
  const [detailVersion, setDetailVersion] = useState(0);

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const addFormRef = useRef(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const [viewType, setViewType] = useState("card");

  const [widgetsScrollHidden, setWidgetsScrollHidden] = useState(false);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointer = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    const onScroll = () => setFilterOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll);
    };
  }, [filterOpen]);

  const handleTableScroll = (e) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const lastScrollTop = lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll < 40) {
      setWidgetsScrollHidden(false);
      return;
    }

    const delta = scrollTop - lastScrollTop;
    if (scrollTop <= 0) {
      setWidgetsScrollHidden(false);
    } else if (delta > 8) {
      setWidgetsScrollHidden(true);
    }
  };

  const fetchData = useCallback(
    async (page = currentPage, filters = formData, size = pageSize) => {
      setLoading(true);
      try {
        const { data, pagination } = await getBatchReceipts({
          page,
          pageSize: size,
          filters,
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
    },
    [],
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await getBatchReceiptsStats();
      if (res.success) setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData(currentPage, formData, pageSize);
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  const handleReset = () => {
    const empty = { search: formData.search, status: "", date_from: "", date_to: "" };
    setFormData(empty);
    setCurrentPage(1);
    fetchData(1, empty, pageSize);
  };

  const activeFilterCount = [formData.status, formData.date_from, formData.date_to].filter(
    Boolean,
  ).length;

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage(1);
  };

  const openBatch = (batchId) => {
    navigate({ search: `?batch=${batchId}` }, { state: { fromList: true } });
  };

  const closeBatch = () => {
    // Пришли из списка — откатываем историю, иначе (прямая ссылка) заменяем URL.
    if (location.state?.fromList) navigate(-1);
    else setSearchParams({}, { replace: true });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { success } = await deleteBatchReceiptById(deleteTarget);
      if (!success) return showAlert(t("error"), "error");
      showAlert(t("success"), "success");
      closeSidebar();
      if (openId) closeBatch();
      fetchData(currentPage, formData, pageSize);
      fetchStats();
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const closeSidebar = () => {
    setModalType(null);
    setKeyboardOpen(false);
  };

  const keyboardPanel = {
    isOpen: keyboardOpen,
    width: "480px",
    children: (
      <OnScreenKeyboard
        onChar={(ch) => addFormRef.current?.insertChar(ch)}
        onBackspace={() => addFormRef.current?.backspace()}
        onSpace={() => addFormRef.current?.space()}
        onEnter={() => addFormRef.current?.pressEnter()}
        onClose={() => setKeyboardOpen(false)}
      />
    ),
  };

  return (
    <div className={styles.page}>
      {openId ? (
        <div className={styles.main}>
          <BatchReceiptDetail
            key={`${openId}-${detailVersion}`}
            id={openId}
            canAdd={canAdd}
            canEdit={canEdit}
            canDelete={canDelete}
            onClose={closeBatch}
            onEdit={() => setModalType("edit")}
            onAddItem={() => setModalType("addItem")}
            onDeleteRequest={(id) => setDeleteTarget(id)}
            onRefresh={() => {
              fetchData(currentPage, formData, pageSize);
              fetchStats();
            }}
          />
        </div>
      ) : loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          {widgetsVisible && stats && (
            <div
              className={`${styles.statsGridWrap} ${widgetsScrollHidden ? styles.statsGridWrapHidden : ""}`}
            >
              <div className={styles.statsGridInner}>
                <div className={styles.statsGrid}>
                  <StatWidget icon={Package} color="#6366f1" label={t("statsTotal")} value={stats.total} />
                  <StatWidget icon={Clock} color="#f59e0b" label={t("draft")} value={stats.draft} />
                  <StatWidget icon={CheckCircle2} color="#16a34a" label={t("accepted")} value={stats.accepted} />
                </div>
              </div>
            </div>
          )}

          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

              <div ref={filterRef} className={styles.filterToggle}>
                <div
                  className={`${styles.toggleBtn} ${activeFilterCount > 0 ? styles.toggleBtnActive : ""}`}
                  onClick={() => setFilterOpen((v) => !v)}
                >
                  {Icons.filter}
                  {activeFilterCount > 0 && <span className={styles.badge}>{activeFilterCount}</span>}
                </div>

                {filterOpen && (
                  <div className={styles.filterDropdown}>
                    <div className={styles.filterField}>
                      <label>{t("status")}</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                      >
                        <option value="">{t("filterAll")}</option>
                        <option value="draft">{t("draft")}</option>
                        <option value="accepted">{t("accepted")}</option>
                      </select>
                    </div>

                    <div className={styles.filterRow}>
                      <div className={styles.filterField}>
                        <label>{t("dateFrom")}</label>
                        <input
                          type="date"
                          value={formData.date_from}
                          onChange={(e) => setFormData((f) => ({ ...f, date_from: e.target.value }))}
                          onFocus={(e) => e.target.showPicker?.()}
                        />
                      </div>
                      <div className={styles.filterField}>
                        <label>{t("dateTo")}</label>
                        <input
                          type="date"
                          value={formData.date_to}
                          onChange={(e) => setFormData((f) => ({ ...f, date_to: e.target.value }))}
                          onFocus={(e) => e.target.showPicker?.()}
                        />
                      </div>
                    </div>

                    <div className={styles.filterActions}>
                      <button onClick={handleReset}>{t("clearAll")}</button>
                      <button
                        className={styles.applyBtn}
                        onClick={() => {
                          handleSearch();
                          setFilterOpen(false);
                        }}
                      >
                        {t("apply")}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.viewModeToggle}>
                <button
                  type="button"
                  className={viewType === "list" ? styles.active : ""}
                  title={t("listView")}
                  onClick={() => setViewType("list")}
                >
                  {Icons.list}
                  <span>{t("listView")}</span>
                </button>
                <button
                  type="button"
                  className={viewType === "card" ? styles.active : ""}
                  title={t("cardView")}
                  onClick={() => setViewType("card")}
                >
                  {Icons.card}
                  <span>{t("cardView")}</span>
                </button>
              </div>
            </div>

            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              handleChangePageSize={handleChangePageSize}
              handlePageChange={handlePageChange}
            />

            <div className={styles.buttonsWrapper}>
              {canAdd && (
                <Button text={t("addByScan")} icon={Icons.scan} variant="light" onClick={() => setModalType("scan")} />
              )}
              {canAdd && (
                <Button text={t("add")} onClick={() => setModalType("add")} />
              )}
              <div
                className={styles.refreshBtn}
                onClick={() => {
                  fetchData(currentPage, formData, pageSize);
                  fetchStats();
                }}
              >
                {Icons.refresh}
              </div>
            </div>
          </div>

          {viewType === "card" ? (
            <div className={styles.cardGrid} onScroll={handleTableScroll}>
              {data.length > 0 ? (
                data.map((row) => (
                  <div
                    key={row.id}
                    className={styles.card}
                    onClick={() => openBatch(row.id)}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardBatchBlock}>
                        <span className={styles.cardLabel}>{t("batchNumber")}</span>
                        <span className={styles.cardBatchNumber}>{row.batch_number}</span>
                      </div>
                      <StatusBadge status={row.status} t={t} />
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardRow}>
                        <span className={styles.cardLabel}>{t("receiptDate")}</span>
                        <span className={styles.cardValue}>{formatDate(row.receipt_date)}</span>
                      </div>
                      <div className={styles.cardRow}>
                        <span className={styles.cardLabel}>{t("customerOrderNumber")}</span>
                        <span className={styles.cardValue}>{row.order_number || "—"}</span>
                      </div>
                      <div className={styles.cardRow}>
                        <span className={styles.cardLabel}>{t("customer")}</span>
                        <span className={styles.cardValue}>{row.customer || "—"}</span>
                      </div>
                    </div>
                    {row.comment && (
                      <div className={styles.cardComment}>{row.comment}</div>
                    )}
                  </div>
                ))
              ) : (
                <div className={styles.cardEmpty}>{t("noData")}</div>
              )}
            </div>
          ) : (
            <div className={styles.tableContainer} onScroll={handleTableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>№</th>
                    <th>{t("documentNumber")}</th>
                    <th>{t("batchNumber")}</th>
                    <th>{t("receiptDate")}</th>
                    <th>{t("customer")}</th>
                    <th>{t("customerOrderNumber")}</th>
                    <th>{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length > 0 ? (
                    data.map((row, i) => (
                      <tr
                        key={row.id}
                        className={styles.clickableRow}
                        onClick={() => openBatch(row.id)}
                      >
                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                        <td>{row.document_number}</td>
                        <td>{row.batch_number}</td>
                        <td>{formatDate(row.receipt_date)}</td>
                        <td>{row.customer || "—"}</td>
                        <td>{row.order_number || "—"}</td>
                        <td>
                          <StatusBadge status={row.status} t={t} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className={styles.noData}>{t("noData")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <OverlaySidebar isOpen={modalType === "add"} onClose={closeSidebar} width="min(720px, 96vw)" leftPanel={keyboardPanel}>
        {modalType === "add" && (
          <AddBatchReceipt
            ref={addFormRef}
            mode="manual"
            keyboardOpen={keyboardOpen}
            onToggleKeyboard={() => setKeyboardOpen((v) => !v)}
            handleClose={closeSidebar}
            // Созданную (или уже существующую) партию сразу открываем — позиции
            // добавляются внутри неё.
            onSuccess={(batchId) => {
              closeSidebar();
              if (batchId) openBatch(batchId);
              fetchData(1, formData, pageSize);
              fetchStats();
            }}
          />
        )}
      </OverlaySidebar>

      <OverlaySidebar isOpen={modalType === "scan"} onClose={closeSidebar} width="min(1300px, 96vw)" leftPanel={keyboardPanel}>
        {modalType === "scan" && (
          <AddBatchReceipt
            ref={addFormRef}
            mode="scan"
            keyboardOpen={keyboardOpen}
            onToggleKeyboard={() => setKeyboardOpen((v) => !v)}
            handleClose={closeSidebar}
            onSuccess={(mergedId) => {
              closeSidebar();
              if (mergedId) openBatch(mergedId);
              fetchData(1, formData, pageSize);
              fetchStats();
            }}
          />
        )}
      </OverlaySidebar>

      <OverlaySidebar isOpen={modalType === "addItem"} onClose={closeSidebar} width="min(720px, 96vw)" leftPanel={keyboardPanel}>
        {modalType === "addItem" && (
          <AddBatchReceiptItem
            ref={addFormRef}
            batchId={openId}
            keyboardOpen={keyboardOpen}
            onToggleKeyboard={() => setKeyboardOpen((v) => !v)}
            handleClose={closeSidebar}
            onSuccess={() => {
              closeSidebar();
              setDetailVersion((v) => v + 1);
              fetchData(currentPage, formData, pageSize);
            }}
          />
        )}
      </OverlaySidebar>

      <OverlaySidebar isOpen={modalType === "edit"} onClose={closeSidebar} width="min(1300px, 96vw)" leftPanel={keyboardPanel}>
        {modalType === "edit" && (
          <AddBatchReceipt
            ref={addFormRef}
            keyboardOpen={keyboardOpen}
            onToggleKeyboard={() => setKeyboardOpen((v) => !v)}
            id={openId}
            handleClose={closeSidebar}
            onSuccess={() => {
              closeSidebar();
              setDetailVersion((v) => v + 1);
              fetchData(currentPage, formData, pageSize);
              fetchStats();
            }}
          />
        )}
      </OverlaySidebar>

      <CenterModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onAccept={handleDelete}
        title={t("areYouSureDelete")}
      />
    </div>
  );
};

export default BatchReceiptsPage;
