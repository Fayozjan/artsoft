import { useState, useEffect, useRef, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Package,
  PackageCheck,
  PackageX,
  Users,
  Download,
  Upload,
  Loader2,
} from "lucide-react";

import {
  getAssetAssignments,
  getAssetAssignmentsByEmployee,
  getAssetAssignmentStats,
  deleteAssetAssignmentById,
  importAssetAssignmentsExcel,
  undoAssetAssignmentReturn,
} from "../api";
import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";

import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import Search from "../components/Search";
import SalarySort from "../components/SalarySort";
import SortArrow from "../components/SortArrow";
import { Switcher } from "../components/Switcher";
import Button from "../components/Button";
import CenterModal from "../components/CenterModal";
import EmployeeCell from "../components/EmployeeCell";
import { ActionButton } from "../components/ActionButtons";
import AssignAssetModal from "../components/AssignAssetModal";
import ReturnAssetModal from "../components/ReturnAssetModal";
import { Icons } from "../icons/icons";
import {
  exportAssetAssignmentsToExcel,
  downloadAssetAssignmentImportTemplate,
} from "../utils/DocGenerator";
import styles from "./AssetAssignmentsPage.module.scss";
import { useWidgetsStore } from "../stores/widgetsStore";

// выгружаем все записи по текущим фильтрам, а не только видимую страницу
const EXPORT_PAGE_SIZE = 5000;

const initialFilters = {
  search: "",
  state: "",
  sort_by: "assigned_date",
  sort_order: "desc",
};

// значения фильтра статуса, которые есть в select — их же принимаем из URL
const STATES_FILTER = ["assigned", "returned"];

// кнопка сортировки уходит на сервер, клик по заголовку сортирует локально
const SORT_FIELDS = [
  { value: "last_name", labelKey: "custodian" },
  { value: "asset_name", labelKey: "assetName" },
  { value: "asset_spec", labelKey: "assetSpec" },
  { value: "quantity", labelKey: "quantity" },
  { value: "asset_condition", labelKey: "assetCondition" },
  { value: "assigned_date", labelKey: "assignedDate" },
  { value: "state", labelKey: "state" },
];

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("ru-RU");
};

// Icons.undo без width/height — в ActionButton растягивается на всю кнопку
const IconReturn = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7v6h6" />
    <path d="M3 13C5 8.5 9.5 5 15 5a9 9 0 0 1 6 15" />
  </svg>
);

// отмена возврата — стрелка в другую сторону
const IconUndoReturn = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 7v6h-6" />
    <path d="M21 13c-2-4.5-6.5-8-12-8a9 9 0 0 0-6 15" />
  </svg>
);

const StatWidget = ({ icon: Icon, color, label, value }) => (
  <div className={styles.statWidget}>
    <div className={styles.statWidgetInner}>
      <div className={styles.statWidgetIcon} style={{ background: color + "18" }}>
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div className={styles.statWidgetContent}>
        <span className={styles.statWidgetLabel}>{label}</span>
        <span className={styles.statWidgetValue} style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  </div>
);

const AssetAssignmentsPage = () => {
  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const { showAlert } = useAlertStore();

  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  // сюда приходят с других страниц со ссылкой вида ?search=<id>&state=assigned
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState(() => ({
    ...initialFilters,
    search: searchParams.get("search") || initialFilters.search,
    state: STATES_FILTER.includes(searchParams.get("state"))
      ? searchParams.get("state")
      : initialFilters.state,
  }));

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [returningAssignment, setReturningAssignment] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [undoingId, setUndoingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  // null — показываем порядок, который вернул сервер
  const [headerSort, setHeaderSort] = useState(null);
  // "viewByRecords" — плоский список, "viewByEmployees" — группировка по сотрудникам
  const [view, setView] = useState("viewByRecords");
  const [expandedEmployees, setExpandedEmployees] = useState([]);
  const importFileRef = useRef(null);
  const importMenuRef = useRef(null);
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

  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
    mode = view,
  ) => {
    setLoading(true);
    try {
      const loadList =
        mode === "viewByEmployees" ? getAssetAssignmentsByEmployee : getAssetAssignments;

      const [list, statsRes] = await Promise.all([
        loadList({ page, pageSize: size, filters }),
        getAssetAssignmentStats(),
      ]);

      setData(list.data || []);
      setTotalPages(list.pagination?.totalPages ?? 1);
      setCurrentPage(list.pagination?.currentPage ?? page);
      setTotalItems(list.pagination?.totalItems ?? 0);
      if (statsRes.success) setStats(statsRes.data);
    } catch (error) {
      console.error("Ошибка при получении имущества:", error.message);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  const handleChangePageSize = (e) => {
    setPageSize(parseInt(e.target.value, 10));
    setCurrentPage(1);
  };

  const handleSearch = (filters = formData) => fetchData(1, filters, pageSize);

  const handleViewChange = (nextView) => {
    if (nextView === view) return;
    setView(nextView);
    setHeaderSort(null);
    setExpandedEmployees([]);
    setCurrentPage(1);
    fetchData(1, formData, pageSize, nextView);
  };

  const toggleEmployee = (employeeId) =>
    setExpandedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId],
    );

  const handleStateChange = (e) => {
    const updated = { ...formData, state: e.target.value };
    setFormData(updated);
    setCurrentPage(1);
    fetchData(1, updated, pageSize);
  };

  const handleDelete = async () => {
    try {
      await deleteAssetAssignmentById(deletingId);
      showAlert(t("success"), "success");
      setDeletingId(null);
      fetchData();
    } catch (error) {
      console.error("Ошибка при удалении имущества:", error.message);
      showAlert(t("error"), "error");
    }
  };

  const handleUndoReturn = async () => {
    try {
      await undoAssetAssignmentReturn(undoingId);
      showAlert(t("success"), "success");
      setUndoingId(null);
      fetchData();
    } catch (error) {
      console.error("Ошибка при отмене возврата:", error.message);
      showAlert(t("error"), "error");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: rows } = await getAssetAssignments({
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        filters: formData,
      });

      if (!rows?.length) {
        showAlert(t("noData"), "error");
        return;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      exportAssetAssignmentsToExcel(rows, `asset-assignments-${stamp}.xlsx`);
    } catch (error) {
      console.error("Ошибка при выгрузке в Excel:", error.message);
      showAlert(t("error"), "error");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!showImportMenu) return;
    const handleClickOutside = (e) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showImportMenu]);

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    downloadAssetAssignmentImportTemplate();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await importAssetAssignmentsExcel(fd);
      setImportResult(result);
      fetchData(1, formData, pageSize);
    } catch (error) {
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setImportLoading(false);
    }
  };

  const stateLabel = {
    assigned: t("stateAssigned"),
    returned: t("stateReturned"),
    scrapped: t("stateScrapped"),
  };

  const sortValue = (item, field) => {
    const emp = item.employee || {};
    switch (field) {
      case "last_name":
        return [emp.last_name, emp.first_name, emp.middle_name]
          .filter(Boolean)
          .join(" ");
      case "quantity":
        return item.quantity ?? 0;
      case "assigned_date":
        return item.assigned_date ? new Date(item.assigned_date).getTime() : 0;
      case "state":
        return stateLabel[item.state] || item.state || "";
      default:
        return item[field] ?? "";
    }
  };

  // клик по заголовку — сортируем только загруженную страницу, без запроса
  const getSortedData = () => {
    if (!headerSort) return data;

    const dir = headerSort.order === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = sortValue(a, headerSort.field);
      const vb = sortValue(b, headerSort.field);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "ru", { sensitivity: "base" }) * dir;
    });
  };

  const handleSort = (field) => {
    setHeaderSort((prev) =>
      prev?.field === field
        ? { field, order: prev.order === "asc" ? "desc" : "asc" }
        : { field, order: "asc" },
    );
  };

  // кнопка сортировки — сортирует всю выборку в БД, поэтому идём на сервер
  const handleSortApply = (sort_by, sort_order) => {
    const updated = { ...formData, sort_by, sort_order };
    setFormData(updated);
    setHeaderSort(null);
    setCurrentPage(1);
    fetchData(1, updated, pageSize);
  };

  const colSpan = canEdit || canDelete ? 9 : 8;

  const renderActions = (item) => (
    <div className={styles.actions}>
      {canEdit && item.state === "assigned" && (
        <ActionButton
          onClick={() => setReturningAssignment(item)}
          icon={IconReturn}
          label={t("returnAsset")}
          variant="download"
        />
      )}
      {canEdit && item.state !== "assigned" && (
        <ActionButton
          onClick={() => setUndoingId(item.id)}
          icon={IconUndoReturn}
          label={t("undoReturn")}
          variant="download"
        />
      )}
      {canEdit && (
        <ActionButton
          onClick={() => setEditingAssignment(item)}
          icon={Icons.edit}
          label={t("editBtn")}
          variant="edit"
        />
      )}
      {canDelete && (
        <ActionButton
          onClick={() => setDeletingId(item.id)}
          icon={Icons.delete}
          label={t("deleteBtn")}
          variant="delete"
        />
      )}
    </div>
  );

  const renderStateCell = (item) => (
    <>
      <span className={`${styles.stateBadge} ${styles[item.state]}`}>
        {stateLabel[item.state] || item.state}
      </span>
      {item.state !== "assigned" && item.return_date && (
        <span className={styles.returnDate}>{formatDate(item.return_date)}</span>
      )}
    </>
  );

  return (
    <div className={styles.page}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          {widgetsVisible && stats && (
            <div
              className={`${styles.statsGridWrap} ${widgetsScrollHidden ? styles.statsGridWrapHidden : ""}`}
            >
              <div className={styles.statsGridInner}>
                <div className={styles.statsGrid}>
                  <StatWidget
                    icon={Package}
                    color="#7c3aed"
                    label={t("statsAssetsTotal")}
                    value={stats.total}
                  />
                  <StatWidget
                    icon={PackageCheck}
                    color="#3b82f6"
                    label={t("statsAssetsAssigned")}
                    value={stats.assigned}
                  />
                  <StatWidget
                    icon={PackageX}
                    color="#059669"
                    label={t("statsAssetsReturned")}
                    value={stats.returned}
                  />
                  <StatWidget
                    icon={Users}
                    color="#f59e0b"
                    label={t("statsAssetsEmployees")}
                    value={stats.employees}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search
                formData={formData}
                setFormData={setFormData}
                onSearch={handleSearch}
              />
              <select
                className={styles.stateSelect}
                value={formData.state}
                onChange={handleStateChange}
              >
                <option value="">{t("all")}</option>
                <option value="assigned">{t("stateAssigned")}</option>
                <option value="returned">{t("stateReturned")}</option>
              </select>

              {view === "viewByRecords" && (
                <SalarySort
                  sort_by={formData.sort_by}
                  sort_order={formData.sort_order}
                  onApply={handleSortApply}
                  fields={SORT_FIELDS}
                />
              )}

              <Switcher
                items={["viewByRecords", "viewByEmployees"]}
                activeItem={view}
                onSelect={handleViewChange}
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
                <Button text={t("assignAsset")} onClick={() => setShowAssignModal(true)} />
              )}
              {canAdd && (
                <div className={styles.importMenuWrapper} ref={importMenuRef}>
                  <button
                    className={styles.importMenuBtn}
                    type="button"
                    disabled={importLoading}
                    onClick={() => !importLoading && setShowImportMenu((v) => !v)}
                  >
                    {importLoading ? (
                      <Loader2 size={16} className={styles.exportSpinner} />
                    ) : (
                      <Upload size={16} />
                    )}
                    {importLoading ? t("loading") : t("importExcel")}
                  </button>

                  {showImportMenu && !importLoading && (
                    <div className={styles.importMenuDropdown}>
                      <button
                        className={styles.importMenuItem}
                        onClick={handleDownloadTemplate}
                      >
                        {t("downloadTemplate")}
                      </button>
                      <button
                        className={styles.importMenuItem}
                        onClick={() => {
                          setShowImportMenu(false);
                          importFileRef.current?.click();
                        }}
                      >
                        {t("importData")}
                      </button>
                    </div>
                  )}

                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={handleImportFile}
                  />
                </div>
              )}

              {/* подпись скрывается только когда шапке не хватает ширины */}
              <button
                className={styles.exportBtn}
                type="button"
                title={t("exportToExcel")}
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 size={16} className={styles.exportSpinner} />
                ) : (
                  <Download size={16} />
                )}
                <span className={styles.exportLabel}>{t("exportToExcel")}</span>
              </button>

              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>
            </div>
          </div>

          <div className={styles.tableContainer} onScroll={handleTableScroll}>
            {view === "viewByEmployees" ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>№</th>
                    <th>{t("custodian")}</th>
                    <th>{t("statsAssetsTotal")}</th>
                    <th>{t("stateAssigned")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.length > 0 ? (
                    data.map((emp, i) => {
                      const assets = emp.assetAssignments || [];
                      const assignedCount = assets.filter(
                        (a) => a.state === "assigned",
                      ).length;
                      const isOpen = expandedEmployees.includes(emp.id);

                      return (
                        <Fragment key={emp.id}>
                          <tr
                            className={styles.employeeRow}
                            onClick={() => toggleEmployee(emp.id)}
                          >
                            <td>{(currentPage - 1) * pageSize + i + 1}</td>
                            <td>
                              <EmployeeCell
                                photo={emp.photo}
                                lastName={emp.last_name}
                                firstName={emp.first_name}
                                middleName={emp.middle_name}
                                id={emp.id}
                                branch={emp.branch?.name}
                                department={emp.department?.name}
                                position={emp.position?.name}
                              />
                            </td>
                            <td>{assets.length}</td>
                            <td>{assignedCount}</td>
                            <td>
                              <span
                                className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                              >
                                {Icons.chevronDown}
                              </span>
                            </td>
                          </tr>

                          {isOpen && (
                            <tr className={styles.nestedRow}>
                              <td colSpan={5}>
                                <table className={styles.innerTable}>
                                  <thead>
                                    <tr>
                                      <th>{t("assetName")}</th>
                                      <th>{t("assetSpec")}</th>
                                      <th>{t("quantity")}</th>
                                      <th>{t("assetCondition")}</th>
                                      <th>{t("assignedDate")}</th>
                                      <th>{t("state")}</th>
                                      {(canEdit || canDelete) && <th>{t("action")}</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {assets.map((item) => (
                                      <tr key={item.id}>
                                        <td>
                                          <span className={styles.assetName}>
                                            {item.asset_name}
                                          </span>
                                          {item.inventory_number && (
                                            <span className={styles.inventoryNumber}>
                                              {t("inventoryNumber")}:{" "}
                                              {item.inventory_number}
                                            </span>
                                          )}
                                        </td>
                                        <td>{item.asset_spec || "—"}</td>
                                        <td>{item.quantity}</td>
                                        <td>{item.asset_condition || "—"}</td>
                                        <td>{formatDate(item.assigned_date)}</td>
                                        <td>{renderStateCell(item)}</td>
                                        {(canEdit || canDelete) && (
                                          <td>{renderActions(item)}</td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5}>{t("noData")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  {SORT_FIELDS.map((f) => (
                    <th
                      key={f.value}
                      className={styles.sortableHeader}
                      onClick={() => handleSort(f.value)}
                    >
                      <span className={styles.headerContent}>
                        {t(f.labelKey)}
                        <SortArrow
                          active={headerSort?.field === f.value}
                          order={headerSort?.order}
                        />
                      </span>
                    </th>
                  ))}
                  {(canEdit || canDelete) && <th>{t("action")}</th>}
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  getSortedData().map((item, i) => (
                    <tr key={item.id}>
                      <td>{(currentPage - 1) * pageSize + i + 1}</td>
                      <td>
                        <EmployeeCell
                          photo={item.employee?.photo}
                          lastName={item.employee?.last_name}
                          firstName={item.employee?.first_name}
                          middleName={item.employee?.middle_name}
                          id={item.employee?.id}
                          branch={item.employee?.branch?.name}
                          department={item.employee?.department?.name}
                          position={item.employee?.position?.name}
                        />
                      </td>
                      <td>
                        <span className={styles.assetName}>{item.asset_name}</span>
                        {item.inventory_number && (
                          <span className={styles.inventoryNumber}>
                            {t("inventoryNumber")}: {item.inventory_number}
                          </span>
                        )}
                      </td>
                      <td>{item.asset_spec || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>{item.asset_condition || "—"}</td>
                      <td>{formatDate(item.assigned_date)}</td>
                      <td>{renderStateCell(item)}</td>
                      {(canEdit || canDelete) && <td>{renderActions(item)}</td>}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={colSpan}>{t("noData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        </div>
      )}

      <CenterModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onAccept={handleDelete}
        message={t("areYouSureDelete")}
      />

      <CenterModal
        isOpen={!!undoingId}
        onClose={() => setUndoingId(null)}
        onAccept={handleUndoReturn}
        tag={t("undoReturn")}
        message={t("undoReturnConfirm")}
      />

      {importResult && (
        <div className={styles.importOverlay} onClick={() => setImportResult(null)}>
          <div className={styles.importModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.importModalHeader}>
              <span>{t("importResult")}</span>
              <button onClick={() => setImportResult(null)}>{Icons.clear}</button>
            </div>
            <div className={styles.importModalBody}>
              <p>
                ✓ {t("created")}: <strong>{importResult.created ?? 0}</strong>
              </p>
              {importResult.errors?.length > 0 && (
                <>
                  <p style={{ color: "#ef4444", marginTop: 12 }}>
                    ✗ {t("errors")}: <strong>{importResult.errors.length}</strong>
                  </p>
                  <ul
                    style={{
                      fontSize: 13,
                      color: "#ef4444",
                      paddingLeft: 16,
                      marginTop: 4,
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    {importResult.errors.map((err, i) => (
                      <li key={i}>
                        {t("row")} {err.row}: {err.error || err.code}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <AssignAssetModal
          onClose={() => setShowAssignModal(false)}
          onSaved={() => fetchData(1, formData, pageSize)}
        />
      )}

      {editingAssignment && (
        <AssignAssetModal
          editAssignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          onSaved={() => {
            setEditingAssignment(null);
            fetchData();
          }}
        />
      )}

      {returningAssignment && (
        <ReturnAssetModal
          assignment={returningAssignment}
          onClose={() => setReturningAssignment(null)}
          onSaved={() => {
            setReturningAssignment(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default AssetAssignmentsPage;
