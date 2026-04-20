import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";
import { salaryHistoryApi } from "../api/salaryHistory";

import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import SalaryFilter from "../components/SalaryFilter";
import SalarySort from "../components/SalarySort";
import SalaryTable from "../components/SalaryTable";
import OverlaySidebar from "../components/OverlaySidebar";
import EmployeeSalaryHistory from "../components/EmployeeSalaryHistory";

import styles from "./SalarySettingPage.module.scss";
import { Icons } from "../icons/icons";

const initialFilters = {
  search: "",
  branch_id: "",
  department_id: "",
  position_id: "",
  status: "true",
  salary_type: "",
  amount_from: "",
  amount_to: "",
  no_salary: "",
  sort_by: "last_name",
  sort_order: "asc",
};

const SalarySettingPage = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const [formData, setFormData] = useState(initialFilters);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [autoOpenAdd, setAutoOpenAdd] = useState(false);

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize: size,
        ...filters,
        no_salary: filters.no_salary,
      };

      const res = await salaryHistoryApi.getEmployeesWithSalary(params);

      if (res.success) {
        setData(res.data || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalItems(res.pagination?.total || 0);
        setCurrentPage(page);
      }
    } catch (err) {
      console.error("Ошибка загрузки:", err);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, formData, pageSize);
  }, []);

  const handleSearch = () => {
    fetchData(1, formData, pageSize);
  };

  const handleFormSubmit = (e) => {
    e?.preventDefault();
    fetchData(1, formData, pageSize);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchData(newPage, formData, pageSize);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    fetchData(1, formData, size);
  };

  const handleOpenHistory = (employeeId) => {
    setAutoOpenAdd(false);
    setSelectedEmployeeId(employeeId);
    setHistoryOpen(true);
  };

  const handleOpenAdd = (employeeId) => {
    setAutoOpenAdd(true);
    setSelectedEmployeeId(employeeId);
    setHistoryOpen(true);
  };

  const handleSortApply = (sort_by, sort_order) => {
    const updated = { ...formData, sort_by, sort_order };
    setFormData(updated);
    fetchData(1, updated, pageSize);
  };

  const handleCloseHistory = () => {
    setHistoryOpen(false);
    setSelectedEmployeeId(null);
    setAutoOpenAdd(false);
    fetchData(currentPage, formData, pageSize);
  };

  return (
    <div className={styles.page}>
      {loading && <Loading />}

      <div className={styles.main}>
        {/* ── Header ── */}
        <div className={styles.mainHeader}>
          <div className={styles.filterWrapper}>
            {/* Search */}
            <div className={styles.searchInput}>
              <span onClick={handleSearch}>{Icons.search}</span>
              <input
                type="text"
                placeholder={t("search")}
                value={formData.search}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, search: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
              {formData.search && (
                <span
                  className={styles.clearBtn}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, search: "" }))
                  }
                >
                  {Icons.clear}
                </span>
              )}
            </div>

            {/* Filter */}
            <SalaryFilter
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleFormSubmit}
            />

            {/* Sort */}
            <SalarySort
              sort_by={formData.sort_by}
              sort_order={formData.sort_order}
              onApply={handleSortApply}
            />
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
            totalPages={totalPages}
            handleChangePageSize={handleChangePageSize}
            handlePageChange={handlePageChange}
          />

          {/* Buttons */}
          <div className={styles.buttonsWrapper}>
            <div
              className={styles.refreshBtn}
              onClick={() => fetchData(currentPage, formData, pageSize)}
            >
              {Icons.refresh}
              <span>{t("refreshData")}</span>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <SalaryTable
          data={data}
          currentPage={currentPage}
          pageSize={pageSize}
          canEdit={canEdit}
          canDelete={canDelete}
          onOpenHistory={handleOpenHistory}
          onOpenAdd={handleOpenAdd}
        />
      </div>

      {/* ── Salary History Sidebar ── */}
      {historyOpen && (
        <OverlaySidebar
          isOpen={historyOpen}
          onClose={handleCloseHistory}
          width="520px"
          side="right"
          children={
            <EmployeeSalaryHistory
              employeeId={selectedEmployeeId}
              handleClose={handleCloseHistory}
              initialOpenAdd={autoOpenAdd}
              showClose={false}
            />
          }
        />
      )}
    </div>
  );
};

export default SalarySettingPage;
