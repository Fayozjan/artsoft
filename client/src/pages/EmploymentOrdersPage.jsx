import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import {
  FileText,
  UserPlus,
  UserMinus,
  ArrowLeftRight,
  PalmtreeIcon,
} from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";
import { usePermissions } from "../hooks/usePermissions";
import { useHideBranch } from "../hooks/useHideBranch";

import {
  getEmploymentOrders,
  getEmploymentOrdersStats,
  addEmploymentOrder,
  editEmploymentOrderById,
  deleteEmploymentOrderById,
  getActiveBranches,
  getActivePositions,
  EmployeeService,
} from "../api";

import Button from "../components/Button";
import Loading from "../components/Loading";
import EmployeeCell from "../components/EmployeeCell";
import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import Pagination from "../components/Pagination";
import Search from "../components/Search";
import DownloadButton from "../components/DownloadButton";
import SelectEmployee from "../components/SelectEmployee";
import EmployeeFilterForm from "../components/EmployeeFilterForm";

import { Icons } from "../icons/icons";
import styles from "./EmploymentOrdersPage.module.scss";
import { useWidgetsStore } from "../stores/widgetsStore";

const ORDER_TYPES = ["hire", "transfer", "leave", "terminate"];

const TYPE_META = {
  hire:      { color: "#16a34a", bg: "#dcfce7", labelKey: "hiredEvent" },
  transfer:  { color: "#3b82f6", bg: "#dbeafe", labelKey: "transferEvent" },
  leave:     { color: "#f59e0b", bg: "#fef3c7", labelKey: "leaveEvent" },
  terminate: { color: "#ef4444", bg: "#fee2e2", labelKey: "terminateEvent" },
};

const StatWidget = ({ icon: Icon, color, label, value }) => (
  <div className={styles.statWidget}>
    <div className={styles.statWidgetInner}>
      <div className={styles.statWidgetIcon} style={{ background: color + "18" }}>
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div className={styles.statWidgetContent}>
        <span className={styles.statWidgetLabel}>{label}</span>
        <span className={styles.statWidgetValue} style={{ color }}>{value ?? "—"}</span>
      </div>
    </div>
  </div>
);

const TypeBadge = ({ type, t }) => {
  const meta = TYPE_META[type];
  if (!meta) return <span>{type}</span>;
  return (
    <span
      className={styles.typeBadge}
      style={{ color: meta.color, background: meta.bg }}
    >
      {t(meta.labelKey)}
    </span>
  );
};

const empFullName = (emp) =>
  [emp?.last_name, emp?.first_name, emp?.middle_name]
    .filter(Boolean)
    .join(" ");

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU");
};

/* ── Form (add / edit) ─────────────────────────────────────────── */

const OrderForm = ({ order, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const isEdit = Boolean(order);

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);

  const [formData, setFormData] = useState({
    employee_id:   order?.employee_id   || "",
    type:          order?.type          || "",
    order_number:  order?.order_number  || "",
    order_date:    order
      ? (order.date || "").slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    branch_id:     order?.branch_id     || "",
    department_id: order?.department_id || "",
    position_id:   order?.position_id   || "",
    note:          order?.note          || "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const calls = [getActiveBranches(), getActivePositions()];
        if (!isEdit) calls.push(EmployeeService.getActive());
        const [brRes, posRes, empRes] = await Promise.all(calls);
        setBranches(brRes.data || []);
        setPositions(posRes.data || []);
        if (!isEdit) setEmployees(empRes?.data || []);
      } catch (err) {
        showAlert(t("error"), "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const set = (name, value) =>
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "branch_id" ? { department_id: "" } : {}),
    }));

  const handleChange = (e) => set(e.target.name, e.target.value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!isEdit && !formData.employee_id) {
      showAlert(t("selectEmployee"), "error");
      return;
    }
    setLoading(true);
    try {
      let res;
      if (isEdit) {
        res = await editEmploymentOrderById(order.id, {
          order_number:  formData.order_number,
          date:          formData.order_date,
          type:          formData.type,
          branch_id:     formData.branch_id     || null,
          department_id: formData.department_id || null,
          position_id:   formData.position_id   || null,
          note:          formData.note,
        });
      } else {
        res = await addEmploymentOrder({
          ...formData,
          employeeId: formData.employee_id,
        });
      }
      if (!res?.success) throw new Error(res?.error || t("error"));
      showAlert(t("success"), "success");
      onSuccess();
      onClose();
    } catch (err) {
      showAlert(err?.response?.data?.message || t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const type = formData.type;
  const showBranch   = type && type !== "terminate";
  const showDept     = type && type !== "terminate";
  const showPosition = type && type !== "terminate";

  const currentBranch = branches.find((b) => b.id === Number(formData.branch_id));

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {loading && <Loading />}

      <div className={styles.formHeader}>
        <h2>{isEdit ? t("editOrder") : t("addEmploymentOrder")}</h2>
        <span onClick={onClose} style={{ display: "flex", cursor: "pointer" }}>
          {Icons.clear}
        </span>
      </div>

      <div className={styles.formBody}>
        {/* Employee selector (add only) */}
        {!isEdit && (
          <div className={styles.fieldGroup}>
            <label>{t("employee")} <span className={styles.req}>*</span></label>
            <SelectEmployee
              data="employee"
              options={employees}
              setFormData={setFormData}
              defaultValue={formData.employee_id}
            />
          </div>
        )}

        {/* Type selector */}
        {!isEdit && (
          <div className={styles.fieldGroup}>
            <label>{t("employmentOrderType")} <span className={styles.req}>*</span></label>
            <select name="type" value={formData.type} onChange={handleChange} required>
              <option value="">{t("select")}</option>
              {ORDER_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t(TYPE_META[tp]?.labelKey || tp)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Order number + date */}
        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label>{t("orderNumber")} <span className={styles.req}>*</span></label>
            <input
              type="text"
              name="order_number"
              value={formData.order_number}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.fieldGroup}>
            <label>{t("orderDate")} <span className={styles.req}>*</span></label>
            <input
              type="date"
              name="order_date"
              value={formData.order_date}
              onChange={handleChange}
              onFocus={(e) => e.target.showPicker?.()}
              required
            />
          </div>
        </div>

        {/* Branch */}
        {showBranch && (
          <div className={styles.fieldGroup}>
            <label>{t("branch")} <span className={styles.req}>*</span></label>
            <select name="branch_id" value={formData.branch_id} onChange={handleChange} required>
              <option value="">{t("select")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Department */}
        {showDept && (
          <div className={styles.fieldGroup}>
            <label>{t("department")} <span className={styles.req}>*</span></label>
            <select
              name="department_id"
              value={formData.department_id}
              onChange={handleChange}
              disabled={!formData.branch_id}
              required
            >
              <option value="">{t("select")}</option>
              {(currentBranch?.departments || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Position */}
        {showPosition && (
          <div className={styles.fieldGroup}>
            <label>{t("position")} <span className={styles.req}>*</span></label>
            <select name="position_id" value={formData.position_id} onChange={handleChange} required>
              <option value="">{t("select")}</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Note */}
        <div className={styles.fieldGroup}>
          <label>{t("note")}</label>
          <input type="text" name="note" value={formData.note} onChange={handleChange} />
        </div>
      </div>

      <div className={styles.formFooter}>
        <Button text={t("save")} type="submit" loading={loading} />
      </div>
    </form>
  );
};

/* ── Main page ─────────────────────────────────────────────────── */

const currentMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { date_from: fmt(first), date_to: fmt(now) };
};

const EmploymentOrdersPage = () => {
  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const { showAlert } = useAlertStore();
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const { viewMode, activeBranchId } = useAuthStore((s) => s.userSettings) || {};
  // фильтрация по филиалу идёт на сервере — свой выбор филиала прячем
  const hideBranch = useHideBranch();

  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    branch_id: "",
    department_id: "",
    position_id: "",
    ...currentMonthRange(),
    sort_by: "date",
    sort_order: "desc",
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const [modalType, setModalType] = useState(null); // "add" | "edit" | null
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Клиентская сортировка для колонок, не завязанных на серверный sort_by
  // (order_number/date сортируются на бэке — см. handleSortChange)
  const [localSortField, setLocalSortField] = useState(null);
  const [localSortOrder, setLocalSortOrder] = useState("asc");

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

  const fetchData = useCallback(
    async (page = 1, f = filters, size = pageSize) => {
      setLoading(true);
      try {
        const res = await getEmploymentOrders({ page, pageSize: size, ...f });
        setData(res.data ?? []);
        setCurrentPage(res.pagination?.currentPage ?? 1);
        setTotalPages(res.pagination?.totalPages ?? 1);
        setTotalItems(res.pagination?.totalItems ?? 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await getEmploymentOrdersStats();
      if (res.success) setStats(res.stats);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData(1, filters, pageSize);
    fetchStats();
  }, []);

  // при смене активного филиала перезапрашиваем — сервер фильтрует по нему
  const branchInitRef = useRef(true);
  useEffect(() => {
    if (branchInitRef.current) {
      branchInitRef.current = false;
      return;
    }
    if (viewMode !== "branch") return;
    const reset = { ...filters, branch_id: "", department_id: "" };
    setFilters(reset);
    setCurrentPage(1);
    fetchData(1, reset, pageSize);
    fetchStats();
  }, [activeBranchId]);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointer = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setFilterOpen(false); };
    const onScroll = () => setFilterOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll);
    };
  }, [filterOpen]);

  const handleSearch = (f = filters) => {
    setCurrentPage(1);
    fetchData(1, f, pageSize);
  };

  const handleReset = () => {
    const empty = { search: "", type: "", branch_id: "", department_id: "", position_id: "", ...currentMonthRange(), sort_by: "date", sort_order: "desc" };
    setFilters(empty);
    setCurrentPage(1);
    fetchData(1, empty, pageSize);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      fetchData(page, filters, pageSize);
    }
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage(1);
    fetchData(1, filters, size);
  };

  const handleSortChange = (sort_by) => {
    const sort_order =
      filters.sort_by === sort_by && filters.sort_order === "desc" ? "asc" : "desc";
    const updated = { ...filters, sort_by, sort_order };
    setFilters(updated);
    fetchData(1, updated, pageSize);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await deleteEmploymentOrderById(deleteTarget);
      if (res.success) {
        showAlert(t("success"), "success");
        fetchData(currentPage, filters, pageSize);
        fetchStats();
      } else {
        showAlert(res.message || t("error"), "error");
      }
    } catch (err) {
      showAlert(err?.response?.data?.message || t("error"), "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const exportToExcel = () => {
    const headers = [
      "#", t("employee"), t("employmentOrderType"), t("orderNumber"),
      t("orderDate"), t("branch"), t("department"), t("position"), t("note"),
    ];
    const rows = data.map((row, i) => [
      i + 1,
      empFullName(row.employee),
      t(TYPE_META[row.type]?.labelKey || row.type),
      row.order_number || "",
      formatDate(row.date),
      row.branch?.name || "",
      row.department?.name || "",
      row.position?.name || "",
      row.note || "",
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, t("employment-orders") || "Приказы");
    XLSX.writeFile(wb, "employment_orders.xlsx");
  };

  const defaultRange = currentMonthRange();
  const activeFilterCount = [
    filters.type,
    filters.branch_id,
    filters.department_id,
    filters.position_id,
    filters.date_from !== defaultRange.date_from ? filters.date_from : "",
    filters.date_to   !== defaultRange.date_to   ? filters.date_to   : "",
  ].filter(Boolean).length;

  const SortIcon = ({ field }) => {
    if (filters.sort_by !== field) return null;
    return (
      <span className={styles.sortIcon}>
        {filters.sort_order === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const handleLocalSort = (field) => {
    if (localSortField === field) {
      setLocalSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setLocalSortField(field);
      setLocalSortOrder("asc");
    }
  };

  const LocalSortIcon = ({ field }) => {
    if (localSortField !== field) return null;
    return (
      <span className={styles.sortIcon}>
        {localSortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const localSortValue = (row, field) => {
    switch (field) {
      case "employee":
        return empFullName(row.employee);
      case "type":
        return t(TYPE_META[row.type]?.labelKey || row.type);
      case "branch":
        return row.branch?.name || "";
      case "department":
        return row.department?.name || "";
      case "position":
        return row.position?.name || "";
      default:
        return row[field] || "";
    }
  };

  const sortedData = localSortField
    ? [...data].sort((a, b) => {
        const aVal = localSortValue(a, localSortField);
        const bVal = localSortValue(b, localSortField);
        return localSortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : data;

  return (
    <div className={styles.page}>
      {loading && <Loading />}

      <div className={styles.main}>
        {/* Stats */}
        {widgetsVisible && stats && (
          <div
            className={`${styles.statsGridWrap} ${widgetsScrollHidden ? styles.statsGridWrapHidden : ""}`}
          >
            <div className={styles.statsGridInner}>
              <div className={styles.statsGrid}>
                <StatWidget icon={FileText}       color="#6366f1" label={t("statsTotal")}          value={stats.total} />
                <StatWidget icon={UserPlus}       color="#16a34a" label={t("hiredEvent")}           value={stats.hire} />
                <StatWidget icon={UserMinus}      color="#ef4444" label={t("terminateEvent")}       value={stats.terminate} />
                <StatWidget icon={ArrowLeftRight} color="#3b82f6" label={t("transferEvent")}        value={stats.transfer} />
                <StatWidget icon={PalmtreeIcon}   color="#f59e0b" label={t("leaveEvent")}           value={stats.leave} />
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className={styles.mainHeader}>
          <div className={styles.filterWrapper}>
            <Search
              formData={filters}
              setFormData={setFilters}
              onSearch={handleSearch}
            />

            {/* Filter dropdown */}
            <div ref={filterRef} className={styles.filterToggle}>
              <div
                className={`${styles.toggleBtn} ${activeFilterCount > 0 ? styles.toggleBtnActive : ""}`}
                onClick={() => setFilterOpen((v) => !v)}
              >
                {Icons.filter}
                {activeFilterCount > 0 && (
                  <span className={styles.badge}>{activeFilterCount}</span>
                )}
              </div>

              {filterOpen && (
                <div className={styles.filterDropdown}>
                  <div className={styles.filterField}>
                    <label>{t("employmentOrderType")}</label>
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                    >
                      <option value="">{t("filterAll")}</option>
                      {ORDER_TYPES.map((tp) => (
                        <option key={tp} value={tp}>{t(TYPE_META[tp]?.labelKey || tp)}</option>
                      ))}
                    </select>
                  </div>

                  <EmployeeFilterForm
                    filters={["branch", "department", "position"]}
                    formData={filters}
                    setFormData={setFilters}
                  />

                  <div className={styles.filterRow}>
                    <div className={styles.filterField}>
                      <label>{t("dateFrom")}</label>
                      <input
                        type="date"
                        value={filters.date_from}
                        onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                        onFocus={(e) => e.target.showPicker?.()}
                      />
                    </div>
                    <div className={styles.filterField}>
                      <label>{t("dateTo")}</label>
                      <input
                        type="date"
                        value={filters.date_to}
                        onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                        onFocus={(e) => e.target.showPicker?.()}
                      />
                    </div>
                  </div>

                  <div className={styles.filterActions}>
                    <button onClick={handleReset}>{t("clearAll")}</button>
                    <button className={styles.applyBtn} onClick={() => { handleSearch(); setFilterOpen(false); }}>
                      {t("apply")}
                    </button>
                  </div>
                </div>
              )}
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
            {canAdd && (
              <Button text={t("add")} onClick={() => setModalType("add")} />
            )}
            <div className={styles.refreshBtn} onClick={() => { fetchData(currentPage, filters, pageSize); fetchStats(); }}>
              {Icons.refresh}
            </div>
            {data.length > 0 && (
              <DownloadButton onClick={exportToExcel} />
            )}
          </div>
        </div>

        {/* Table */}
        <div className={styles.tableContainer} onScroll={handleTableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>№</th>
                <th className={styles.sortable} onClick={() => handleLocalSort("employee")}>
                  {t("employee")} <LocalSortIcon field="employee" />
                </th>
                <th className={styles.sortable} onClick={() => handleLocalSort("type")}>
                  {t("employmentOrderType")} <LocalSortIcon field="type" />
                </th>
                <th
                  className={styles.sortable}
                  onClick={() => handleSortChange("order_number")}
                >
                  {t("orderNumber")} <SortIcon field="order_number" />
                </th>
                <th
                  className={styles.sortable}
                  onClick={() => handleSortChange("date")}
                >
                  {t("orderDate")} <SortIcon field="date" />
                </th>
                {!hideBranch && (
                  <th className={styles.sortable} onClick={() => handleLocalSort("branch")}>
                    {t("branch")} <LocalSortIcon field="branch" />
                  </th>
                )}
                <th className={styles.sortable} onClick={() => handleLocalSort("department")}>
                  {t("department")} <LocalSortIcon field="department" />
                </th>
                <th className={styles.sortable} onClick={() => handleLocalSort("position")}>
                  {t("position")} <LocalSortIcon field="position" />
                </th>
                <th className={styles.sortable} onClick={() => handleLocalSort("note")}>
                  {t("note")} <LocalSortIcon field="note" />
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                sortedData.map((row, i) => (
                  <tr key={row.id}>
                    <td className={styles.numCell}>
                      {(currentPage - 1) * pageSize + i + 1}
                    </td>
                    <td>
                      <EmployeeCell
                        photo={row.employee?.photo}
                        lastName={row.employee?.last_name}
                        firstName={row.employee?.first_name}
                        middleName={row.employee?.middle_name}
                        id={row.employee_id}
                        branch={row.branch?.name}
                        department={row.department?.name}
                      />
                    </td>
                    <td>
                      <TypeBadge type={row.type} t={t} />
                    </td>
                    <td>{row.order_number || "—"}</td>
                    <td>{formatDate(row.date)}</td>
                    {!hideBranch && <td>{row.branch?.name || "—"}</td>}
                    <td>{row.department?.name || "—"}</td>
                    <td>{row.position?.name || "—"}</td>
                    <td className={styles.noteCell}>{row.note || "—"}</td>
                    <td className={styles.actionsCell}>
                      {canEdit && (
                        <button
                          className={styles.actionBtn}
                          title={t("edit")}
                          onClick={() => { setSelectedOrder(row); setModalType("edit"); }}
                        >
                          {Icons.edit}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          title={t("delete")}
                          onClick={() => setDeleteTarget(row.id)}
                        >
                          {Icons.delete}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={hideBranch ? 9 : 10} className={styles.noData}>{t("noData")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit sidebar */}
      {(modalType === "add" || modalType === "edit") && (
        <OverlaySidebar
          isOpen={true}
          onClose={() => { setModalType(null); setSelectedOrder(null); }}
          width="520px"
          side="right"
        >
          <OrderForm
            order={modalType === "edit" ? selectedOrder : null}
            onClose={() => { setModalType(null); setSelectedOrder(null); }}
            onSuccess={() => { fetchData(currentPage, filters, pageSize); fetchStats(); }}
          />
        </OverlaySidebar>
      )}

      {/* Delete confirm */}
      <CenterModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onAccept={handleDelete}
        title={t("areYouSureDelete")}
      />
    </div>
  );
};

export default EmploymentOrdersPage;
