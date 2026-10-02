import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getAttributes, deleteAttributeById } from "../api";
import { usePermissions } from "../hooks/usePermissions";

import Button from "../components/Button";
import Badge from "../components/Badge";
import AddAttribute from "../components/AddAttribute";
import AttributeEditor from "../components/AttributeEditor";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import SortArrow from "../components/SortArrow";
import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import TableFilter from "../components/TableFilter";
import Search from "../components/Search";
import { ActionButton } from "../components/ActionButtons";
import { Icons } from "../icons/icons";

import styles from "./StockPage.module.scss";

const AttributesPage = () => {
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
  const [valuesItem, setValuesItem] = useState(null);
  const [formData, setFormData] = useState({ search: "", status: "" });
  const [viewType, setViewType] = useState("card"); // "card" | "list"

  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);

  const handleDeleteClick = (id) => {
    setSelectedItem(id);
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    try {
      const res = await deleteAttributeById(itemId);
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
      const { data, pagination } = await getAttributes({ page, pageSize: size, filters });
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
              {canAdd && <Button text={t("add")} onClick={() => setModalType("add")} />}
              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>
            </div>
          </div>

          {viewType === "card" ? (
            <div className={styles.cardGrid}>
              {data?.length > 0 ? (
                getSortedData().map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.card} ${styles.cardClickable}`}
                    onClick={() => setValuesItem(item)}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle} title={item.name}>
                        {item.name}
                      </span>
                      <Badge text={item.status} />
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.cardRow}>
                        <span className={styles.cardLabel}>{t("attributeValues")}</span>
                        <span className={styles.cardValue}>{item.values_count}</span>
                      </div>
                    </div>

                    {canDelete && (
                      <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                        <ActionButton
                          onClick={() => handleDeleteClick(item.id)}
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
                  <th onClick={() => handleSort("name")}>
                    <span className={styles.headerContent}>
                      {t("attributeName")}
                      <SortArrow active={sortField === "name"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("values_count")}>
                    <span className={styles.headerContent}>
                      {t("attributeValues")}
                      <SortArrow active={sortField === "values_count"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("status")}>
                    <span className={styles.headerContent}>
                      {t("status")}
                      <SortArrow active={sortField === "status"} order={sortOrder} />
                    </span>
                  </th>
                  {canDelete && <th>{t("action")}</th>}
                </tr>
              </thead>
              <tbody>
                {data?.length > 0 ? (
                  getSortedData().map((item, i) => (
                    <tr
                      key={item.id}
                      className={styles.clickableRow}
                      onClick={() => setValuesItem(item)}
                    >
                      <td>{(currentPage - 1) * pageSize + i + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.values_count}</td>
                      <td>
                        <Badge text={item.status} />
                      </td>
                      {canDelete && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <ActionButton
                            onClick={() => handleDeleteClick(item.id)}
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
                    <td colSpan="5">{t("noData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      <CenterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAccept={() => handleDelete(selectedItem)}
        tag={t("areYouSureDelete")}
      />

      <OverlaySidebar isOpen={modalType === "add"} onClose={() => setModalType(null)} width="500px">
        <AddAttribute
          handleClose={() => setModalType(null)}
          onSuccess={() => {
            fetchData();
            setTimeout(handleCloseModal, 500);
          }}
        />
      </OverlaySidebar>

      <OverlaySidebar isOpen={!!valuesItem} onClose={() => setValuesItem(null)} width="500px">
        {valuesItem && (
          <AttributeEditor
            attributeId={valuesItem.id}
            canEdit={canEdit}
            onChanged={() => fetchData()}
          />
        )}
      </OverlaySidebar>
    </div>
  );
};

export default AttributesPage;
