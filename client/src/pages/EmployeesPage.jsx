import axios from "axios";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { useFilterDataStore } from "../stores/filterDataStore";
import { usePermissions } from "../hooks/usePermissions";
import { getEmployees } from "../api";

import Button from "../components/Button";
import Loading from "../components/Loading";
import AddEmployee from "../components/AddEmployee";
import EditEmployee from "../components/EditEmployee";
import EmployeesTable from "../components/EmployeesTable";
import EmploymentOrdersTimeline from "../components/EmploymentOrdersTimeline";
import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import Pagination from "../components/Pagination";
import EmployeeFilter from "../components/EmployeeFilter";
import DownloadButton from "../components/DownloadButton";
import AddEmploymentOrder from "../components/AddEmploymentOrder";

import styles from "./EmployeesPage.module.scss";

const EmployeesPage = () => {
  const { deleteUser } = useFilterDataStore();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [data, setData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const [employmentOrderType, setEmploymentOrderType] = useState("");
  const isLeftPanelOpen = Boolean(employmentOrderType);
  const [leftPanelType, setLeftPanelType] = useState("");
  const [updateEmployeeDataFunction, setUpdateEmployeeDataFunction] = useState(
    () => () => {},
  );
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);

  const [formData, setFormData] = useState({
    branch_id: "",
    department_id: "",
    employee_id: "",
    position_id: "",
    status: "",
  });

  const fetchEmployees = async (
    page = 1,
    customFormData = formData,
    customPageSize = pageSize,
  ) => {
    setLoading(true);
    try {
      const { data: employees, pagination } = await getEmployees({
        ...customFormData,
        page,
        pageSize: customPageSize,
      });
      setData(employees || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotalItems(pagination?.totalItems || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error("Ошибка загрузки данных:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(1, formData, pageSize);
  }, []);

  const handleSetUpdateFunction = (fn) => {
    setUpdateEmployeeDataFunction(() => fn);
  };

  const handleSearch = () => {
    fetchEmployees(1, { ...formData }, pageSize);
  };

  const handleEditClick = (id) => {
    setSelectedItem(id);
    setModalType("edit");
  };

  const handleDeleteClick = (id) => {
    setSelectedItem(id);
    setShowModal(true);
  };

  const handleLeftPanel = (nextEmploymentOrderType, nextLeftPanelType) => {
    const isSamePanel =
      employmentOrderType === nextEmploymentOrderType &&
      leftPanelType === nextLeftPanelType;

    if (isSamePanel) {
      setEmploymentOrderType(null);
      setLeftPanelType(null);
    } else {
      setEmploymentOrderType(nextEmploymentOrderType);
      setLeftPanelType(nextLeftPanelType);
    }
  };

  const closeLeftPanel = () => {
    setEmploymentOrderType(null);
    setLeftPanelType(null);
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`/api/employees/delete/${id}`);
      if (response.data.success) {
        setData((prevData) => prevData.filter((user) => user.user_id !== id));
        deleteUser(id);
        showAlert("Успешно", "error");
      }
    } catch (err) {
      showAlert(`${err.response.data.message}`, "error");
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchEmployees(1, formData);
  };

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    await fetchEmployees(newPage);
  };

  const handleChangePageSize = async (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    await fetchEmployees(1, formData, size);
  };

  return (
    <div className={styles.employeesPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <div className={styles.searchInput}>
                <svg
                  onClick={handleSearch}
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

              <EmployeeFilter
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

              <div
                className={styles.refreshBtn}
                onClick={() => fetchEmployees(currentPage, formData, pageSize)}
              >
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
                  onClick={() => exportEmployeesToExcel(data)}
                />
              )}
            </div>
          </div>

          <EmployeesTable
            data={data}
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
            totalPages={totalPages}
            canEdit={canEdit}
            canDelete={canDelete}
            handleEditClick={handleEditClick}
            handleDeleteClick={handleDeleteClick}
            handleChangePageSize={handleChangePageSize}
            handlePageChange={handlePageChange}
          />
        </div>
      )}

      <CenterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAccept={() => handleDelete(selectedItem)}
        title="Вы уверены, что хотите удалить?"
      />

      {modalType === "add" ? (
        <OverlaySidebar
          isOpen={modalType !== null}
          onClose={() => setModalType(null)}
          width="550px"
          side="right"
          children={
            <AddEmployee
              handleClose={() => setModalType(null)}
              onSuccess={() => {
                fetchEmployees();
              }}
            />
          }
        />
      ) : (
        <OverlaySidebar
          isOpen={modalType !== null}
          onClose={() => {
            setModalType(null);
            closeLeftPanel(false);
          }}
          width="550px"
          side="right"
          children={
            <EditEmployee
              id={selectedItem}
              handleClose={() => setModalType(null)}
              handleLeftPanel={handleLeftPanel}
              isLeftPanelOpen={isLeftPanelOpen}
              closeLeftPanel={closeLeftPanel}
              setLeftPanelType={setLeftPanelType}
              handleSetUpdateFunction={handleSetUpdateFunction}
              onSuccess={() => {
                fetchEmployees();
              }}
            />
          }
          leftPanel={{
            isOpen: isLeftPanelOpen,
            width: "500px",
            children:
              leftPanelType === "add" ? (
                <AddEmploymentOrder
                  employeeId={selectedItem}
                  employmentOrderType={employmentOrderType}
                  handleClose={closeLeftPanel}
                  updateEmployeeDataFunction={updateEmployeeDataFunction}
                />
              ) : (
                <EmploymentOrdersTimeline
                  employeeId={selectedItem}
                  handleClose={closeLeftPanel}
                  updateEmployeeDataFunction={updateEmployeeDataFunction}
                />
              ),
          }}
        />
      )}
    </div>
  );
};

export default EmployeesPage;
