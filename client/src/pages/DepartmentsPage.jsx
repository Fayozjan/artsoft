import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";
import { deleteDepartmentById, getDepartments } from "../api";

import AddDepartment from "../components/AddDepartment";
import EditDepartment from "../components/EditDepartment";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Pagination from "../components/Pagination";
import SortArrow from "../components/SortArrow";
import CenterModal from "../components/CenterModal";
import OverlaySidebar from "../components/OverlaySidebar";
import TableIcons from "../icons/tableIcons";

import styles from "./DepartmentsPage.module.scss";
import Loading from "../components/Loading";
import { Building, Users, CheckCircle } from "lucide-react";

const StatWidget = ({ icon: Icon, color, label, value, sub, progress }) => (
  <div className={styles.statWidget}>
    <div className={styles.statWidgetInner}>
      <div className={styles.statWidgetIcon} style={{ background: color + "18" }}>
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div className={styles.statWidgetContent}>
        <span className={styles.statWidgetLabel}>{label}</span>
        <span className={styles.statWidgetValue} style={{ color }}>
          {value}
          {sub && <span className={styles.statWidgetSub}> {sub}</span>}
        </span>
      </div>
    </div>
    {progress != null && (
      <div className={styles.statWidgetProgressTrack}>
        <div
          className={styles.statWidgetProgressFill}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: color }}
        />
      </div>
    )}
  </div>
);
import DownloadButton from "../components/DownloadButton";
import DepartmentFilter from "../components/DepartmentFilter";
import { ActionCell } from "../components/ActionButtons";

const DepartmentPage = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const { showAlert } = useAlertStore();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [sortField, setSortField] = useState("branch");
  const [sortOrder, setSortOrder] = useState("asc");
  const { t } = useTranslation();

  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);

  const [formData, setFormData] = useState({
    branch_id: "",
    status: "",
  });

  const handleEditClick = (id) => {
    setSelectedItem(id);
    setModalType("edit");
  };

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedItem(null);
  };

  const handleDeleteClick = (id) => {
    setSelectedItem(id);
    setShowModal(true);
  };

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const { data, pagination } = await getDepartments({
        page,
        pageSize: size,
        filters,
      });
      setData(data);
      setTotalPages(pagination.totalPages);
      setCurrentPage(pagination.currentPage);
      setTotalItems(pagination.totalItems);
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
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage((prevPage) =>
      Math.min(prevPage, Math.ceil(totalItems / size)),
    );
  };

  const handleDelete = async (id) => {
    try {
      await deleteDepartmentById(id);
      setData((prevData) => prevData.filter((item) => item.id !== id));
      showAlert("Успешно", "success");
      setShowModal(false);
    } catch (err) {
      if (err.response && err.response.status === 400) {
        showAlert("Невозможно удалить отдел с сотрудниками!", "error");
      } else {
        showAlert("Ошибка!", "error");
      }
    }
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Пустые значения идут в конец
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Преобразование к числу, если возможно
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      const isNumberA = !isNaN(aNum);
      const isNumberB = !isNaN(bNum);

      if (isNumberA && isNumberB) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Сравнение как строки
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

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, formData, pageSize);
  };

  return (
    <div className={styles.departmentsPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          {data.length > 0 && (
            <div className={styles.statsGrid}>
              <StatWidget
                icon={Building}
                color="#6366f1"
                label="Всего отделов"
                value={totalItems}
              />
              <StatWidget
                icon={Users}
                color="#10b981"
                label="Сотрудников"
                value={data.reduce((a, b) => a + (b.employees_count || 0), 0)}
              />
              <StatWidget
                icon={CheckCircle}
                color="#3b82f6"
                label="Активных"
                value={data.filter((x) => x.status === "active").length}
                sub={`/ ${data.length}`}
              />
            </div>
          )}
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <div className={styles.searchInput}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="19"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#000000"
                    d="M15.096 5.904a6.5 6.5 0 1 0-9.192 9.192a6.5 6.5 0 0 0 9.192-9.192ZM4.49 4.49a8.5 8.5 0 0 1 12.686 11.272l5.345 5.345l-1.414 1.414l-5.345-5.345A8.501 8.501 0 0 1 4.49 4.49Z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder={t("search")}
                  value={formData.search || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />

                {formData.search && (
                  <svg
                    className={styles.clearBtn}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        search: "",
                      }));
                    }}
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="18"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="none"
                      stroke="#000000"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </div>

              <DepartmentFilter
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                t={t}
              />
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
                <Button text={t("add")} onClick={() => setModalType("add")} />
              )}

              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="200"
                  height="200"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="none"
                    stroke="#000000"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"
                  />
                </svg>

                <span>Обновить данные</span>
              </div>

              {data.length > 0 && (
                <DownloadButton
                  text={t("save")}
                  // onClick={() => exportEmployeesToExcel(data)}
                />
              )}
            </div>
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th onClick={() => handleSort("branch")}>
                    <span className={styles.headerContent}>
                      {t("branch")}
                      <SortArrow
                        active={sortField === "branch"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th
                    className={styles.table_name_header}
                    onClick={() => handleSort("name")}
                  >
                    <span className={styles.headerContent}>
                      {t("name")}
                      <SortArrow
                        active={sortField === "name"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("id")}>
                    <span className={styles.headerContent}>
                      ID
                      <SortArrow
                        active={sortField === "id"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("employee_count")}>
                    <span className={styles.headerContent}>
                      {t("employees")}
                      <SortArrow
                        active={sortField === "employee_count"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("status")}>
                    <span className={styles.headerContent}>
                      {t("status")}
                      <SortArrow
                        active={sortField === "status"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  {(canEdit || canDelete) && <th> {t("action")}</th>}
                </tr>
              </thead>
              <tbody>
                {data?.length > 0 ? (
                  getSortedData().map((item, i) => (
                    <tr key={item.id}>
                      <td>{(currentPage - 1) * pageSize + i + 1}</td>
                      <td>{item.branch.name}</td>
                      <td>{item.name}</td>
                      <td>{item.id}</td>
                      <td>{item.employees_count}</td>
                      <td>
                        <Badge text={item.status} />
                      </td>
                      {
                        <ActionCell
                          item={item}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          onEdit={handleEditClick}
                          onDelete={handleDeleteClick}
                        />
                      }
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11">Нет данных</td>
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
        title="Вы уверены, что хотите удалить?"
      />

      <OverlaySidebar
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={modalType === "add" ? t("addDepartment") : t("editDepartment")}
        width="500px"
      >
        {modalType === "add" && (
          <AddDepartment
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              fetchData();
              setTimeout(handleCloseModal, 500);
            }}
          />
        )}
        {modalType === "edit" && (
          <EditDepartment
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

export default DepartmentPage;
