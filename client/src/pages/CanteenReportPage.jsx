import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { ListChecks, Trash2, X } from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";
import {
  bulkDeleteCanteenMeals,
  deleteCanteenMealById,
  getCanteenDevices,
  getCanteenMeals,
  getCanteenReport,
} from "../api";

import CenterModal from "../components/CenterModal";
import EmployeeCell from "../components/EmployeeCell";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import Search from "../components/Search";
import { ActionCell } from "../components/ActionButtons";
import SortArrow from "../components/SortArrow";
import { Icons } from "../icons/icons";

import styles from "./CanteenPage.module.scss";

const GROUP_OPTIONS = ["employee", "department", "branch"];

// Колонка «сотрудников получили» имеет смысл только там, где строка —
// коллектив: у группировки по сотруднику это всегда 0 или 1
const SUMMARY_GROUPS = ["branch", "department"];

const CanteenReportPage = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const currentPath = window.location.pathname;
  const { canDelete } = usePermissions(currentPath);

  const [tab, setTab] = useState("summary");
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [summarySortField, setSummarySortField] = useState(null);
  const [summarySortOrder, setSummarySortOrder] = useState("asc");
  const [journalSortField, setJournalSortField] = useState(null);
  const [journalSortOrder, setJournalSortOrder] = useState("asc");

  const [report, setReport] = useState({ data: [], totals: null });
  const [meals, setMeals] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);

  const [formData, setFormData] = useState({
    date_from: dayjs().format("YYYY-MM-DD"),
    date_to: dayjs().format("YYYY-MM-DD"),
    group_by: "employee",
    device_id: "",
    status: "",
    search: "",
  });

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await getCanteenDevices();
        if (res.success) setDevices(res.data);
      } catch (error) {
        console.error("Ошибка при получении терминалов:", error.message);
      }
    };
    fetchDevices();
  }, []);

  const fetchSummary = async (filters = formData) => {
    setLoading(true);
    try {
      const res = await getCanteenReport({ filters: JSON.stringify(filters) });
      setReport({ data: res.data || [], totals: res.totals || null });
    } catch (error) {
      console.error("Ошибка при получении отчёта:", error.message);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMeals = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const res = await getCanteenMeals({
        page,
        pageSize: size,
        filters: JSON.stringify(filters),
      });
      setMeals(res.data || []);
      setTotalPages(res.pagination?.totalPages ?? 1);
      setCurrentPage(res.pagination?.currentPage ?? page);
      setTotalItems(res.pagination?.totalItems ?? 0);
    } catch (error) {
      console.error("Ошибка при получении журнала:", error.message);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // выделение живёт в пределах одной страницы журнала
    setSelectedIds([]);
    if (tab === "summary") fetchSummary();
    else fetchMeals(currentPage);
  }, [tab, currentPage, pageSize]);

  const applyFilters = (next) => {
    setSelectedIds([]);
    setFormData(next);
    if (tab === "summary") fetchSummary(next);
    else {
      setCurrentPage(1);
      fetchMeals(1, next, pageSize);
    }
  };

  const handleFilterChange = (e) => {
    applyFilters({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSearch = (data = formData) => applyFilters(data);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage((prev) => Math.min(prev, Math.ceil(totalItems / size) || 1));
  };

  // Ошибочный проход: удаление возвращает списанную порцию в остаток дня
  const handleDeleteMeal = async (id) => {
    try {
      await deleteCanteenMealById(id);
      showAlert(t("success"), "success");
      setShowDeleteModal(false);
      setSelectedMeal(null);
      fetchMeals(currentPage);
    } catch (error) {
      console.error("Ошибка при удалении прохода:", error.message);
      showAlert(t("error"), "error");
    }
  };

  const toggleSelectMode = () => {
    setSelectMode((prev) => {
      if (prev) setSelectedIds([]);
      return !prev;
    });
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleAll = () => {
    const pageIds = meals.map((meal) => meal.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : pageIds);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await bulkDeleteCanteenMeals(selectedIds);
      showAlert(`${t("success")}: ${res.deleted}`, "success");
      setShowBulkDeleteModal(false);
      setSelectedIds([]);
      fetchMeals(currentPage);
    } catch (error) {
      console.error("Ошибка при массовом удалении проходов:", error.message);
      showAlert(t("error"), "error");
    }
  };

  const selectable = tab === "journal" && canDelete && selectMode;

  // № + 6 колонок данных, плюс чекбокс и действия, когда они показаны
  const journalCols = 7 + (canDelete ? 1 : 0) + (selectable ? 1 : 0);

  const groupLabel = {
    employee: t("employee"),
    department: t("department"),
    branch: t("branch"),
  }[formData.group_by];

  const showEmployeesColumn = SUMMARY_GROUPS.includes(formData.group_by);

  // Группировка по сотруднику — строка это человек, рисуем карточкой
  const byEmployee = formData.group_by === "employee";

  const exportToExcel = () => {
    const period = `${formData.date_from} — ${formData.date_to}`;
    const header = [
      groupLabel,
      t("portionNorm"),
      t("servedPortions"),
      t("deniedPortions"),
      ...(showEmployeesColumn ? [t("employeesServed")] : []),
    ];

    const rows = report.data.map((row) => [
      row.label,
      row.allowance,
      row.served,
      row.denied,
      ...(showEmployeesColumn ? [row.employees_served] : []),
    ]);

    const totals = report.totals
      ? [
          [
            t("total"),
            report.totals.allowance,
            report.totals.served,
            report.totals.denied,
            ...(showEmployeesColumn ? [report.totals.employees_served] : []),
          ],
        ]
      : [];

    const sheet = XLSX.utils.aoa_to_sheet([
      [t("canteen-report")],
      [period],
      [],
      header,
      ...rows,
      ...totals,
    ]);
    sheet["!cols"] = header.map((_, i) => ({ wch: i === 0 ? 34 : 16 }));

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "canteen");
    const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `canteen-${formData.date_from}_${formData.date_to}.xlsx`,
    );
  };

  const sortRows = (rows, field, order) => {
    if (!field) return rows;
    return [...rows].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return order === "asc" ? aNum - bNum : bNum - aNum;
      }

      return order === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  const toggleSort = (field, current, setField, setOrder) => {
    if (current === field) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setField(field);
      setOrder("asc");
    }
  };

  const handleSummarySort = (field) =>
    toggleSort(field, summarySortField, setSummarySortField, setSummarySortOrder);
  const handleJournalSort = (field) =>
    toggleSort(field, journalSortField, setJournalSortField, setJournalSortOrder);

  const sortedSummary = sortRows(report.data, summarySortField, summarySortOrder);
  const sortedMeals = sortRows(meals, journalSortField, journalSortOrder);

  const denyText = (reason) =>
    reason === "limit_reached"
      ? t("canteenLimitReached")
      : t("canteenNoAllowance");

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === "summary" ? styles.tabActive : ""}`}
            onClick={() => setTab("summary")}
          >
            {t("summary")}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "journal" ? styles.tabActive : ""}`}
            onClick={() => setTab("journal")}
          >
            {t("journal")}
          </button>
        </div>

        <div className={styles.mainHeader}>
          <div className={styles.filterWrapper}>
            <Search
              formData={formData}
              setFormData={setFormData}
              onSearch={handleSearch}
            />

            <div className={styles.filterField}>
              <label>{t("dateFrom")}</label>
              <input
                type="date"
                name="date_from"
                value={formData.date_from}
                onChange={handleFilterChange}
              />
            </div>

            <div className={styles.filterField}>
              <label>{t("dateTo")}</label>
              <input
                type="date"
                name="date_to"
                value={formData.date_to}
                onChange={handleFilterChange}
              />
            </div>

            {tab === "summary" ? (
              <div className={styles.filterField}>
                <label>{t("groupBy")}</label>
                <select
                  name="group_by"
                  value={formData.group_by}
                  onChange={handleFilterChange}
                >
                  {GROUP_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {
                        {
                          employee: t("employee"),
                          department: t("department"),
                          branch: t("branch"),
                        }[option]
                      }
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className={styles.filterField}>
                <label>{t("status")}</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFilterChange}
                >
                  <option value="">{t("all")}</option>
                  <option value="served">{t("canteenServed")}</option>
                  <option value="denied">{t("canteenDenied")}</option>
                </select>
              </div>
            )}

            <div className={styles.filterField}>
              <label>{t("faceDevice")}</label>
              <select
                name="device_id"
                value={formData.device_id}
                onChange={handleFilterChange}
              >
                <option value="">{t("all")}</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name || device.device_ip}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tab === "journal" && (
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              handleChangePageSize={handleChangePageSize}
              handlePageChange={handlePageChange}
            />
          )}

          <div className={styles.buttonsWrapper}>
            {tab === "journal" && canDelete && (
              <button
                type="button"
                className={`${styles.selectModeBtn} ${
                  selectMode ? styles.selectModeActive : ""
                }`}
                onClick={toggleSelectMode}
              >
                <ListChecks size={16} />
                {t("selectMode")}
              </button>
            )}
            {tab === "summary" && (
              <button
                type="button"
                className={styles.exportBtn}
                onClick={exportToExcel}
                disabled={report.data.length === 0}
              >
                {Icons.excel}
                {t("exportExcel")}
              </button>
            )}
            <div
              className={styles.refreshBtn}
              onClick={() =>
                tab === "summary" ? fetchSummary() : fetchMeals(currentPage)
              }
            >
              {Icons.refresh}
            </div>
          </div>
        </div>

        {selectable && selectedIds.length > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>
              {t("selected")}: <b>{selectedIds.length}</b>
            </span>
            <button
              type="button"
              className={styles.bulkDeleteBtn}
              onClick={() => setShowBulkDeleteModal(true)}
            >
              <Trash2 size={15} />
              {t("delete")}
            </button>
            <button
              type="button"
              className={styles.bulkClearBtn}
              onClick={() => setSelectedIds([])}
            >
              <X size={14} />
              {t("clearSelection")}
            </button>
          </div>
        )}

        {loading ? (
          <Loading />
        ) : (
          <div className={styles.tableContainer}>
            {tab === "summary" ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>№</th>
                    <th
                      className={byEmployee ? styles.employeeCol : undefined}
                      onClick={() => handleSummarySort("label")}
                    >
                      <span className={styles.headerContent}>
                        {groupLabel}
                        <SortArrow active={summarySortField === "label"} order={summarySortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSummarySort("allowance")}>
                      <span className={styles.headerContent}>
                        {t("portionNorm")}
                        <SortArrow active={summarySortField === "allowance"} order={summarySortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSummarySort("served")}>
                      <span className={styles.headerContent}>
                        {t("servedPortions")}
                        <SortArrow active={summarySortField === "served"} order={summarySortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSummarySort("denied")}>
                      <span className={styles.headerContent}>
                        {t("deniedPortions")}
                        <SortArrow active={summarySortField === "denied"} order={summarySortOrder} />
                      </span>
                    </th>
                    {showEmployeesColumn && (
                      <th onClick={() => handleSummarySort("employees_served")}>
                        <span className={styles.headerContent}>
                          {t("employeesServed")}
                          <SortArrow active={summarySortField === "employees_served"} order={summarySortOrder} />
                        </span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.data.length > 0 ? (
                    sortedSummary.map((row, i) => (
                      <tr key={row.key}>
                        <td>{i + 1}</td>
                        <td className={styles.nameCell}>
                          {byEmployee ? (
                            <EmployeeCell
                              photo={row.employeePhoto}
                              fullName={row.label}
                              id={row.employee_id}
                              branch={row.branchName}
                              department={row.departmentName}
                              active={row.employee_status !== false}
                            />
                          ) : (
                            row.label
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{row.allowance}</td>
                        <td style={{ fontWeight: 700, color: "#10b981" }}>
                          {row.served}
                        </td>
                        <td style={{ color: row.denied ? "#ef4444" : "" }}>
                          {row.denied}
                        </td>
                        {showEmployeesColumn && (
                          <td>{row.employees_served}</td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={showEmployeesColumn ? "6" : "5"}>
                        {t("noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
                {report.totals && report.data.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan="2">{t("total")}</td>
                      <td>{report.totals.allowance}</td>
                      <td>{report.totals.served}</td>
                      <td>{report.totals.denied}</td>
                      {showEmployeesColumn && (
                        <td>{report.totals.employees_served}</td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    {selectable && (
                      <th className={styles.checkCol}>
                        <input
                          type="checkbox"
                          checked={
                            meals.length > 0 &&
                            meals.every((meal) =>
                              selectedIds.includes(meal.id),
                            )
                          }
                          onChange={handleToggleAll}
                        />
                      </th>
                    )}
                    <th>№</th>
                    <th onClick={() => handleJournalSort("meal_date")}>
                      <span className={styles.headerContent}>
                        {t("date")}
                        <SortArrow active={journalSortField === "meal_date"} order={journalSortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleJournalSort("date")}>
                      <span className={styles.headerContent}>
                        {t("time")}
                        <SortArrow active={journalSortField === "date"} order={journalSortOrder} />
                      </span>
                    </th>
                    <th className={styles.employeeCol} onClick={() => handleJournalSort("employeeFullName")}>
                      <span className={styles.headerContent}>
                        {t("employee")}
                        <SortArrow active={journalSortField === "employeeFullName"} order={journalSortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleJournalSort("deviceName")}>
                      <span className={styles.headerContent}>
                        {t("faceDevice")}
                        <SortArrow active={journalSortField === "deviceName"} order={journalSortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleJournalSort("status")}>
                      <span className={styles.headerContent}>
                        {t("status")}
                        <SortArrow active={journalSortField === "status"} order={journalSortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleJournalSort("daily_limit")}>
                      <span className={styles.headerContent}>
                        {t("dailyPortionLimit")}
                        <SortArrow active={journalSortField === "daily_limit"} order={journalSortOrder} />
                      </span>
                    </th>
                    {canDelete && <th>{t("action")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {meals.length > 0 ? (
                    sortedMeals.map((meal, i) => (
                      <tr
                        key={meal.id}
                        className={
                          selectedIds.includes(meal.id)
                            ? styles.selectedRow
                            : ""
                        }
                      >
                        {selectable && (
                          <td className={styles.checkCol}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(meal.id)}
                              onChange={() => handleToggleSelect(meal.id)}
                            />
                          </td>
                        )}
                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                        <td>{meal.meal_date}</td>
                        <td>
                          {dayjs(meal.date).format("HH:mm:ss")}
                        </td>
                        <td className={styles.nameCell}>
                          <EmployeeCell
                            photo={meal.employeePhoto}
                            fullName={meal.employeeFullName}
                            id={meal.employee_id}
                            branch={meal.branchName}
                            department={meal.departmentName}
                            active={meal.employee_status !== false}
                          />
                        </td>
                        <td>{meal.deviceName || "—"}</td>
                        <td>
                          <span
                            className={styles.statusBadge}
                            style={{
                              background:
                                meal.status === "served"
                                  ? "#10b98120"
                                  : "#ef444420",
                              color:
                                meal.status === "served" ? "#10b981" : "#ef4444",
                            }}
                          >
                            {meal.status === "served"
                              ? t("canteenServed")
                              : denyText(meal.deny_reason)}
                          </span>
                        </td>
                        <td>{meal.daily_limit}</td>
                        <ActionCell
                          item={meal}
                          canDelete={canDelete}
                          onDelete={(id) => {
                            setSelectedMeal(id);
                            setShowDeleteModal(true);
                          }}
                        />
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={journalCols}>{t("noData")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <CenterModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedMeal(null);
        }}
        onAccept={() => handleDeleteMeal(selectedMeal)}
        message={t("areYouSureDelete")}
      />

      <CenterModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onAccept={handleBulkDelete}
        message={`${t("areYouSureDelete")} (${selectedIds.length})`}
      />
    </div>
  );
};

export default CanteenReportPage;
