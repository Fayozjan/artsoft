import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAlertStore } from "../stores/alertStore";
import { getStockPickingTypes, deleteStockPickingTypeById } from "../api";
import { usePermissions } from "../hooks/usePermissions";

import Button from "../components/Button";
import Badge from "../components/Badge";
import AddStockPickingType from "../components/AddStockPickingType";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import SortArrow from "../components/SortArrow";
import CenterModal from "../components/CenterModal";
import Search from "../components/Search";
import { ActionCell } from "../components/ActionButtons";
import { Icons } from "../icons/icons";

import styles from "./StockPage.module.scss";

// Тип документа открывается отдельной страницей на всю ширину: ?type=new
// (создание) или ?type=ID (правка) — тот же паттерн, что "Производство /
// Типы операций" (см. OperationsPage + AddOperationType).
const StockPickingTypesPage = () => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ search: "" });

  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const openType = searchParams.get("type");

  const openTypePage = (id) => {
    navigate({ search: `?type=${id}` }, { state: { fromList: true } });
  };

  const openNewType = () => {
    navigate({ search: "?type=new" }, { state: { fromList: true } });
  };

  const closeSubPage = () => {
    if (location.state?.fromList) navigate(-1);
    else setSearchParams({}, { replace: true });
  };

  const handleDeleteClick = (id) => {
    setSelectedItem(id);
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    try {
      const res = await deleteStockPickingTypeById(itemId);
      if (res.success) {
        showAlert(t("success"), "success");
        setShowModal(false);
        fetchData();
      } else {
        showAlert(t("error"), "error");
      }
    } catch (err) {
      showAlert(err.response?.data?.error || t("error"), "error");
    }
  };

  const fetchData = async (page = currentPage, filters = formData, size = pageSize) => {
    setLoading(true);
    try {
      const { data, pagination } = await getStockPickingTypes({
        page,
        pageSize: size,
        filters,
      });
      setData(data);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage((prev) => Math.min(prev, Math.ceil(totalItems / size)));
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  return (
    <div className={styles.page}>
      {openType ? (
        <div className={styles.main}>
          <AddStockPickingType
            key={openType}
            id={openType === "new" ? null : openType}
            onClose={closeSubPage}
            onSuccess={() => {
              closeSubPage();
              fetchData(currentPage, formData, pageSize);
            }}
          />
        </div>
      ) : loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />
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
              {canAdd && <Button text={t("add")} onClick={openNewType} />}
              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th onClick={() => handleSort("name")}>
                    <span className={styles.headerContent}>
                      {t("name")}
                      <SortArrow active={sortField === "name"} order={sortOrder} />
                    </span>
                  </th>
                  <th>{t("pickingTypeCode")}</th>
                  <th>{t("pickingTypePrefix")}</th>
                  <th>{t("pickingTypeDefaultSrc")}</th>
                  <th>{t("pickingTypeDefaultDest")}</th>
                  <th onClick={() => handleSort("status")}>
                    <span className={styles.headerContent}>
                      {t("status")}
                      <SortArrow active={sortField === "status"} order={sortOrder} />
                    </span>
                  </th>
                  {(canEdit || canDelete) && <th>{t("action")}</th>}
                </tr>
              </thead>
              <tbody>
                {data?.length > 0 ? (
                  getSortedData().map((item, i) => (
                    <tr key={item.id}>
                      <td>{(currentPage - 1) * pageSize + i + 1}</td>
                      <td>{item.name}</td>
                      <td>{t(`pickingTypeCode_${item.code}`)}</td>
                      <td>{item.sequence_prefix}</td>
                      <td>{item.defaultLocationSrc?.complete_name || item.defaultLocationSrc?.name || "—"}</td>
                      <td>{item.defaultLocationDest?.complete_name || item.defaultLocationDest?.name || "—"}</td>
                      <td>
                        <Badge text={item.status} />
                      </td>
                      <ActionCell
                        item={item}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={openTypePage}
                        onDelete={handleDeleteClick}
                      />
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8">{t("noData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CenterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAccept={() => handleDelete(selectedItem)}
        title={t("areYouSureDelete")}
      />
    </div>
  );
};

export default StockPickingTypesPage;
