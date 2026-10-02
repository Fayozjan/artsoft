import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Users, Wallet, CheckCircle, AlertCircle } from "lucide-react";

import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";

import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import PayrollFilter from "../components/PayrollFilter";
import SalarySort from "../components/SalarySort";
import PayoutsYearTable from "../components/PayoutsYearTable";
import EmployeeYearModal from "../components/EmployeeYearModal";
import Search from "../components/Search";

import styles from "./SalaryPayoutsPage.module.scss";
import { useWidgetsStore } from "../stores/widgetsStore";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 5 + i);

const initialFilters = {
  search: "",
  branch_id: "",
  department_id: "",
  position_id: "",
  salary_type: "",
  item_status: "", // maps to payout_status on the API side
  sort_by: "last_name",
  sort_order: "asc",
};

const PAYOUT_STATUS_OPTIONS = [
  { value: "", labelKey: "filterAll", color: "#6b7280" },
  { value: "unpaid", labelKey: "pendingPayout", color: "#3b82f6" },
  { value: "paid", labelKey: "paid", color: "#16a34a" },
];

// ── Stat widget ───────────────────────────────────────────────────────────────

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
          {value}{" "}
          {sub && <span className={styles.statWidgetSub}>{sub}</span>}
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

// ── SalaryPayoutsPage ─────────────────────────────────────────────────────────
// Single year-wide view: payout queue and the year report are one table.
// Each employee row pays its current month; expanding shows every month,
// each payable on its own.

const SalaryPayoutsPage = () => {
  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const { showAlert } = useAlertStore();
  const { viewMode, activeBranchId } = useAuthStore((s) => s.userSettings) || {};

  const [year, setYear] = useState(CURRENT_YEAR);
  const [formData, setFormData] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const [selectedIds, setSelectedIds] = useState([]);
  // Employee whose year breakdown modal is open; the row itself is derived
  // from the report so a refetch after a payment updates the modal too.
  const [modalEmployeeId, setModalEmployeeId] = useState(null);
  // Аванс любому сотруднику, в том числе отсутствующему в отчёте

  const [widgetsScrollHidden, setWidgetsScrollHidden] = useState(false);
  const lastScrollTopRef = useRef(0);

  const handleTableScroll = (e) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const lastScrollTop = lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    // мало данных — почти нечего скроллить, скрытие виджета меняет
    // высоту tableContainer и вызывает бесконечный hide/show (мигание)
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll < 40) {
      setWidgetsScrollHidden(false);
      return;
    }

    const delta = scrollTop - lastScrollTop;
    if (scrollTop <= 0) {
      setWidgetsScrollHidden(false);
    } else if (delta > 8) {
      setWidgetsScrollHidden(true);
    }
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────────

  const fetchReport = async (
    y = year,
    filters = formData,
    page = currentPage,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const res = await payrollApi.getPayoutsYearReport(y, {
        page,
        pageSize: size,
        search: filters.search,
        branch_id: viewMode === "branch" && activeBranchId ? activeBranchId : filters.branch_id,
        department_id: filters.department_id,
        position_id: filters.position_id,
        salary_type: filters.salary_type,
        payout_status: filters.item_status,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
      });

      if (res.success) {
        setReport(res.data);
        setCurrentPage(res.pagination?.currentPage ?? page);
        setTotalPages(res.pagination?.totalPages ?? 1);
        setTotalItems(res.pagination?.total ?? 0);
      } else {
        showAlert(res.message || t("error"), "error");
      }
    } catch (err) {
      console.error(err);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const reset = initialFilters;
    setFormData(reset);
    setCurrentPage(1);
    setSelectedIds([]);
    fetchReport(year, reset, 1, pageSize);
  }, [year]);

  useEffect(() => {
    if (viewMode === "branch") fetchReport(year, formData, 1, pageSize);
  }, [activeBranchId]);

  // ── Filter / sort / page handlers ─────────────────────────────────────────────

  const handleSearch = (data = formData) => {
    setSelectedIds([]);
    fetchReport(year, data, 1, pageSize);
  };

  const handleFormSubmit = (e) => {
    e?.preventDefault();
    setSelectedIds([]);
    fetchReport(year, formData, 1, pageSize);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchReport(year, formData, newPage, pageSize);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setSelectedIds([]);
    fetchReport(year, formData, 1, size);
  };

  const handleSortApply = (sort_by, sort_order) => {
    const updated = { ...formData, sort_by, sort_order };
    setFormData(updated);
    setSelectedIds([]);
    fetchReport(year, updated, 1, pageSize);
  };

  // ── Selection ─────────────────────────────────────────────────────────────────

  const handleToggleSelect = (id) => {
    if (!id) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleAll = () => {
    const pageIds = (report?.items || [])
      .map((r) => r.current?.item_id)
      .filter(Boolean);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !pageIds.includes(id))
        : [...new Set([...selectedIds, ...pageIds])],
    );
  };

  // ── Bulk actions on the selected employees' current month ─────────────────────

  const applyBulkPaidStatus = async (status) => {
    if (!selectedIds.length) return;
    setLoading(true);
    try {
      const res = await payrollApi.bulkMarkPaid(selectedIds, status);
      if (res.success) {
        showAlert(t("saved"), "success");
        setSelectedIds([]);
        await fetchReport(year, formData, currentPage, pageSize);
      } else {
        showAlert(res.message || t("error"), "error");
      }
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateBalances = async () => {
    setLoading(true);
    try {
      // One server pass over every sheet of the year, oldest month first
      const res = await payrollApi.recalculateYearBalances(year);
      if (!res.success) {
        showAlert(res.message || t("error"), "error");
        return;
      }
      showAlert(t("saved"), "success");
      await fetchReport(year, formData, currentPage, pageSize);
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChanged = () => fetchReport(year, formData, currentPage, pageSize);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const st = report?.stats;
  const selCount = selectedIds.length;
  const modalRow =
    (report?.items || []).find((r) => r.employee?.id === modalEmployeeId) || null;
  const paidPct =
    st && st.net > 0 ? Math.min(100, (st.paid / st.net) * 100) : 0;

  return (
    <div className={styles.page}>
      {loading && <Loading />}

      <div className={styles.main}>
        {/* ── Stats ────────────────────────────────────────────────────────── */}
        {widgetsVisible && st && (
          <div
            className={`${styles.statsGridWrap} ${widgetsScrollHidden ? styles.statsGridWrapHidden : ""}`}
          >
            <div className={styles.statsGridInner}>
              <div className={styles.statsGrid}>
                <StatWidget
                  icon={Users}
                  color="#3b82f6"
                  label={t("employees")}
                  value={st.employees}
                />
                <StatWidget
                  icon={Wallet}
                  color="#1d4ed8"
                  label={t("currentSalary")}
                  value={fmt(st.current_base)}
                />
                <StatWidget
                  icon={Wallet}
                  color="#0f172a"
                  label={t("lastAccrual")}
                  value={fmt(st.current_net)}
                />
                <StatWidget
                  icon={AlertCircle}
                  color="#f59e0b"
                  label={t("outstanding")}
                  value={fmt(st.outstanding)}
                />
                <StatWidget
                  icon={Wallet}
                  color="#0f172a"
                  label={t("yearAccrued")}
                  value={fmt(st.net)}
                />
                <StatWidget
                  icon={CheckCircle}
                  color="#16a34a"
                  label={t("yearPaid")}
                  value={fmt(st.paid)}
                  sub={`${Math.round(paidPct)}%`}
                  progress={paidPct}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className={styles.mainHeader}>
          <div className={styles.filterWrapper}>
            <select
              className={styles.yearSelect}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

            <PayrollFilter
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleFormSubmit}
              statusOptions={PAYOUT_STATUS_OPTIONS}
            />

            <SalarySort
              sort_by={formData.sort_by}
              sort_order={formData.sort_order}
              onApply={handleSortApply}
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
            <button
              className={styles.recalcBtn}
              onClick={handleRecalculateBalances}
              disabled={loading}
              title={t("recalculateBalances")}
            >
              {t("recalculateBalances")}
            </button>

            {selCount > 0 && (
              <>
                <button
                  className={styles.bulkPayBtn}
                  onClick={() => applyBulkPaidStatus("paid")}
                  disabled={loading}
                >
                  {`${t("markPaidSelected")} (${selCount})`}
                </button>

                <button
                  className={styles.bulkRevertBtn}
                  onClick={() => applyBulkPaidStatus("unpaid")}
                  disabled={loading}
                >
                  {`${t("markUnpaidSelected")} (${selCount})`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        {report?.items?.length ? (
          <PayoutsYearTable
            onScroll={handleTableScroll}
            items={report.items}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            onOpenEmployee={(row) => setModalEmployeeId(row.employee?.id)}
            onChanged={handleChanged}
          />
        ) : (
          !loading && <div className={styles.empty}>{t("noData")}</div>
        )}
      </div>

      <EmployeeYearModal
        isOpen={Boolean(modalRow)}
        row={modalRow}
        year={report?.year ?? year}
        onClose={() => setModalEmployeeId(null)}
        onChanged={handleChanged}
      />
    </div>
  );
};

export default SalaryPayoutsPage;
