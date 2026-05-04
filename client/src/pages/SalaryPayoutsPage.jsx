import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  CheckCircle,
  Wallet,
  AlertCircle,
  TrendingDown,
} from "lucide-react";

import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";

import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import PayrollFilter from "../components/PayrollFilter";
import SalarySort from "../components/SalarySort";
import PayoutsTable from "../components/PayoutsTable";
import { Icons } from "../icons/icons";

import styles from "./SalaryPayoutsPage.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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

const SalaryPayoutsPage = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [month, setMonth] = useState(getCurrentMonth());
  const [formData, setFormData] = useState(initialFilters);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const [selectedIds, setSelectedIds] = useState([]);

  // ── Fetch ─────────────────────────────────────────────────────────────────────

  const fetchPayouts = async (
    m = month,
    filters = formData,
    page = currentPage,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const res = await payrollApi.getPayouts(m, {
        page,
        pageSize: size,
        search: filters.search,
        branch_id: filters.branch_id,
        department_id: filters.department_id,
        position_id: filters.position_id,
        salary_type: filters.salary_type,
        payout_status: filters.item_status,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
      });

      if (res.success) {
        setSheet(res.data);
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
    fetchPayouts(month, reset, 1, pageSize);
  }, [month]);

  // ── Filter / sort / page handlers ─────────────────────────────────────────────

  const handleSearch = () => {
    setSelectedIds([]);
    fetchPayouts(month, formData, 1, pageSize);
  };

  const handleFormSubmit = (e) => {
    e?.preventDefault();
    setSelectedIds([]);
    fetchPayouts(month, formData, 1, pageSize);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchPayouts(month, formData, newPage, pageSize);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setSelectedIds([]);
    fetchPayouts(month, formData, 1, size);
  };

  const handleSortApply = (sort_by, sort_order) => {
    const updated = { ...formData, sort_by, sort_order };
    setFormData(updated);
    setSelectedIds([]);
    fetchPayouts(month, updated, 1, pageSize);
  };

  // ── Selection ─────────────────────────────────────────────────────────────────

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleAll = () => {
    const pageIds = (sheet?.items || []).map((it) => it.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !pageIds.includes(id))
        : [...new Set([...selectedIds, ...pageIds])],
    );
  };

  // ── Paid / revert actions ─────────────────────────────────────────────────────

  const applyBulkPaidStatus = async (ids, status) => {
    if (!ids.length) return;
    try {
      const res = await payrollApi.bulkMarkPaid(ids, status);
      if (res.success) {
        setSheet((prev) => {
          const stats = prev?.stats;
          let newStats = stats;
          if (stats) {
            const affected = prev.items.filter((it) => ids.includes(it.id));
            let pendingDelta = 0,
              paidDelta = 0,
              pendingSumDelta = 0,
              paidSumDelta = 0;
            affected.forEach((it) => {
              if (it.payout_status !== status) {
                if (status === "paid") {
                  pendingDelta -= 1;
                  paidDelta += 1;
                  pendingSumDelta -= Number(it.net);
                  paidSumDelta += Number(it.net);
                } else {
                  pendingDelta += 1;
                  paidDelta -= 1;
                  pendingSumDelta += Number(it.net);
                  paidSumDelta -= Number(it.net);
                }
              }
            });
            newStats = {
              ...stats,
              pending_count: stats.pending_count + pendingDelta,
              paid_count: stats.paid_count + paidDelta,
              pending_sum: stats.pending_sum + pendingSumDelta,
              paid_sum: stats.paid_sum + paidSumDelta,
            };
          }
          return {
            ...prev,
            stats: newStats,
            items: prev.items.map((it) =>
              ids.includes(it.id) ? { ...it, payout_status: status } : it,
            ),
          };
        });
        showAlert(t("saved"), "success");
      }
    } catch {
      showAlert(t("error"), "error");
    }
  };

  const applyAllPaidStatus = async (status) => {
    if (!sheet?.id) return;
    try {
      const res = await payrollApi.markAllPayoutsStatus(sheet.id, status);
      if (res.success) {
        setSheet((prev) => {
          const stats = prev?.stats;
          let newStats = stats;
          if (stats) {
            const total = stats.pending_count + stats.paid_count;
            const totalSum = stats.pending_sum + stats.paid_sum;
            newStats = {
              ...stats,
              pending_count: status === "paid" ? 0 : total,
              paid_count: status === "paid" ? total : 0,
              pending_sum: status === "paid" ? 0 : totalSum,
              paid_sum: status === "paid" ? totalSum : 0,
            };
          }
          return {
            ...prev,
            stats: newStats,
            items: prev.items.map((it) => ({ ...it, payout_status: status })),
          };
        });
        showAlert(t("saved"), "success");
      }
    } catch {
      showAlert(t("error"), "error");
    }
  };

  const handlePayAction = async () => {
    if (selectedIds.length > 0) {
      await applyBulkPaidStatus(selectedIds, "paid");
      setSelectedIds([]);
    } else {
      await applyAllPaidStatus("paid");
    }
  };

  const handleRevertAction = async () => {
    if (selectedIds.length > 0) {
      await applyBulkPaidStatus(selectedIds, "unpaid");
      setSelectedIds([]);
    } else {
      await applyAllPaidStatus("unpaid");
    }
  };

  const handleRecalculateBalances = async () => {
    if (!sheet?.id) return;
    setLoading(true);
    try {
      const res = await payrollApi.recalculateSalaryBalances(sheet.id);
      if (res.success) {
        showAlert(t("saved"), "success");
        fetchPayouts(month, formData, currentPage, pageSize);
      } else {
        showAlert(res.message || t("error"), "error");
      }
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePayItem    = (id) => applyBulkPaidStatus([id], "paid");
  const handleRevertItem = (id) => applyBulkPaidStatus([id], "unpaid");

  const handleItemUpdate = (updatedItem) => {
    setSheet((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === updatedItem.id ? { ...it, ...updatedItem } : it,
      ),
    }));
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const selCount = selectedIds.length;
  const st = sheet?.stats;
  const total = (st?.pending_count ?? 0) + (st?.paid_count ?? 0);

  return (
    <div className={styles.page}>
      {loading && <Loading />}

      <div className={styles.main}>
        {/* ── Stats ────────────────────────────────────────────────────────── */}
        {st && (
          <div className={styles.statsGrid}>
            <StatWidget
              icon={Clock}
              color="#3b82f6"
              label={t("statsPending")}
              value={st.pending_count}
              sub={total > 0 ? ` / ${total}` : undefined}
            />
            <StatWidget
              icon={CheckCircle}
              color="#16a34a"
              label={t("statsPaid")}
              value={st.paid_count}
              sub={total > 0 ? `${Math.round((st.paid_count / total) * 100)}%` : "0%"}
              progress={total > 0 ? (st.paid_count / total) * 100 : 0}
            />
            <StatWidget
              icon={Wallet}
              color="#3b82f6"
              label={t("statsPendingSum")}
              value={fmt(st.pending_sum)}
            />
            <StatWidget
              icon={CheckCircle}
              color="#16a34a"
              label={t("statsTotalPaidAmount")}
              value={fmt(st.total_paid_amount)}
            />
            <StatWidget
              icon={AlertCircle}
              color="#f59e0b"
              label={t("statsSalaryBalance")}
              value={st.total_salary_balance > 0 ? fmt(st.total_salary_balance) : "—"}
            />
            <StatWidget
              icon={AlertCircle}
              color="#ef4444"
              label={t("statsTotalDebt")}
              value={st.total_debt_deduction > 0 ? `−${fmt(st.total_debt_deduction)}` : "—"}
            />
            <StatWidget
              icon={TrendingDown}
              color="#7c3aed"
              label={t("statsTotalAdvance")}
              value={st.total_advance > 0 ? fmt(st.total_advance) : "—"}
            />
          </div>
        )}

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className={styles.mainHeader}>
          <div className={styles.filterWrapper}>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={styles.monthInput}
            />

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
              disabled={!sheet || loading}
              title={t("recalculateBalances")}
            >
              {t("recalculateBalances")}
            </button>

            <button
              className={styles.bulkPayBtn}
              onClick={handlePayAction}
              disabled={!sheet || loading}
            >
              {selCount > 0
                ? `${t("markPaidSelected")} (${selCount})`
                : t("markPaidAll")}
            </button>

            {(selCount > 0 || (st?.paid_count ?? 0) > 0) && (
              <button
                className={styles.bulkRevertBtn}
                onClick={handleRevertAction}
                disabled={!sheet || loading}
              >
                {selCount > 0
                  ? `${t("markUnpaidSelected")} (${selCount})`
                  : t("markUnpaidAll")}
              </button>
            )}
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        {sheet ? (
          <PayoutsTable
            items={sheet.items || []}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            onPayItem={handlePayItem}
            onRevertItem={handleRevertItem}
            onItemUpdate={handleItemUpdate}
          />
        ) : (
          !loading && <div className={styles.empty}>{t("noData")}</div>
        )}
      </div>
    </div>
  );
};

export default SalaryPayoutsPage;
