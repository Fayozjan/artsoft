import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { usePermissions } from "../hooks/usePermissions";
import { useAlertStore } from "../stores/alertStore";
import { getOperationTypes, deleteOperationTypeById } from "../api";
import { userDisplayName } from "../utils/userDisplayName";
import { UNIT_LABEL_KEYS, COMPLEXITY_META } from "../utils/operationType";

import AddOperationType from "../components/AddOperationType";
import OperationRouteMap from "../components/OperationRouteMap";
import CenterModal from "../components/CenterModal";
import { ActionButton } from "../components/ActionButtons";
import Pagination from "../components/Pagination";
import Loading from "../components/Loading";
import Search from "../components/Search";
import OperationTypesFilter from "../components/OperationTypesFilter";
import Badge from "../components/Badge";
import buttonStyles from "../components/Button.module.scss";

import { Icons } from "../icons/icons";
import styles from "./OperationsPage.module.scss";

// 1500 → "1 500", 12.5 → "12,5": группировка разрядов, без хвоста ".00".
const fmtPrice = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const ComplexityBadge = ({ value, t }) => {
  if (!value) return "—";
  const meta = COMPLEXITY_META[value];
  if (!meta) return value;
  return (
    <span
      className={styles.statusBadge}
      style={{ background: meta.color + "20", color: meta.color }}
    >
      {t(meta.labelKey)}
    </span>
  );
};

// Сложность в карточке: три полоски-уровня цвета сложности + подпись.
const ComplexityMeter = ({ value, t }) => {
  const meta = COMPLEXITY_META[value];
  if (!meta) return <span className={styles.cardMuted}>—</span>;
  return (
    <div className={styles.meter} style={{ "--meter-color": meta.color }}>
      <span className={styles.meterBars}>
        {[1, 2, 3].map((n) => (
          <i key={n} className={n <= meta.level ? styles.meterOn : ""} />
        ))}
      </span>
      <span className={styles.meterLabel}>{t(meta.labelKey)}</span>
    </div>
  );
};

const OperationsPage = () => {
  const { t } = useTranslation();
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const { showAlert } = useAlertStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Тип операции открывается отдельной страницей: ?type=new (создание) или
  // ?type=ID (редактирование). Путь не меняется, поэтому права меню (по pathname)
  // продолжают работать, а кнопка "назад" браузера возвращает к списку.
  const openType = searchParams.get("type");
  // Схема связей операций открывается так же: ?view=route.
  const isRouteView = searchParams.get("view") === "route";

  const [formData, setFormData] = useState({ search: "", status: "", unit: "", complexity: "" });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);

  const [deletingId, setDeletingId] = useState(null);
  const [viewType, setViewType] = useState("card"); // "card" | "list"

  const fetchData = useCallback(
    async (page = currentPage, filters = formData, size = pageSize) => {
      setLoading(true);
      try {
        const { data, pagination } = await getOperationTypes({
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

  useEffect(() => {
    fetchData(currentPage, formData, pageSize);
  }, [currentPage, pageSize]);

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSearch();
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage(1);
  };

  const openTypePage = (id) => {
    navigate({ search: `?type=${id}` }, { state: { fromList: true } });
  };

  const openRoutePage = () => {
    navigate({ search: "?view=route" }, { state: { fromList: true } });
  };

  const closeSubPage = () => {
    // Пришли из списка — откатываем историю, иначе (прямая ссылка) заменяем URL.
    if (location.state?.fromList) navigate(-1);
    else setSearchParams({}, { replace: true });
  };

  const handleDelete = async () => {
    try {
      await deleteOperationTypeById(deletingId);
      showAlert(t("success"), "success");
      setDeletingId(null);
      // последний элемент страницы удалён — уходим на предыдущую
      const page = data.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      if (page !== currentPage) setCurrentPage(page);
      else fetchData(page, formData, pageSize);
    } catch (err) {
      setDeletingId(null);
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    }
  };

  return (
    <div className={styles.page}>
      {openType ? (
        <div className={styles.main}>
          <AddOperationType
            key={openType}
            id={openType === "new" ? null : openType}
            onClose={closeSubPage}
            onSuccess={() => {
              closeSubPage();
              fetchData(currentPage, formData, pageSize);
            }}
          />
        </div>
      ) : isRouteView ? (
        <div className={styles.main}>
          <OperationRouteMap onClose={closeSubPage} />
        </div>
      ) : loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

              <OperationTypesFilter
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                t={t}
              />

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
              <button type="button" className={styles.routeBtn} title={t("operationRouteHint")} onClick={openRoutePage}>
                {Icons.route}
                <span>{t("operationRoute")}</span>
              </button>
              {canAdd && (
                <button className={buttonStyles.button} onClick={() => openTypePage("new")}>
                  {Icons.plus}
                  <span>{t("add")}</span>
                </button>
              )}
              <div
                className={styles.refreshBtn}
                onClick={() => fetchData(currentPage, formData, pageSize)}
              >
                {Icons.refresh}
              </div>
            </div>
          </div>

          {viewType === "card" ? (
            <div className={styles.cardGrid}>
              {data.length > 0 ? (
                data.map((type) => (
                  <div
                    key={type.id}
                    className={`${styles.card} ${canEdit ? styles.cardClickable : ""}`}
                    onClick={canEdit ? () => openTypePage(type.id) : undefined}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle} title={type.name}>{type.name}</span>
                      <Badge text={type.is_active} />
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.cardRow}>
                        <span className={styles.cardLabel}>{t("price")}</span>
                        <span className={styles.cardPrice}>{fmtPrice(type.price)}</span>
                      </div>
                      <div className={styles.cardRow}>
                        <span className={styles.cardLabel}>{t("complexity")}</span>
                        <ComplexityMeter value={type.complexity} t={t} />
                      </div>
                      <div className={`${styles.cardRow} ${styles.cardRowWide}`}>
                        <span className={styles.cardLabel}>{t("addedBy")}</span>
                        <span className={styles.cardValue} title={userDisplayName(type.addedBy)}>
                          {userDisplayName(type.addedBy) || "—"}
                        </span>
                      </div>
                    </div>

                    {canDelete && (
                      <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                        <ActionButton
                          onClick={() => setDeletingId(type.id)}
                          icon={Icons.delete}
                          label={t("deleteBtn")}
                          variant="delete"
                        />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className={styles.cardEmpty}>{t("noData")}</div>
              )}
            </div>
          ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th>{t("name")}</th>
                  <th>{t("sortOrder")}</th>
                  <th>{t("unit")}</th>
                  <th>{t("price")}</th>
                  <th>{t("complexity")}</th>
                  <th>{t("nextOperationType")}</th>
                  <th>{t("reworkOperationType")}</th>
                  <th>{t("incompleteOperationType")}</th>
                  <th>{t("employees")}</th>
                  <th>{t("addedBy")}</th>
                  <th>{t("status")}</th>
                  {canDelete && <th className={styles.actionsCell}></th>}
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  data.map((type, i) => (
                    <tr
                      key={type.id}
                      className={canEdit ? styles.rowClickable : ""}
                      onClick={canEdit ? () => openTypePage(type.id) : undefined}
                    >
                      <td>{(currentPage - 1) * pageSize + i + 1}</td>
                      <td>{type.name}</td>
                      <td>{type.sort_order}</td>
                      <td>{type.unit ? t(UNIT_LABEL_KEYS[type.unit]) : "—"}</td>
                      <td>{type.price ?? "—"}</td>
                      <td><ComplexityBadge value={type.complexity} t={t} /></td>
                      <td>
                        {type.is_final
                          ? t("isFinalOperation")
                          : type.nextOperations?.length > 0
                            ? type.nextOperations.map((rel) => rel.nextOperationType?.name).filter(Boolean).join(", ")
                            : "—"}
                      </td>
                      <td>
                        {type.reworkOperations?.length > 0
                          ? type.reworkOperations.map((rel) => rel.reworkOperationType?.name).filter(Boolean).join(", ")
                          : "—"}
                      </td>
                      <td>
                        {type.allow_incomplete && type.incompleteOperations?.length > 0
                          ? type.incompleteOperations
                              .map((rel) => rel.incompleteOperationType?.name)
                              .filter(Boolean)
                              .join(", ")
                          : "—"}
                      </td>
                      <td>{type.employees?.length > 0 ? type.employees.length : t("all")}</td>
                      <td>{userDisplayName(type.addedBy) || "—"}</td>
                      <td>
                        <Badge text={type.is_active} />
                      </td>
                      {canDelete && (
                        <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                          <ActionButton
                            onClick={() => setDeletingId(type.id)}
                            icon={Icons.delete}
                            label={t("deleteBtn")}
                            variant="delete"
                          />
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canDelete ? 13 : 12} className={styles.noData}>{t("noData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      <CenterModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onAccept={handleDelete}
        message={t("areYouSureDelete")}
      />
    </div>
  );
};

export default OperationsPage;
