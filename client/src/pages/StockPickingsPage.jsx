import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";
import { getStockPickings, deleteStockPickingById } from "../api";

import AddStockPicking from "../components/AddStockPicking";
import StockPickingDetail from "../components/StockPickingDetail";
import StockPickingTypeModal from "../components/StockPickingTypeModal";
import Button from "../components/Button";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import CenterModal from "../components/CenterModal";
import Search from "../components/Search";
import { Icons } from "../icons/icons";

import styles from "./StockPage.module.scss";

const STATE_META = {
  draft: { color: "#f59e0b", labelKey: "pickingStateDraft" },
  confirmed: { color: "#1455fe", labelKey: "pickingStateConfirmed" },
  done: { color: "#16a34a", labelKey: "pickingStateDone" },
};

const StateBadge = ({ state, t }) => {
  const meta = STATE_META[state] || STATE_META.draft;
  return (
    <span
      style={{
        background: meta.color + "20",
        color: meta.color,
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "var(--font-small)",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {t(meta.labelKey)}
    </span>
  );
};

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
const fmtNum = (value) => (value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("ru-RU"));

// Для колонок списка — без фото/должностей, ФИО сверху, время мелким шрифтом
// снизу (иначе 4 колонки персон с аватарками не влезают по ширине).
const personName = (user) => {
  if (!user) return null;
  if (user.employee) return [user.employee.last_name, user.employee.first_name].filter(Boolean).join(" ");
  return user.username || null;
};

// Откуда/Куда: партнёр (поставщик/клиент) или локация — если у локации есть
// филиал, показываем его мелким текстом снизу (как дату у ФИО).
const LocationCell = ({ partner, location }) => {
  if (partner) return `${partner.name} (${partner.id})`;
  if (!location) return "—";
  if (!location.branch?.name) return location.name;
  return (
    <div>
      <div>{location.name}</div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{location.branch.name}</div>
    </div>
  );
};

const PersonTimeCell = ({ user, date }) => {
  const name = personName(user);
  if (!name) return "—";
  return (
    <div>
      <div>
        {name}
        {user.employee_id != null && <span style={{ color: "var(--placeholder-color)" }}> ({user.employee_id})</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{fmtDate(date)}</div>
    </div>
  );
};

// Добавление/редактирование документа — не модалка, а отдельный "экран" внутри
// того же роута: ?picking=new (создание) или ?picking=ID&edit=1 (правка), по
// аналогии с тем, как тут же (?picking=ID без edit) открыт просмотр документа.
const StockPickingsPage = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const openId = searchParams.get("picking");
  const isNew = openId === "new";
  const isEditForm = Boolean(openId) && !isNew && searchParams.get("edit") === "1";
  const isFormMode = isNew || isEditForm;
  const isDetailMode = Boolean(openId) && !isFormMode;

  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ search: "", state: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [typeModalOpen, setTypeModalOpen] = useState(false);

  const fetchData = useCallback(
    async (page = currentPage, filters = formData, size = pageSize) => {
      setLoading(true);
      try {
        const { data, pagination } = await getStockPickings({ page, pageSize: size, filters });
        setData(data || []);
        setTotalPages(pagination?.totalPages || 1);
        setCurrentPage(pagination?.currentPage || 1);
        setTotalItems(pagination?.totalItems || 0);
      } catch (error) {
        console.error("Ошибка при получении документов:", error.message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchData(currentPage, formData, pageSize);
  }, [currentPage, pageSize]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  const openPicking = (pickingId) => {
    navigate({ search: `?picking=${pickingId}` }, { state: { fromList: true } });
  };

  // "Добавить" сперва открывает модалку выбора типа (см. StockPickingTypeModal) —
  // на страницу документа попадаем уже с готовым типом в URL, поле выбора типа
  // там не дублируется (см. AddStockPicking: typeId + presetType).
  const openNewPicking = () => setTypeModalOpen(true);

  const handleTypeSelected = (type) => {
    setTypeModalOpen(false);
    navigate({ search: `?picking=new&type=${type.id}` }, { state: { fromList: true } });
  };

  const openEditPicking = (pickingId) => {
    navigate({ search: `?picking=${pickingId}&edit=1` });
  };

  const closePicking = () => {
    if (location.state?.fromList) navigate(-1);
    else setSearchParams({}, { replace: true });
  };

  // Форму (создание/правку) всегда открываем поверх списка или карточки документа
  // через navigate (push) — "назад" просто возвращает на предыдущий экран истории.
  const handleFormBack = () => navigate(-1);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { success } = await deleteStockPickingById(deleteTarget);
      if (!success) return showAlert(t("error"), "error");
      showAlert(t("success"), "success");
      if (openId) closePicking();
      fetchData(currentPage, formData, pageSize);
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className={styles.page}>
      {isFormMode ? (
        <div className={styles.main}>
          <AddStockPicking
            id={isEditForm ? openId : undefined}
            typeId={isNew ? searchParams.get("type") : undefined}
            handleClose={handleFormBack}
            onSuccess={(newId) => {
              const targetId = isEditForm ? openId : newId;
              if (targetId) setSearchParams({ picking: String(targetId) }, { replace: true });
              else closePicking();
              if (isEditForm) setDetailVersion((v) => v + 1);
              fetchData(isEditForm ? currentPage : 1, formData, pageSize);
            }}
          />
        </div>
      ) : isDetailMode ? (
        <div className={styles.main}>
          <StockPickingDetail
            key={`${openId}-${detailVersion}`}
            id={openId}
            canEdit={canEdit}
            canDelete={canDelete}
            onClose={closePicking}
            onEdit={() => openEditPicking(openId)}
            onDeleteRequest={(id) => setDeleteTarget(id)}
            onRefresh={() => fetchData(currentPage, formData, pageSize)}
          />
        </div>
      ) : loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />
              <select
                value={formData.state}
                onChange={(e) => {
                  const next = { ...formData, state: e.target.value };
                  setFormData(next);
                  handleSearch(next);
                }}
              >
                <option value="">{t("filterAll")}</option>
                <option value="draft">{t("pickingStateDraft")}</option>
                <option value="confirmed">{t("pickingStateConfirmed")}</option>
                <option value="done">{t("pickingStateDone")}</option>
              </select>
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
              {canAdd && <Button text={t("add")} onClick={openNewPicking} />}
              <div className={styles.refreshBtn} onClick={() => fetchData(currentPage, formData, pageSize)}>
                {Icons.refresh}
              </div>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th>{t("date")}</th>
                  <th>{t("documentNumber")}</th>
                  <th>{t("pickingType")}</th>
                  <th>{t("pickingFrom")}</th>
                  <th>{t("pickingTo")}</th>
                  <th>{t("pickingTotalQty")}</th>
                  <th>{t("pickingTotalPackages")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("status")}</th>
                  <th>{t("addedBy")}</th>
                  <th>{t("pickingEditedBy")}</th>
                  <th>{t("pickingConfirmedBy")}</th>
                  <th>{t("pickingDoneBy")}</th>
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  data.map((row, i) => (
                    <tr key={row.id} className={styles.clickableRow} onClick={() => openPicking(row.id)}>
                      <td>{(currentPage - 1) * pageSize + i + 1}</td>
                      <td>{fmtDate(row.created_at)}</td>
                      <td>{row.name}</td>
                      <td>{row.type?.name || "—"}</td>
                      <td><LocationCell partner={row.srcPartner} location={row.locationSrc} /></td>
                      <td><LocationCell partner={row.destPartner} location={row.locationDest} /></td>
                      <td>{fmtNum(row.total_qty)}</td>
                      <td>{fmtNum(row.total_packages)}</td>
                      <td>{fmtNum(row.amount)}{row.currency?.code ? ` ${row.currency.code}` : ""}</td>
                      <td>
                        <StateBadge state={row.state} t={t} />
                      </td>
                      <td><PersonTimeCell user={row.addedBy} date={row.created_at} /></td>
                      <td><PersonTimeCell user={row.editedBy} date={row.edited_at} /></td>
                      <td><PersonTimeCell user={row.confirmedBy} date={row.confirmed_at} /></td>
                      <td><PersonTimeCell user={row.doneBy} date={row.date_done} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="14">{t("noData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CenterModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onAccept={handleDelete}
        title={t("areYouSureDelete")}
      />

      <StockPickingTypeModal
        isOpen={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        onSelect={handleTypeSelected}
      />
    </div>
  );
};

export default StockPickingsPage;
