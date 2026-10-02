import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  UtensilsCrossed,
  Utensils,
  Users,
  CheckCircle,
  XCircle,
} from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";
import {
  deleteCanteenAllowanceById,
  getCanteenAllowances,
  getCanteenStats,
} from "../api";

import AddCanteenAllowance from "../components/AddCanteenAllowance";
import EditCanteenAllowance from "../components/EditCanteenAllowance";
import Button from "../components/Button";
import CenterModal from "../components/CenterModal";
import EmployeeCell from "../components/EmployeeCell";
import Loading from "../components/Loading";
import OverlaySidebar from "../components/OverlaySidebar";
import Pagination from "../components/Pagination";
import Search from "../components/Search";
import { ActionCell } from "../components/ActionButtons";
import SortArrow from "../components/SortArrow";
import { Icons } from "../icons/icons";

import styles from "./CanteenPage.module.scss";
import { useWidgetsStore } from "../stores/widgetsStore";

const StatWidget = ({ icon: Icon, color, label, value, sub }) => (
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
          {value}
          {sub && <span className={styles.statWidgetSub}> {sub}</span>}
        </span>
      </div>
    </div>
  </div>
);

const CanteenAllowancesPage = () => {
  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const { showAlert } = useAlertStore();

  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [modalType, setModalType] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({ search: "", status: "" });
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
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
  ) => {
    setLoading(true);
    try {
      const [list, statsRes] = await Promise.all([
        getCanteenAllowances({ page, pageSize: size, filters }),
        getCanteenStats(),
      ]);
      setData(list.data);
      setTotalPages(list.pagination?.totalPages ?? 1);
      setCurrentPage(list.pagination?.currentPage ?? page);
      setTotalItems(list.pagination?.totalItems ?? 0);
      if (statsRes.success) setStats(statsRes.data);
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  const handleFilterChange = (e) => {
    const next = { ...formData, [e.target.name]: e.target.value };
    setFormData(next);
    setCurrentPage(1);
    fetchData(1, next, pageSize);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage((prev) => Math.min(prev, Math.ceil(totalItems / size) || 1));
  };

  const handleDelete = async (id) => {
    try {
      await deleteCanteenAllowanceById(id);
      showAlert(t("success"), "success");
      setShowDeleteModal(false);
      fetchData();
    } catch (error) {
      console.error("Ошибка при удалении:", error);
      showAlert(t("error"), "error");
    }
  };

  const closeSidebar = () => {
    setModalType(null);
    setSelectedItem(null);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortedData = () => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

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
                    icon={Users}
                    color="#6366f1"
                    label={t("employeesWithAllowance")}
                    value={stats.total}
                  />
                  <StatWidget
                    icon={UtensilsCrossed}
                    color="#f59e0b"
                    label={t("dailyCapacity")}
                    value={stats.dailyCapacity}
                  />
                  <StatWidget
                    icon={CheckCircle}
                    color="#10b981"
                    label={t("servedToday")}
                    value={stats.servedToday}
                  />
                  <StatWidget
                    icon={Utensils}
                    color="#0ea5e9"
                    label={t("remainingToday")}
                    value={stats.remainingToday ?? 0}
                  />
                  <StatWidget
                    icon={XCircle}
                    color="#ef4444"
                    label={t("deniedToday")}
                    value={stats.deniedToday}
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
              <div className={styles.filterField}>
                <label>{t("status")}</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFilterChange}
                >
                  <option value="">{t("all")}</option>
                  <option value="true">{t("enabled")}</option>
                  <option value="false">{t("disabled")}</option>
                </select>
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
              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>
            </div>
          </div>

          <div className={styles.tableContainer} onScroll={handleTableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th className={styles.employeeCol} onClick={() => handleSort("employeeFullName")}>
                    <span className={styles.headerContent}>
                      {t("employee")}
                      <SortArrow active={sortField === "employeeFullName"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("employeeNumber")}>
                    <span className={styles.headerContent}>
                      {t("employeeNumber")}
                      <SortArrow active={sortField === "employeeNumber"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("daily_limit")}>
                    <span className={styles.headerContent}>
                      {t("dailyPortionLimit")}
                      <SortArrow active={sortField === "daily_limit"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("used_today")}>
                    <span className={styles.headerContent}>
                      {t("usedToday")}
                      <SortArrow active={sortField === "used_today"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("remaining_today")}>
                    <span className={styles.headerContent}>
                      {t("remainingToday")}
                      <SortArrow active={sortField === "remaining_today"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("note")}>
                    <span className={styles.headerContent}>
                      {t("note")}
                      <SortArrow active={sortField === "note"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("status")}>
                    <span className={styles.headerContent}>
                      {t("status")}
                      <SortArrow active={sortField === "status"} order={sortOrder} />
                    </span>
                  </th>
                  {(canEdit || canDelete) && <th>{t("action")}</th>}
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  getSortedData().map((item, i) => (
                    <tr key={item.id}>
                      <td>{(currentPage - 1) * pageSize + i + 1}</td>
                      <td className={styles.nameCell}>
                        <EmployeeCell
                          photo={item.employeePhoto}
                          fullName={item.employeeFullName}
                          id={item.employee_id}
                          branch={item.branchName}
                          department={item.departmentName}
                          active={item.employee_status !== false}
                        />
                      </td>
                      <td>{item.employeeNumber || "—"}</td>
                      <td style={{ fontWeight: 600 }}>{item.daily_limit}</td>
                      <td>{item.used_today}</td>
                      <td
                        className={styles.remainingCell}
                        style={{
                          color:
                            item.remaining_today > 0 ? "#10b981" : "#ef4444",
                        }}
                      >
                        {item.remaining_today}
                      </td>
                      <td className={styles.mutedCell}>{item.note || "—"}</td>
                      <td>
                        <span
                          className={styles.statusBadge}
                          style={{
                            background: item.status ? "#10b98120" : "#ef444420",
                            color: item.status ? "#10b981" : "#ef4444",
                          }}
                        >
                          {item.status ? t("enabled") : t("disabled")}
                        </span>
                      </td>
                      <ActionCell
                        item={item}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={(id) => {
                          setSelectedItem(id);
                          setModalType("edit");
                        }}
                        onDelete={(id) => {
                          setSelectedItem(id);
                          setShowDeleteModal(true);
                        }}
                      />
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canEdit || canDelete ? 9 : 8}>
                      {t("noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CenterModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onAccept={() => handleDelete(selectedItem)}
        message={t("areYouSureDelete")}
      />

      <OverlaySidebar
        isOpen={modalType !== null}
        onClose={closeSidebar}
        width={modalType === "add" ? "640px" : "500px"}
      >
        {modalType === "add" && (
          <AddCanteenAllowance
            handleClose={closeSidebar}
            onSuccess={() => fetchData()}
          />
        )}
        {modalType === "edit" && selectedItem && (
          <EditCanteenAllowance
            id={selectedItem}
            handleClose={closeSidebar}
            onSuccess={() => fetchData()}
          />
        )}
      </OverlaySidebar>
    </div>
  );
};

export default CanteenAllowancesPage;
