import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getPartnerCategories, deletePartnerCategoryById } from "../api";
import { usePermissions } from "../hooks/usePermissions";

import Button from "../components/Button";
import Badge from "../components/Badge";
import AddPartnerCategory from "../components/AddPartnerCategory";
import EditPartnerCategory from "../components/EditPartnerCategory";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import SortArrow from "../components/SortArrow";
import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import TableFilter from "../components/TableFilter";
import Search from "../components/Search";
import { ActionCell } from "../components/ActionButtons";
import { Icons } from "../icons/icons";

import styles from "./StockPage.module.scss";

const PartnerCategoriesPage = () => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ search: "", status: "" });

  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);

  const handleEditClick = (id) => {
    setSelectedItem(id);
    setModalType("edit");
  };

  const handleDeleteClick = (id) => {
    setSelectedItem(id);
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    try {
      const res = await deletePartnerCategoryById(itemId);
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

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedItem(null);
  };

  const fetchData = async (page = currentPage, filters = formData, size = pageSize) => {
    setLoading(true);
    try {
      const { data, pagination } = await getPartnerCategories({ page, pageSize: size, filters });
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
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }
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

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData(1, formData);
  };

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  return (
    <div className={styles.page}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />
              <TableFilter formData={formData} setFormData={setFormData} onSubmit={handleFormSubmit} t={t} />
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
              {canAdd && <Button text={t("add")} onClick={() => setModalType("add")} />}
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
                  <th onClick={() => handleSort("partners_count")}>
                    <span className={styles.headerContent}>
                      {t("partners")}
                      <SortArrow active={sortField === "partners_count"} order={sortOrder} />
                    </span>
                  </th>
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
                      <td>{item.partners_count}</td>
                      <td>
                        <Badge text={item.status} />
                      </td>
                      <ActionCell
                        item={item}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                      />
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">{t("noData")}</td>
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

      <OverlaySidebar
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={modalType === "add" ? t("addPartnerCategory") : t("editPartnerCategory")}
        width="500px"
      >
        {modalType === "add" && (
          <AddPartnerCategory
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              fetchData();
              setTimeout(handleCloseModal, 500);
            }}
          />
        )}
        {modalType === "edit" && (
          <EditPartnerCategory
            id={selectedItem}
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              fetchData();
              setTimeout(handleCloseModal, 500);
            }}
          />
        )}
      </OverlaySidebar>
    </div>
  );
};

export default PartnerCategoriesPage;
