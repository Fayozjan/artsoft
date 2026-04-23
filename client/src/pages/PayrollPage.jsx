import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  CheckCircle,
  Clock,
  Wallet,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-react";

import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";

import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import PayrollFilter from "../components/PayrollFilter";
import SalarySort from "../components/SalarySort";
import PayrollTable from "../components/PayrollTable";
import { Icons } from "../icons/icons";

import styles from "./PayrollPage.module.scss";

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
  item_status: "",
  sort_by: "last_name",
  sort_order: "asc",
};

// ── Stat widget card (matches HomePage Finance MockCard style) ─────────────────

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

// ── PayrollPage ───────────────────────────────────────────────────────────────

const PayrollPage = () => {
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

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchSheet = async (
    m = month,
    filters = formData,
    page = currentPage,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const res = await payrollApi.getOrGenerate(m, {
        page,
        pageSize: size,
        search: filters.search,
        branch_id: filters.branch_id,
        department_id: filters.department_id,
        position_id: filters.position_id,
        salary_type: filters.salary_type,
        item_status: filters.item_status,
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
    fetchSheet(month, reset, 1, pageSize);
  }, [month]);

  // ── Filter / sort / page handlers ────────────────────────────────────────────

  const handleSearch = () => {
    setSelectedIds([]);
    fetchSheet(month, formData, 1, pageSize);
  };

  const handleFormSubmit = (e) => {
    e?.preventDefault();
    setSelectedIds([]);
    fetchSheet(month, formData, 1, pageSize);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchSheet(month, formData, newPage, pageSize);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setSelectedIds([]);
    fetchSheet(month, formData, 1, size);
  };

  const handleSortApply = (sort_by, sort_order) => {
    const updated = { ...formData, sort_by, sort_order };
    setFormData(updated);
    setSelectedIds([]);
    fetchSheet(month, updated, 1, pageSize);
  };

  // ── Regenerate ───────────────────────────────────────────────────────────────

  const handleRegenerate = async () => {
    if (!sheet?.id) return;
    setLoading(true);
    try {
      await payrollApi.deleteSheet(sheet.id);
      setSheet(null);
      const reset = initialFilters;
      setFormData(reset);
      setCurrentPage(1);
      setSelectedIds([]);
      await fetchSheet(month, reset, 1, pageSize);
    } catch {
      showAlert(t("error"), "error");
      setLoading(false);
    }
  };

  // ── Item update (adjustment / apply flags) ───────────────────────────────────
  // Intentionally do NOT update stats widgets here — stats only change on approval.

  const handleItemUpdate = (updatedItem) => {
    setSheet((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === updatedItem.id ? { ...it, ...updatedItem } : it,
      ),
    }));
  };

  // ── Selection ────────────────────────────────────────────────────────────────

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

  // ── Status updates ────────────────────────────────────────────────────────────

  const applyBulkStatus = async (ids, status) => {
    if (!ids.length) return;
    try {
      const res = await payrollApi.bulkUpdateStatus(ids, status);
      if (res.success) {
        setSheet((prev) => {
          const affected = prev.items.filter((it) => ids.includes(it.id));
          let stats = prev.stats;
          if (stats) {
            let approvedDelta = 0,
              netDelta = 0;
            affected.forEach((it) => {
              if (it.status !== status) {
                approvedDelta += status === "approved" ? 1 : -1;
                netDelta +=
                  status === "approved" ? Number(it.net) : -Number(it.net);
              }
            });
            stats = {
              ...stats,
              approved: stats.approved + approvedDelta,
              remaining: stats.remaining - approvedDelta,
              approved_net: stats.approved_net + netDelta,
            };
          }
          return {
            ...prev,
            stats,
            items: prev.items.map((it) =>
              ids.includes(it.id) ? { ...it, status } : it,
            ),
          };
        });
        showAlert(t("saved"), "success");
      }
    } catch {
      showAlert(t("error"), "error");
    }
  };

  const applyAllStatus = async (status) => {
    if (!sheet?.id) return;
    try {
      const res = await payrollApi.updateAllItemsStatus(sheet.id, status);
      if (res.success) {
        setSheet((prev) => {
          let stats = prev.stats;
          if (stats) {
            stats = {
              ...stats,
              approved: status === "approved" ? stats.total : 0,
              remaining: status === "approved" ? 0 : stats.total,
              approved_net: status === "approved" ? stats.total_net : 0,
            };
          }
          return {
            ...prev,
            stats,
            items: prev.items.map((it) => ({ ...it, status })),
          };
        });
        showAlert(t("saved"), "success");
      }
    } catch {
      showAlert(t("error"), "error");
    }
  };

  const handleApproveAction = async () => {
    if (selectedIds.length > 0) {
      await applyBulkStatus(selectedIds, "approved");
      setSelectedIds([]);
    } else await applyAllStatus("approved");
  };

  const handleUnapproveAction = async () => {
    if (selectedIds.length > 0) {
      await applyBulkStatus(selectedIds, "draft");
      setSelectedIds([]);
    } else await applyAllStatus("draft");
  };

  const handleApproveItem = (id) => applyBulkStatus([id], "approved");
  const handleUnapproveItem = (id) => applyBulkStatus([id], "draft");

  // ── Global apply-flags (late / overtime) ─────────────────────────────────────

  const handleBulkApply = async (flags) => {
    if (!sheet?.id) return;
    try {
      const res = await payrollApi.bulkApplyFlags(sheet.id, flags);
      if (res.success) {
        setSheet((prev) => ({
          ...prev,
          items: prev.items.map((it) => {
            const updated = { ...it, ...flags };
            const lateDeduction = updated.apply_late
              ? Number(it.late_amount)
              : 0;
            const overtimeBonus = updated.apply_overtime
              ? Number(it.overtime_amount)
              : 0;
            updated.net =
              Number(it.accrued) -
              Number(it.debt_deduction) +
              Number(it.manual_adjustment) -
              lateDeduction +
              overtimeBonus;
            return updated;
          }),
        }));
      }
    } catch {
      showAlert(t("error"), "error");
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const selCount = selectedIds.length;
  const st = sheet?.stats;

  const items = sheet?.items || [];
  const allApplyLate = items.length > 0 && items.every((it) => it.apply_late);
  const allApplyOvertime =
    items.length > 0 && items.every((it) => it.apply_overtime);

  return (
    <div className={styles.page}>
      {loading && <Loading />}

      <div className={styles.main}>
        {/* ── Stats widgets ──────────────────────────────────────────────────── */}
        {st && (
          <div className={styles.statsGrid}>
            <StatWidget
              icon={Users}
              color="#6366f1"
              label={t("statsTotal")}
              value={st.total}
            />
            <StatWidget
              icon={CheckCircle}
              color="#16a34a"
              label={t("statsApproved")}
              value={st.approved}
              sub={
                st.total > 0
                  ? `${Math.round((st.approved / st.total) * 100)}%`
                  : "0%"
              }
              progress={st.total > 0 ? (st.approved / st.total) * 100 : 0}
            />
            <StatWidget
              icon={Clock}
              color="#f59e0b"
              label={t("statsRemaining")}
              value={st.remaining}
            />
            <StatWidget
              icon={Wallet}
              color="#3b82f6"
              label={t("statsApprovedNet")}
              value={fmt(st.approved_net)}
            />
            <StatWidget
              icon={SlidersHorizontal}
              color="#8b5cf6"
              label={t("statsAdjCount")}
              value={st.adj_count}
            />
            <StatWidget
              icon={TrendingUp}
              color="#10b981"
              label={t("statsAdjPlus")}
              value={`+${fmt(st.adj_plus)}`}
            />
            <StatWidget
              icon={TrendingDown}
              color="#ef4444"
              label={t("statsAdjMinus")}
              value={fmt(st.adj_minus)}
            />
            <StatWidget
              icon={BarChart3}
              color={st.adj_sum >= 0 ? "#10b981" : "#ef4444"}
              label={t("statsAdjTotal")}
              value={`${st.adj_sum >= 0 ? "+" : ""}${fmt(st.adj_sum)}`}
            />
          </div>
        )}

        {/* ── Header ────────────────────────────────────────────────────────── */}
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
            {/* Global late / overtime toggles */}
            {sheet && (
              <div className={styles.applyToggles}>
                <label className={styles.applyToggleLabel}>
                  <input
                    type="checkbox"
                    checked={allApplyLate}
                    onChange={(e) =>
                      handleBulkApply({ apply_late: e.target.checked })
                    }
                    disabled={loading}
                  />
                  {t("applyLateAll")}
                </label>
                <label className={styles.applyToggleLabel}>
                  <input
                    type="checkbox"
                    checked={allApplyOvertime}
                    onChange={(e) =>
                      handleBulkApply({ apply_overtime: e.target.checked })
                    }
                    disabled={loading}
                  />
                  {t("applyOvertimeAll")}
                </label>
              </div>
            )}

            <button
              className={styles.bulkApproveBtn}
              onClick={handleApproveAction}
              disabled={!sheet || loading}
            >
              {selCount > 0
                ? `${t("approveSelected")} (${selCount})`
                : t("approveAll")}
            </button>

            {(selCount > 0 || (st?.approved ?? 0) > 0) && (
              <button
                className={styles.bulkRevertBtn}
                onClick={handleUnapproveAction}
                disabled={!sheet || loading}
              >
                {selCount > 0
                  ? `${t("unapproveSelected")} (${selCount})`
                  : t("unapproveAll")}
              </button>
            )}

            <button
              className={styles.regenBtn}
              onClick={handleRegenerate}
              disabled={!sheet || loading}
            >
              {Icons.refresh}
            </button>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        {sheet ? (
          <PayrollTable
            items={sheet.items || []}
            onItemUpdate={handleItemUpdate}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            onApproveItem={handleApproveItem}
            onUnapproveItem={handleUnapproveItem}
          />
        ) : (
          !loading && <div className={styles.empty}>{t("noData")}</div>
        )}
      </div>
    </div>
  );
};

export default PayrollPage;
