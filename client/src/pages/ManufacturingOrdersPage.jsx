import axios from "axios";
import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";

import { getManufacturingOrders } from "../api";

import AddManufacturingOrder from "../components/AddManufacturingOrder";
// import EditManufacturingOrder from "../components/EditManufacturingOrder";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Pagination from "../components/Pagination";
import Loading from "../components/Loading";
import Modal from "../components/Modal";
import SortArrow from "../components/SortArrow";
import NoData from "../components/NoData";

import styles from "./ManufacturingOrdersPage.module.scss";

const ManufacturingOrdersPage = () => {
  const { hasPermission } = usePermissions();
  const currentPath = window.location.pathname;

  const [data, setData] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { showAlert } = useAlertStore();
  const [sortField, setSortField] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");
  const language = useAuthStore((state) => state.language);
  const { i18n, t } = useTranslation();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState();

  useEffect(() => {
    if (language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const handleEditButton = (id) => {
    setSelectedId(id);
    setIsEditOpen(true);
  };

  const handleDeleteClick = (orderId) => {
    setSelectedOrder(orderId);
    setShowModal(true);
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      const deleteRes = await axios.delete(
        `/api/manufacturing-orders/${orderId}`
      );
      if (deleteRes.data.success) {
        setData((prev) => prev.filter((order) => order.id !== orderId));
        setTotalItems((prev) => prev - 1);
        setTotalPages(Math.ceil((totalItems - 1) / pageSize));
        if (currentPage > totalPages) {
          setCurrentPage(totalPages);
        }
        showAlert("Успешно удалено", "success");
      } else {
        console.error("Ошибка при удалении заказа:", deleteRes.data.message);
      }
    } catch (error) {
      console.error("Ошибка при удалении заказа:", error.message);
      showAlert("Ошибка", "error");
    }
  };

  // Получение данных
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, pagination } = await getManufacturingOrders({
        page: currentPage,
        pageSize,
      });

      setData(data || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotalItems(pagination?.totalItems || 0);
    } catch (error) {
      console.error("Ошибка при получении заказов:", error.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage((prevPage) =>
      Math.min(prevPage, Math.ceil(totalItems / size))
    );
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      const isNumberA = !isNaN(aNum);
      const isNumberB = !isNaN(bNum);

      if (isNumberA && isNumberB) {
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

  if (loading) return <Loading />;

  return (
    <>
      <div className={styles.order}>
        <h1 className={styles.title}> {t("menu.manufacturingOrders")}</h1>
        <section className={styles.controls}>
          <div className={styles.controls_btn}>
            {hasPermission(currentPath, "create") && (
              <Button
                text={t("button.add")}
                onClick={() => setIsAddOpen(true)}
              />
            )}
          </div>
        </section>

        {data && data.length > 0 ? (
          <>
            <table className={styles.employee_table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th onClick={() => handleSort("id")}>
                    <span className={styles.headerContent}>
                      ID
                      <SortArrow
                        active={sortField === "id"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("product_name")}>
                    <span className={styles.headerContent}>
                      {t("manufacturingPage.table.product")}
                      <SortArrow
                        active={sortField === "product_name"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("quantity")}>
                    <span className={styles.headerContent}>
                      {t("manufacturingPage.table.quantity")}
                      <SortArrow
                        active={sortField === "quantity"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("status")}>
                    <span className={styles.headerContent}>
                      {t("manufacturingPage.table.status")}
                      <SortArrow
                        active={sortField === "status"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  {(hasPermission(currentPath, "edit") ||
                    hasPermission(currentPath, "delete")) && (
                    <th>{t("manufacturingPage.table.action")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {getSortedData().map((order, index) => (
                  <tr key={order.id}>
                    <td>{(currentPage - 1) * pageSize + index + 1}</td>
                    <td>{order.id}</td>
                    <td>{order.product_name}</td>
                    <td>{order.quantity}</td>
                    <td>
                      <Badge text={order.status} />
                    </td>
                    {(hasPermission(currentPath, "edit") ||
                      hasPermission(currentPath, "delete")) && (
                      <td className={styles.table_body_action}>
                        {hasPermission(currentPath, "edit") && (
                          <svg
                            onClick={() => handleEditButton(order.id)}
                            title="Редактировать заказ"
                            fill="none"
                            height="24"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            width="24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        )}
                        {hasPermission(currentPath, "delete") && (
                          <svg
                            onClick={() => handleDeleteClick(order.id)}
                            fill="none"
                            height="24"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            width="24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        )}
                        {showModal && (
                          <Modal
                            onClose={() => setShowModal(false)}
                            onAccept={handleDeleteOrder}
                            userID={selectedOrder}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              handleChangePageSize={handleChangePageSize}
              handlePageChange={handlePageChange}
            />
          </>
        ) : (
          <NoData title={t("noData.text")} />
        )}
      </div>

      {/* Модалки */}
      <AnimatePresence>
        {isAddOpen && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <AddManufacturingOrder cancelButton={() => setIsAddOpen(false)} />
          </motion.div>
        )}
        {isEditOpen && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <EditManufacturingOrder
              id={selectedId}
              cancelButton={() => setIsEditOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ManufacturingOrdersPage;
