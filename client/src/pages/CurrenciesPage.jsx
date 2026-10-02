import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAlertStore } from "../stores/alertStore";
import { getCurrencies, deleteCurrencyById } from "../api";
import { usePermissions } from "../hooks/usePermissions";

import Button from "../components/Button";
import Badge from "../components/Badge";
import AddCurrency from "../components/AddCurrency";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import SortArrow from "../components/SortArrow";
import CenterModal from "../components/CenterModal";
import Search from "../components/Search";
import { ActionCell } from "../components/ActionButtons";
import { Icons } from "../icons/icons";

import styles from "./StockPage.module.scss";

const CurrenciesPage = () => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState("code");
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

  const openId = searchParams.get("currency");

  const openCurrencyPage = (id) => {
    navigate({ search: `?currency=${id}` }, { state: { fromList: true } });
  };

  const openNewCurrency = () => {
    navigate({ search: "?currency=new" }, { state: { fromList: true } });
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
      const res = await deleteCurrencyById(itemId);
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
      const { data, pagination } = await getCurrencies({ page, pageSize: size, filters });
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
      {openId ? (
        <div className={styles.main}>
          <AddCurrency
            key={openId}
            id={openId === "new" ? null : openId}
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
              {canAdd && <Button text={t("add")} onClick={openNewCurrency} />}
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
                  <th onClick={() => handleSort("code")}>
                    <span className={styles.headerContent}>
                      {t("currencyCode")}
                      <SortArrow active={sortField === "code"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("name")}>
                    <span className={styles.headerContent}>
                      {t("currencyName")}
                      <SortArrow active={sortField === "name"} order={sortOrder} />
                    </span>
                  </th>
                  <th>{t("currencySymbol")}</th>
                  <th>{t("currencyIsBase")}</th>
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
                      <td>{item.code}</td>
                      <td>{item.name}</td>
                      <td>{item.symbol || "—"}</td>
                      <td>{item.is_base ? t("yes") : t("no")}</td>
                      <td>
                        <Badge text={item.status} />
                      </td>
                      <ActionCell
                        item={item}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={openCurrencyPage}
                        onDelete={handleDeleteClick}
                      />
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7">{t("noData")}</td>
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

export default CurrenciesPage;
