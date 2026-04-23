import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Users, UserCheck, UserX, Wallet, TrendingUp } from "lucide-react";

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

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

const StatWidget = ({ icon: Icon, color, label, value, sub, progress }) => (
  <div className={styles.statWidget}>
    <div className={styles.statWidgetInner}>
      <div
        className={styles.statWidgetIcon}
        style={{ background: color + "18" }}
      >
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div className={styles.statWidgetContent}>
        <span className={styles.statWidgetLabel}>{label}</span>
        <span className={styles.statWidgetValue} style={{ color }}>
          {value} {sub && <span className={styles.statWidgetSub}>{sub}</span>}
        </span>
      </div>
    </div>
    {progress != null && (
      <div className={styles.statWidgetProgressTrack}>
        <div
          className={styles.statWidgetProgressFill}
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: color,
          }}
        />
      </div>
    )}
  </div>
);

const TYPE_COLORS = {
  monthly: "#3b82f6",
  hourly: "#16a34a",
  piecework: "#f59e0b",
};
const TYPE_KEYS = ["monthly", "hourly", "piecework"];

const TypeBreakdownWidget = ({ breakdown, total, t }) => {
  const rows = TYPE_KEYS.map((k) => ({
    key: k,
    count: breakdown[k] || 0,
    color: TYPE_COLORS[k],
  })).filter((r) => r.count > 0);

  if (!rows.length) return null;

  return (
    <div className={styles.statWidget}>
      <span className={styles.statWidgetLabel}>{t("salaryType")}</span>

      {/* Bar */}
      <div className={styles.typeBar}>
        {rows.map((r) => (
          <div
            key={r.key}
            className={styles.typeBarSegment}
            style={{
              width: `${(r.count / total) * 100}%`,
              background: r.color,
            }}
          />
        ))}
      </div>

      {/* Labels under each segment */}
      <div className={styles.typeSegmentLabels}>
        {rows.map((r) => (
          <div
            key={r.key}
            className={styles.typeSegmentLabel}
            style={{ width: `${(r.count / total) * 100}%`, color: r.color }}
          >
            <span className={styles.typeSegmentName}>
              {t("salaryType" + r.key.charAt(0).toUpperCase() + r.key.slice(1))}
            </span>
            <span className={styles.typeSegmentCount}>{r.count}</span>
            <span className={styles.typeSegmentPct}>
              {Math.round((r.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

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
  const [stats, setStats] = useState(null);
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
        setStats(res.stats || null);
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
        {/* ── Stats ── */}
        {stats && (
          <div className={styles.statsGrid}>
            <StatWidget
              icon={Users}
              color="#6366f1"
              label={t("statsTotal")}
              value={stats.total}
            />
            <StatWidget
              icon={UserCheck}
              color="#16a34a"
              label={t("statsWithSalary")}
              value={stats.with_salary}
              sub={
                stats.total > 0
                  ? `${Math.round((stats.with_salary / stats.total) * 100)}%`
                  : "0%"
              }
              progress={
                stats.total > 0 ? (stats.with_salary / stats.total) * 100 : 0
              }
            />
            <StatWidget
              icon={UserX}
              color="#ef4444"
              label={t("statsWithoutSalary")}
              value={stats.without_salary}
              sub={
                stats.total > 0
                  ? `${Math.round((stats.without_salary / stats.total) * 100)}%`
                  : "0%"
              }
              progress={
                stats.total > 0 ? (stats.without_salary / stats.total) * 100 : 0
              }
            />
            <StatWidget
              icon={Wallet}
              color="#3b82f6"
              label={t("statsTotalSalarySum")}
              value={fmt(stats.total_sum)}
            />
            <StatWidget
              icon={TrendingUp}
              color="#f59e0b"
              label={t("statsAvgSalary")}
              value={fmt(stats.avg)}
            />
            {stats.type_breakdown && (
              <TypeBreakdownWidget
                breakdown={stats.type_breakdown}
                total={stats.with_salary}
                t={t}
              />
            )}
          </div>
        )}

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
