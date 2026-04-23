import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Wallet, Users, TrendingUp, Hash } from "lucide-react";

import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";

import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import PayrollFilter from "../components/PayrollFilter";
import SalarySort from "../components/SalarySort";
import AdvancesTable from "../components/AdvancesTable";
import GiveAdvanceModal from "../components/GiveAdvanceModal";
import { Icons } from "../icons/icons";

import styles from "./SalaryAdvancesPage.module.scss";

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

const StatWidget = ({ icon: Icon, color, label, value, sub }) => (
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
  </div>
);

// ── SalaryAdvancesPage ────────────────────────────────────────────────────────

const SalaryAdvancesPage = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [month, setMonth] = useState(getCurrentMonth());
  const [formData, setFormData] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAdvances = async (
    m = month,
    filters = formData,
    page = currentPage,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const res = await payrollApi.getAdvances(m, {
        page,
        pageSize: size,
        search: filters.search,
        branch_id: filters.branch_id,
        department_id: filters.department_id,
        position_id: filters.position_id,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
      });

      if (res.success) {
        setData(res.data);
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
    fetchAdvances(month, reset, 1, pageSize);
  }, [month]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSearch = () => fetchAdvances(month, formData, 1, pageSize);

  const handleFormSubmit = (e) => {
    e?.preventDefault();
    fetchAdvances(month, formData, 1, pageSize);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchAdvances(month, formData, newPage, pageSize);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    fetchAdvances(month, formData, 1, size);
  };

  const handleSortApply = (sort_by, sort_order) => {
    const updated = { ...formData, sort_by, sort_order };
    setFormData(updated);
    fetchAdvances(month, updated, 1, pageSize);
  };

  const handleUpdated = (updated) => {
    setData((prev) => {
      if (!prev) return prev;
      const oldAdv = prev.advances.find((a) => a.id === updated.id);
      const oldAmt = oldAdv ? Number(oldAdv.amount) : 0;
      const newAmt = Number(updated.amount);
      const advances = prev.advances.map((a) => (a.id === updated.id ? updated : a));
      const stats = prev.stats
        ? {
            ...prev.stats,
            total_amount: prev.stats.total_amount - oldAmt + newAmt,
            avg_amount:
              prev.stats.total_count > 0
                ? parseFloat(((prev.stats.total_amount - oldAmt + newAmt) / prev.stats.total_count).toFixed(2))
                : 0,
          }
        : prev.stats;
      return { ...prev, advances, stats };
    });
  };

  const handleDeleted = (deletedId) => {
    setData((prev) => {
      if (!prev) return prev;
      const advances = prev.advances.filter((a) => a.id !== deletedId);
      const deleted = prev.advances.find((a) => a.id === deletedId);
      const amount = deleted ? Number(deleted.amount) : 0;
      const stats = prev.stats
        ? {
            ...prev.stats,
            total_count: prev.stats.total_count - 1,
            total_amount: prev.stats.total_amount - amount,
            avg_amount:
              prev.stats.total_count - 1 > 0
                ? parseFloat(((prev.stats.total_amount - amount) / (prev.stats.total_count - 1)).toFixed(2))
                : 0,
          }
        : prev.stats;
      return { ...prev, advances, stats };
    });
    setTotalItems((n) => Math.max(0, n - 1));
  };

  const st = data?.stats;

  return (
    <div className={styles.page}>
      {loading && <Loading />}
      {showModal && (
        <GiveAdvanceModal
          onClose={() => setShowModal(false)}
          onSaved={() => fetchAdvances(month, formData, 1, pageSize)}
        />
      )}
      {editingAdvance && (
        <GiveAdvanceModal
          editAdvance={editingAdvance}
          onClose={() => setEditingAdvance(null)}
          onSaved={(updated) => { handleUpdated(updated); setEditingAdvance(null); }}
        />
      )}

      <div className={styles.main}>
        {/* ── Stats ──────────────────────────────────────────────────────── */}
        {st && (
          <div className={styles.statsGrid}>
            <StatWidget
              icon={Hash}
              color="#7c3aed"
              label={t("statsAdvancesCount")}
              value={st.total_count}
            />
            <StatWidget
              icon={Wallet}
              color="#3b82f6"
              label={t("statsAdvancesTotal")}
              value={fmt(st.total_amount)}
            />
            <StatWidget
              icon={TrendingUp}
              color="#059669"
              label={t("statsAdvancesAvg")}
              value={fmt(st.avg_amount)}
            />
            <StatWidget
              icon={Users}
              color="#f59e0b"
              label={t("statsAdvancesEmployees")}
              value={st.employee_count}
            />
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────── */}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              />
              {formData.search && (
                <span
                  className={styles.clearBtn}
                  onClick={() => setFormData((prev) => ({ ...prev, search: "" }))}
                >
                  {Icons.clear}
                </span>
              )}
            </div>

            <PayrollFilter
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleFormSubmit}
              hideSalaryType
              hideStatus
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
              className={styles.giveAdvanceBtn}
              onClick={() => setShowModal(true)}
            >
              {t("giveAdvance")}
            </button>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        {data ? (
          <AdvancesTable
            advances={data.advances || []}
            onDeleted={handleDeleted}
            onEdit={setEditingAdvance}
          />
        ) : (
          !loading && <div className={styles.empty}>{t("noData")}</div>
        )}
      </div>
    </div>
  );
};

export default SalaryAdvancesPage;
