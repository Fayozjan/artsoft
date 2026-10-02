import axios from "axios";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  UserMinus,
  Cake,
  Venus,
  Mars,
  CircleHelp,
  List,
  Building2,
  ArrowLeft,
  Upload,
  RefreshCw,
  ListChecks,
} from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import { useFilterDataStore } from "../stores/filterDataStore";
import { usePermissions } from "../hooks/usePermissions";
import { EmployeeService } from "../api";
import { getAssetAssignments } from "../api/assetAssignments";
import {
  downloadEmployeeImportTemplate,
  exportEmployeesToExcel,
} from "../utils/DocGenerator";

import Button from "../components/Button";
import Loading from "../components/Loading";
import AddEmployee from "../components/AddEmployee";
import EditEmployee from "../components/EditEmployee";
import EmployeesTable from "../components/EmployeesTable";
import SortArrow from "../components/SortArrow";
import DepartmentCards from "../components/DepartmentCards";
import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import { useImagePreviewStore } from "../stores/imagePreviewStore";
import Pagination from "../components/Pagination";
import EmployeeFilter from "../components/EmployeeFilter";
import SalarySort from "../components/SalarySort";
import DownloadButton from "../components/DownloadButton";
import AddEmploymentOrder from "../components/AddEmploymentOrder";
import BulkChangeWorkSchedule from "../components/BulkChangeWorkSchedule";
import BulkAssignDoors from "../components/BulkAssignDoors";
import BulkTerminate from "../components/BulkTerminate";
import BulkEditPlacement from "../components/BulkEditPlacement";
import EmployeeBulkBar from "../components/EmployeeBulkBar";
import EmployeeProfile from "../components/EmployeeProfile";
import TerminationBlockedModal from "../components/TerminationBlockedModal";

import Search from "../components/Search";
import searchStyles from "../components/Search.module.scss";
import styles from "./EmployeesPage.module.scss";
import { Icons } from "../icons/icons";
import { useAuthStore } from "../stores/authStore";
import { useHideBranch } from "../hooks/useHideBranch";
import { useFitLabels } from "../hooks/useFitLabels";
import { useWidgetsStore } from "../stores/widgetsStore";

const StatWidget = ({
  icon: Icon,
  color,
  label,
  value,
  sub,
  progress,
  onClick,
}) => (
  <div
    className={`${styles.statWidget} ${onClick ? styles.statWidgetClickable : ""}`}
    onClick={onClick}
  >
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

const GenderWidget = ({ gender, total, t }) => {
  const rows = [
    { key: "male", icon: Mars, color: "#3b82f6", count: gender.male },
    { key: "female", icon: Venus, color: "#ec4899", count: gender.female },
    {
      key: "unspecified",
      icon: CircleHelp,
      color: "#94a3b8",
      count: gender.unspecified,
    },
  ].filter((r) => r.count > 0);

  if (!rows.length) return null;

  return (
    <div className={styles.statWidget}>
      <div className={styles.statWidgetInner}>
        <div
          className={styles.statWidgetIcon}
          style={{ background: "#8b5cf618" }}
        >
          <Users size={15} color="#8b5cf6" strokeWidth={2} />
        </div>
        <div className={styles.statWidgetContent}>
          <span className={styles.statWidgetLabel}>{t("statsGender")}</span>
          <div className={styles.genderLegend}>
            {rows.map((r) => (
              <span
                key={r.key}
                className={styles.genderLegendItem}
                style={{ color: r.color }}
                title={`${Math.round((r.count / total) * 100)}%`}
              >
                <r.icon size={11} strokeWidth={2.5} />
                {r.count}
              </span>
            ))}
          </div>
        </div>
      </div>

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
    </div>
  );
};

const BirthdayModal = ({ list, onClose, t }) => {
  const openImagePreview = useImagePreviewStore((s) => s.open);
  const hideBranch = useHideBranch();
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedList = [...list].sort((a, b) => {
    if (!sortField) {
      const dobA = new Date(a.date_of_birth);
      const dobB = new Date(b.date_of_birth);
      return (
        dobA.getUTCMonth() * 100 +
        dobA.getUTCDate() -
        (dobB.getUTCMonth() * 100 + dobB.getUTCDate())
      );
    }

    let aVal = a[sortField];
    let bVal = b[sortField];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (sortField === "date_of_birth") {
      const dobA = new Date(aVal);
      const dobB = new Date(bVal);
      const cmp =
        dobA.getUTCMonth() * 100 +
        dobA.getUTCDate() -
        (dobB.getUTCMonth() * 100 + dobB.getUTCDate());
      return sortOrder === "asc" ? cmp : -cmp;
    }

    return sortOrder === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  return (
    <div className={styles.bdModalOverlay} onClick={onClose}>
      <div className={styles.bdModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.bdModalHeader}>
          <div className={styles.bdModalHeaderLeft}>
            <div>
              <div className={styles.bdModalHeaderTitle}>
                {t("statsBirthdaysWeek")}
              </div>
            </div>
          </div>
          <button className={styles.bdModalClose} onClick={onClose}>
            {Icons.clear}
          </button>
        </div>

        <div className={styles.bdTableWrapper}>
          <table className={styles.bdTable}>
            <thead>
              <tr>
                <th>#</th>
                <th onClick={() => handleSort("full_name")}>
                  <span className={styles.headerContent}>
                    {t("fullName")}
                    <SortArrow
                      active={sortField === "full_name"}
                      order={sortOrder}
                    />
                  </span>
                </th>
                <th onClick={() => handleSort("position")}>
                  <span className={styles.headerContent}>
                    {t("position")}
                    <SortArrow
                      active={sortField === "position"}
                      order={sortOrder}
                    />
                  </span>
                </th>
                <th onClick={() => handleSort("date_of_birth")}>
                  <span className={styles.headerContent}>
                    {t("dateOfBirth")}
                    <SortArrow
                      active={sortField === "date_of_birth"}
                      order={sortOrder}
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedList.map((emp, idx) => {
                const dob = new Date(emp.date_of_birth);
                const m = dob.getUTCMonth() + 1;
                const d = dob.getUTCDate();
                const isToday = m === todayMonth && d === todayDay;
                const dobStr = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;

                return (
                  <tr key={emp.id} className={isToday ? styles.bdRowToday : ""}>
                    <td className={styles.bdColNum}>{idx + 1}</td>
                    <td className={styles.bdColName}>
                      <div className={styles.empCell}>
                        <div
                          className={`${styles.empAvatar} ${emp.status === false ? styles.inactive : ""}`}
                        >
                          {emp.photo ? (
                            <img
                              src={`/api/employees/image/${emp.photo}`}
                              alt="employee"
                              className={styles.empPhoto}
                              onClick={() =>
                                openImagePreview(
                                  `/api/employees/image/${emp.photo}`,
                                )
                              }
                              style={{ cursor: "pointer" }}
                            />
                          ) : (
                            <div
                              className={`${styles.empInitials} ${emp.status === false ? styles.inactiveInitials : ""}`}
                            >
                              {(emp.full_name || "")
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((w) => w[0])
                                .join("")
                                .toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className={styles.empInfo}>
                          <span className={styles.empName}>
                            {(emp.full_name || "").replace(/\s+\(?\d+\)?$/, "")}
                            <span className={styles.empId}> ({emp.id})</span>
                          </span>
                          <span className={styles.empSub}>
                            {[hideBranch ? null : emp.branch, emp.department]
                              .filter(Boolean)
                              .join(" / ")}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={styles.bdColPos}>{emp.position || "—"}</td>
                    <td className={styles.bdColDate}>
                      <span className={styles.bdDateChip}>{dobStr}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const formatBlockers = (blockers, t) => {
  const reasons = [];
  if (blockers.hasUser) reasons.push(t("deleteBlockedUser"));
  if (blockers.payrollItems > 0)
    reasons.push(`${t("deleteBlockedPayroll")} (${blockers.payrollItems})`);
  if (blockers.tasksAssigned > 0)
    reasons.push(`${t("deleteBlockedTasks")} (${blockers.tasksAssigned})`);
  if (blockers.directedBranches > 0)
    reasons.push(
      `${t("deleteBlockedDirector")} (${blockers.directedBranches})`,
    );
  return reasons.join(", ");
};

const EmployeesPage = () => {
  const { deleteUser, branches, departments, positions, fetchAllData } =
    useFilterDataStore();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [stats, setStats] = useState(null);
  const [showBdModal, setShowBdModal] = useState(false);
  const [data, setData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const { showAlert } = useAlertStore();
  const { t, i18n } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const navigate = useNavigate();
  const [employmentOrderType, setEmploymentOrderType] = useState("");
  const isLeftPanelOpen = Boolean(employmentOrderType);
  const [leftPanelType, setLeftPanelType] = useState("");
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  // кнопку «Перейти к имуществу» показываем только при доступе к этой странице
  const { canView: canViewAssets } = usePermissions("/asset-assignments");
  const updateEmployeeDataRef = useRef(() => {});
  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};

  const [formData, setFormData] = useState({
    branch_id: "",
    department_id: "",
    employee_id: "",
    position_id: "",
    status: "true",
    gender: "",
    has_work_schedule: "",
  });
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importFileRef = useRef(null);
  const importMenuRef = useRef(null);
  const mainHeaderRef = useRef(null);
  const [widgetsScrollHidden, setWidgetsScrollHidden] = useState(false);
  const lastScrollTopRef = useRef(0);
  // скрытие/показ виджета меняет высоту tableContainer -> браузер сам
  // подправляет scrollTop -> это тоже приходит как scroll-событие и без
  // подавления вызывает бесконечный hide/show (мигание), особенно внизу списка
  const suppressNextScrollRef = useRef(false);

  // Виджеты прячутся при скролле вниз; появляются снова только у самого
  // верха таблицы.
  const handleTableScroll = (e) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const lastScrollTop = lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    if (suppressNextScrollRef.current) {
      suppressNextScrollRef.current = false;
      return;
    }

    const setHidden = (value) => {
      if (widgetsScrollHidden === value) return;
      suppressNextScrollRef.current = true;
      setWidgetsScrollHidden(value);
    };

    // мало данных — почти нечего скроллить
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll < 40) {
      setHidden(false);
      return;
    }

    const delta = scrollTop - lastScrollTop;
    if (scrollTop <= 0) {
      setHidden(false);
    } else if (delta > 8) {
      setHidden(true);
    }
  };
  // Подписи у кнопок экспорта/импорта — только если строка помещается.
  const labelsExpanded = useFitLabels(mainHeaderRef, i18n.language);
  const [viewType, setViewType] = useState(
    () => localStorage.getItem("employeesViewType") || "list",
  );
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  // режим выделения: чекбоксы и клик-по-строке-как-выбор включаются только в нём
  const [selectMode, setSelectMode] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState(null);
  // предпросмотр массового удаления: что удалится и кого удалить нельзя
  const [bulkDeleteImpact, setBulkDeleteImpact] = useState(null);
  // список сотрудников фиксируется на момент открытия панели: перезагрузка
  // таблицы сбрасывает selectedIds, а открытая форма должна работать со своим набором
  const [bulkIds, setBulkIds] = useState([]);
  // подтверждение массовой синхронизации: запрос уходит на физические терминалы
  const [syncConfirmCount, setSyncConfirmCount] = useState(0);
  const [profileId, setProfileId] = useState(null);
  // невозвращённое имущество, из-за которого увольнение заблокировано
  const [terminationBlock, setTerminationBlock] = useState(null);

  const fetchEmployees = async (
    page = 1,
    customFormData = formData,
    customPageSize = pageSize,
  ) => {
    setLoading(true);
    try {
      const { data: employees, pagination } = await EmployeeService.getAll({
        ...customFormData,
        page,
        pageSize: customPageSize,
      });
      setData(employees || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotalItems(pagination?.totalItems || 0);
      setCurrentPage(page);
      setSelectedIds([]);
    } catch (err) {
      console.error("Ошибка загрузки данных:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await EmployeeService.getStats();
      if (res.success) setStats(res.stats);
    } catch (err) {
      console.error("Ошибка загрузки статистики:", err.message);
    }
  };

  useEffect(() => {
    fetchEmployees(1, formData, pageSize);
    fetchStats();
    if (!branches.length) fetchAllData();
  }, []);

  useEffect(() => {
    if (viewMode === "branch") {
      fetchEmployees(1, formData, pageSize);
    }
  }, [activeBranchId]);

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

  const handleSetUpdateFunction = (fn) => {
    updateEmployeeDataRef.current = fn;
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
    const pageIds = data.map((it) => it.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !pageIds.includes(id))
        : [...new Set([...selectedIds, ...pageIds])],
    );
  };

  const handleViewTypeChange = (mode) => {
    setViewType(mode);
    localStorage.setItem("employeesViewType", mode);
    if (mode === "list") {
      setSelectedDepartment(null);
      const updated = { ...formData, department_id: "" };
      setFormData(updated);
      fetchEmployees(1, updated, pageSize);
    }
  };

  const handleDepartmentSelect = (dept) => {
    setSelectedDepartment(dept);
    const updated = { ...formData, department_id: dept.id };
    setFormData(updated);
    fetchEmployees(1, updated, pageSize);
  };

  const handleBackToDepartments = () => {
    setSelectedDepartment(null);
    const updated = { ...formData, department_id: "" };
    setFormData(updated);
  };

  const handleSearch = (data = formData) => {
    fetchEmployees(1, { ...data }, pageSize);
  };

  const handleSortApply = (sort_by, sort_order) => {
    const updated = { ...formData, sort_by, sort_order };
    setFormData(updated);
    fetchEmployees(1, updated, pageSize);
  };

  const handleEditClick = (id) => {
    setSelectedItem(id);
    setModalType("edit");
  };

  const handleDeleteClick = async (id) => {
    setSelectedItem(id);
    try {
      const impact = await EmployeeService.getDeleteImpact(id);
      const reasons = formatBlockers(impact.blockers, t);

      if (reasons) {
        showAlert(`${t("cannotDeleteEmployeeTitle")}: ${reasons}`, "error");
        return;
      }

      setDeleteImpact(impact);
      setShowModal(true);
    } catch (err) {
      showAlert(err.response?.data?.error || t("errorOccurred"), "error");
    }
  };

  // Уволить нельзя, пока за сотрудником числится имущество — проверяем
  // до открытия панели приказа, чтобы не показывать ошибку после заполнения формы
  const fetchAssignedAssets = async (employeeId) => {
    const { data: assets } = await getAssetAssignments({
      page: 1,
      pageSize: 200,
      filters: { employee_id: employeeId, state: "assigned" },
    });
    return assets || [];
  };

  const handleLeftPanel = async (
    nextEmploymentOrderType,
    nextLeftPanelType,
  ) => {
    const isSamePanel =
      employmentOrderType === nextEmploymentOrderType &&
      leftPanelType === nextLeftPanelType;

    if (isSamePanel) {
      setEmploymentOrderType(null);
      setLeftPanelType(null);
      return;
    }

    if (nextEmploymentOrderType === "terminate" && selectedItem) {
      try {
        const assets = await fetchAssignedAssets(selectedItem);

        if (assets.length > 0) {
          const employee = assets[0]?.employee;
          setTerminationBlock({
            assets,
            employeeName: employee
              ? [employee.last_name, employee.first_name, employee.middle_name]
                  .filter(Boolean)
                  .join(" ")
              : "",
          });
          return;
        }
      } catch (err) {
        console.error("Ошибка при проверке имущества сотрудника:", err);
        showAlert(err.response?.data?.error || t("errorOccurred"), "error");
        return;
      }
    }

    setEmploymentOrderType(nextEmploymentOrderType);
    setLeftPanelType(nextLeftPanelType);
  };

  const closeLeftPanel = () => {
    setEmploymentOrderType(null);
    setLeftPanelType(null);
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`/api/employees/${id}`);
      if (response.data.success) {
        setData((prevData) => prevData.filter((user) => user.id !== id));
        deleteUser(id);
        showAlert(t("success"), "error");
      }
    } catch (err) {
      showAlert(err.response?.data?.error || t("errorOccurred"), "error");
    } finally {
      setShowModal(false);
      setDeleteImpact(null);
    }
  };

  const openBulkModal = (type) => {
    setBulkIds(selectedIds);
    setModalType(type);
  };

  const handleSyncFaceDevicesClick = () => {
    setBulkIds(selectedIds);
    setSyncConfirmCount(selectedIds.length);
  };

  const handleSyncFaceDevices = async () => {
    setSyncConfirmCount(0);
    try {
      const res = await EmployeeService.bulkSyncFaceDevices(bulkIds);
      showAlert(`${t("bulkSyncStarted")}: ${res.queued}`, "success");
    } catch (err) {
      showAlert(err.response?.data?.error || t("errorOccurred"), "error");
    }
  };

  // Массовое удаление: сначала показываем сводку и список заблокированных
  const handleBulkDeleteClick = async () => {
    try {
      const impact = await EmployeeService.getBulkDeleteImpact(selectedIds);
      setBulkIds(selectedIds);

      if (!impact.deletable.length) {
        showAlert(t("bulkDeleteNothingToDelete"), "error");
        setBulkDeleteImpact(impact);
        return;
      }

      setBulkDeleteImpact(impact);
    } catch (err) {
      showAlert(err.response?.data?.error || t("errorOccurred"), "error");
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await EmployeeService.bulkDelete(bulkIds);
      res.employee_ids?.forEach((id) => deleteUser(id));

      if (res.blocked?.length || res.failed?.length) {
        showAlert(
          `${t("bulkDeletedCount")}: ${res.deleted} · ${t("bulkSkippedCount")}: ${
            (res.blocked?.length || 0) + (res.failed?.length || 0)
          }`,
          "error",
        );
      } else {
        showAlert(`${t("bulkDeletedCount")}: ${res.deleted}`, "success");
      }

      await fetchEmployees(currentPage, formData, pageSize);
      fetchStats();
    } catch (err) {
      showAlert(err.response?.data?.error || t("errorOccurred"), "error");
    } finally {
      setBulkDeleteImpact(null);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchEmployees(1, formData);
  };

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    await fetchEmployees(newPage);
  };

  const handleChangePageSize = async (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    await fetchEmployees(1, formData, size);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await EmployeeService.importExcel(fd);
      setImportResult(result);
      fetchEmployees(currentPage, formData, pageSize);
    } catch (err) {
      showAlert(err.response?.data?.error || t("errorOccurred"), "error");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className={styles.employeesPage}>
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
                    label={t("statsTotal")}
                    value={stats.total}
                  />
                  <StatWidget
                    icon={UserCheck}
                    color="#16a34a"
                    label={t("statsActive")}
                    value={stats.active}
                    sub={
                      stats.total > 0
                        ? `${Math.round((stats.active / stats.total) * 100)}%`
                        : "0%"
                    }
                    progress={
                      stats.total > 0 ? (stats.active / stats.total) * 100 : 0
                    }
                  />
                  <StatWidget
                    icon={UserX}
                    color="#ef4444"
                    label={t("statsFired")}
                    value={stats.fired}
                    sub={
                      stats.total > 0
                        ? `${Math.round((stats.fired / stats.total) * 100)}%`
                        : "0%"
                    }
                    progress={
                      stats.total > 0 ? (stats.fired / stats.total) * 100 : 0
                    }
                  />
                  <StatWidget
                    icon={UserPlus}
                    color="#3b82f6"
                    label={t("statsNewWeek")}
                    value={stats.new_this_week}
                  />
                  <StatWidget
                    icon={UserMinus}
                    color="#f59e0b"
                    label={t("statsFiredWeek")}
                    value={stats.fired_this_week}
                  />
                  <StatWidget
                    icon={Cake}
                    color="#a855f7"
                    label={t("statsBirthdaysWeek")}
                    value={stats.birthdays_this_week}
                    onClick={
                      stats.birthdays_this_week > 0
                        ? () => setShowBdModal(true)
                        : undefined
                    }
                  />
                  {stats.total > 0 && (
                    <GenderWidget
                      gender={stats.gender}
                      total={stats.total}
                      t={t}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className={styles.mainHeader} ref={mainHeaderRef}>
            <div className={styles.filterWrapper}>
              {viewType === "department" ? (
                selectedDepartment ? (
                  <div className={styles.departmentBreadcrumb}>
                    <button
                      type="button"
                      className={styles.backBtn}
                      onClick={handleBackToDepartments}
                    >
                      <ArrowLeft size={15} />
                      {t("backToDepartments") || "Назад к отделам"}
                    </button>
                    <span className={styles.departmentBreadcrumbName}>
                      {selectedDepartment.name} ·{" "}
                      {selectedDepartment.branch_name}
                    </span>
                  </div>
                ) : (
                  <div className={searchStyles.searchInput}>
                    {Icons.search}
                    <input
                      type="text"
                      placeholder={
                        t("searchDepartmentBranch") ||
                        "Поиск по отделу, филиалу"
                      }
                      value={departmentSearch}
                      onChange={(e) => setDepartmentSearch(e.target.value)}
                    />
                    {departmentSearch && (
                      <span
                        className={searchStyles.clearBtn}
                        onClick={() => setDepartmentSearch("")}
                      >
                        {Icons.clear}
                      </span>
                    )}
                  </div>
                )
              ) : (
                <>
                  <Search
                    formData={formData}
                    setFormData={setFormData}
                    onSearch={handleSearch}
                  />

                  <EmployeeFilter
                    formData={formData}
                    setFormData={setFormData}
                    onSubmit={handleFormSubmit}
                    t={t}
                  />

                  <SalarySort
                    sort_by={formData.sort_by}
                    sort_order={formData.sort_order}
                    onApply={handleSortApply}
                  />
                </>
              )}

              <div className={styles.viewModeToggle}>
                <button
                  type="button"
                  className={viewType === "list" ? styles.active : ""}
                  title={t("listView") || "Список"}
                  onClick={() => handleViewTypeChange("list")}
                >
                  <List size={15} />
                  <span>{t("listView") || "Список"}</span>
                </button>
                <button
                  type="button"
                  className={viewType === "department" ? styles.active : ""}
                  title={t("byDepartments")}
                  onClick={() => handleViewTypeChange("department")}
                >
                  <Building2 size={15} />
                  <span>{t("byDepartments")}</span>
                </button>
              </div>
            </div>

            {(viewType !== "department" || selectedDepartment) && (
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
              {canAdd && (
                <Button text={t("add")} onClick={() => setModalType("add")} />
              )}

              {(canEdit || canDelete) &&
                (viewType !== "department" || selectedDepartment) && (
                  <button
                    type="button"
                    className={`${styles.selectModeBtn} ${labelsExpanded ? styles.expanded : ""} ${selectMode ? styles.active : ""}`}
                    title={t("selectMode")}
                    onClick={toggleSelectMode}
                  >
                    <ListChecks size={16} />
                    <span className={styles.btnLabel} data-fit-label>
                      {t("selectMode")}
                    </span>
                  </button>
                )}

              {(viewType !== "department" || selectedDepartment) &&
                data.length > 0 && (
                  <>
                    <DownloadButton
                      text={t("save")}
                      label={t("exportToExcel")}
                      expanded={labelsExpanded}
                      onClick={() => exportEmployeesToExcel(data)}
                    />
                    <div
                      className={styles.importMenuWrapper}
                      ref={importMenuRef}
                    >
                      <button
                        className={`${styles.importMenuBtn} ${labelsExpanded ? styles.expanded : ""}`}
                        type="button"
                        disabled={importLoading}
                        title={
                          importLoading
                            ? t("loading") || "Загрузка..."
                            : t("importExcel") || "Импортировать данные"
                        }
                        onClick={() =>
                          !importLoading && setShowImportMenu((v) => !v)
                        }
                      >
                        {importLoading ? (
                          <span className={styles.spinner} />
                        ) : (
                          <Upload size={16} />
                        )}
                        <span className={styles.btnLabel} data-fit-label>
                          {t("importExcel") || "Импортировать данные"}
                        </span>
                      </button>
                      {showImportMenu && !importLoading && (
                        <div className={styles.importMenuDropdown}>
                          <button
                            className={styles.importMenuItem}
                            onClick={async () => {
                              setShowImportMenu(false);
                              try {
                                const { data: allEmployees } =
                                  await EmployeeService.getAll({
                                    ...formData,
                                    page: 1,
                                    pageSize: 99999,
                                  });
                                downloadEmployeeImportTemplate(
                                  allEmployees || [],
                                  { branches, departments, positions },
                                  t,
                                );
                              } catch (err) {
                                showAlert(
                                  err.response?.data?.error ||
                                    t("errorOccurred"),
                                  "error",
                                );
                              }
                            }}
                          >
                            {t("downloadTemplate") || "Скачать шаблон"}
                          </button>
                          <button
                            className={styles.importMenuItem}
                            onClick={() => {
                              setShowImportMenu(false);
                              importFileRef.current?.click();
                            }}
                          >
                            {t("importData") || "Импортировать"}
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
                  </>
                )}

              {(viewType !== "department" || selectedDepartment) && (
                <div
                  className={styles.refreshBtn}
                  title={t("dashboard.refresh") || "Обновить"}
                  onClick={() =>
                    fetchEmployees(currentPage, formData, pageSize)
                  }
                >
                  <RefreshCw size={16} />
                </div>
              )}
            </div>
          </div>

          {selectMode && (viewType !== "department" || selectedDepartment) && (
            <EmployeeBulkBar
              count={selectedIds.length}
              canEdit={canEdit}
              canDelete={canDelete}
              onChangeSchedule={() => openBulkModal("bulkSchedule")}
              onAssignDoors={() => openBulkModal("bulkDoors")}
              onEditPlacement={() => openBulkModal("bulkPlacement")}
              onSyncFaceDevices={handleSyncFaceDevicesClick}
              onTerminate={() => openBulkModal("bulkTerminate")}
              onDelete={handleBulkDeleteClick}
              onClear={() => setSelectedIds([])}
            />
          )}

          {viewType === "department" && !selectedDepartment ? (
            <DepartmentCards
              onSelect={handleDepartmentSelect}
              search={departmentSearch}
              onScroll={handleTableScroll}
            />
          ) : (
            <EmployeesTable
              onScroll={handleTableScroll}
              data={data}
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              canEdit={canEdit}
              canDelete={canDelete}
              handleEditClick={handleEditClick}
              handleDeleteClick={handleDeleteClick}
              handleChangePageSize={handleChangePageSize}
              handlePageChange={handlePageChange}
              selectedIds={selectMode ? selectedIds : undefined}
              onToggleSelect={handleToggleSelect}
              onToggleAll={handleToggleAll}
              onRowClick={setProfileId}
            />
          )}
        </div>
      )}

      <EmployeeProfile
        employeeId={profileId}
        isOpen={profileId !== null}
        onClose={() => setProfileId(null)}
        canEdit={canEdit}
        onEdit={(id) => {
          setProfileId(null);
          handleEditClick(id);
        }}
      />

      <CenterModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setDeleteImpact(null);
        }}
        onAccept={() => handleDelete(selectedItem)}
        tag={t("areYouSureDelete")}
        message={
          deleteImpact && (
            <>
              <p className={styles.deleteImpactText}>
                {t("deleteEmployeeImpactTitle")}:
              </p>
              <ul className={styles.deleteImpactList}>
                <li className={styles.deleteImpactRow}>
                  <span>{t("deleteEmployeeOrdersCount")}</span>
                  <strong>{deleteImpact.employmentOrders}</strong>
                </li>
                <li className={styles.deleteImpactRow}>
                  <span>{t("deleteEmployeeFacePassesCount")}</span>
                  <strong>{deleteImpact.facePasses}</strong>
                </li>
                {deleteImpact.timeOff > 0 && (
                  <li className={styles.deleteImpactRow}>
                    <span>{t("deleteEmployeeTimeOffCount")}</span>
                    <strong>{deleteImpact.timeOff}</strong>
                  </li>
                )}
              </ul>
            </>
          )
        }
      />

      <CenterModal
        isOpen={Boolean(bulkDeleteImpact)}
        onClose={() => setBulkDeleteImpact(null)}
        onAccept={
          bulkDeleteImpact?.deletable?.length
            ? handleBulkDelete
            : () => setBulkDeleteImpact(null)
        }
        tag={t("areYouSureDelete")}
        acceptText={
          bulkDeleteImpact?.deletable?.length ? undefined : t("close")
        }
        message={
          bulkDeleteImpact && (
            <>
              <p className={styles.deleteImpactText}>
                {t("bulkDeleteWillDelete")}:{" "}
                <strong>{bulkDeleteImpact.deletable.length}</strong>
              </p>
              <ul className={styles.deleteImpactList}>
                <li className={styles.deleteImpactRow}>
                  <span>{t("deleteEmployeeOrdersCount")}</span>
                  <strong>{bulkDeleteImpact.totals.employmentOrders}</strong>
                </li>
                <li className={styles.deleteImpactRow}>
                  <span>{t("deleteEmployeeFacePassesCount")}</span>
                  <strong>{bulkDeleteImpact.totals.facePasses}</strong>
                </li>
                {bulkDeleteImpact.totals.timeOff > 0 && (
                  <li className={styles.deleteImpactRow}>
                    <span>{t("deleteEmployeeTimeOffCount")}</span>
                    <strong>{bulkDeleteImpact.totals.timeOff}</strong>
                  </li>
                )}
              </ul>
              {bulkDeleteImpact.blocked.length > 0 && (
                <>
                  <p className={styles.deleteImpactText}>
                    {t("bulkDeleteBlocked")}:{" "}
                    <strong>{bulkDeleteImpact.blocked.length}</strong>
                  </p>
                  <ul className={styles.deleteImpactList}>
                    {bulkDeleteImpact.blocked.map((b) => (
                      <li key={b.id} className={styles.deleteImpactRow}>
                        <span>{b.name}</span>
                        <strong>{formatBlockers(b.blockers, t)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )
        }
      />

      <CenterModal
        isOpen={syncConfirmCount > 0}
        onClose={() => setSyncConfirmCount(0)}
        onAccept={handleSyncFaceDevices}
        tag={t("bulkSyncFaceDevices")}
        message={
          <>
            <p className={styles.deleteImpactText}>
              {t("bulkSyncConfirm")}: <strong>{syncConfirmCount}</strong>
            </p>
            <p className={styles.deleteImpactText}>{t("bulkSyncHint")}</p>
          </>
        }
      />

      <TerminationBlockedModal
        isOpen={Boolean(terminationBlock)}
        assets={terminationBlock?.assets || []}
        employeeName={terminationBlock?.employeeName}
        onClose={() => setTerminationBlock(null)}
        onGoToAssets={
          canViewAssets
            ? () => {
                setTerminationBlock(null);
                navigate(
                  `/asset-assignments?search=${selectedItem}&state=assigned`,
                );
              }
            : null
        }
      />

      {modalType === "add" && (
        <OverlaySidebar
          isOpen={modalType !== null}
          onClose={() => setModalType(null)}
          width="550px"
          side="right"
          children={
            <AddEmployee
              handleClose={() => setModalType(null)}
              onSuccess={() => {
                fetchEmployees();
              }}
            />
          }
        />
      )}

      {modalType === "bulkSchedule" && (
        <OverlaySidebar
          isOpen={modalType !== null}
          onClose={() => setModalType(null)}
          width="480px"
          side="right"
          children={
            <BulkChangeWorkSchedule
              employeeIds={bulkIds}
              handleClose={() => setModalType(null)}
              onSuccess={() => {
                fetchEmployees(currentPage, formData, pageSize);
              }}
            />
          }
        />
      )}

      {modalType === "bulkDoors" && (
        <OverlaySidebar
          isOpen={modalType !== null}
          onClose={() => setModalType(null)}
          width="480px"
          side="right"
          children={
            <BulkAssignDoors
              employeeIds={bulkIds}
              handleClose={() => setModalType(null)}
              onSuccess={() => {
                fetchEmployees(currentPage, formData, pageSize);
              }}
            />
          }
        />
      )}

      {modalType === "bulkTerminate" && (
        <OverlaySidebar
          isOpen={modalType !== null}
          onClose={() => setModalType(null)}
          width="480px"
          side="right"
          children={
            <BulkTerminate
              employeeIds={bulkIds}
              handleClose={() => setModalType(null)}
              onSuccess={() => {
                fetchEmployees(currentPage, formData, pageSize);
                fetchStats();
              }}
            />
          }
        />
      )}

      {modalType === "bulkPlacement" && (
        <OverlaySidebar
          isOpen={modalType !== null}
          onClose={() => setModalType(null)}
          width="520px"
          side="right"
          children={
            <BulkEditPlacement
              employeeIds={bulkIds}
              handleClose={() => setModalType(null)}
              onSuccess={() => {
                fetchEmployees(currentPage, formData, pageSize);
              }}
            />
          }
        />
      )}

      {showBdModal && stats?.birthday_list?.length > 0 && (
        <BirthdayModal
          list={stats.birthday_list}
          onClose={() => setShowBdModal(false)}
          t={t}
        />
      )}

      {modalType === "edit" && (
        <OverlaySidebar
          isOpen={modalType !== null}
          onClose={() => {
            setModalType(null);
            closeLeftPanel(false);
          }}
          width="550px"
          side="right"
          children={
            <EditEmployee
              id={selectedItem}
              handleClose={() => setModalType(null)}
              handleLeftPanel={handleLeftPanel}
              isLeftPanelOpen={isLeftPanelOpen}
              closeLeftPanel={closeLeftPanel}
              setLeftPanelType={setLeftPanelType}
              handleSetUpdateFunction={handleSetUpdateFunction}
              onSuccess={() => {
                fetchEmployees();
              }}
            />
          }
          leftPanel={{
            isOpen: isLeftPanelOpen,
            width: "500px",
            children:
              leftPanelType === "addEmploymentOrder" ? (
                <AddEmploymentOrder
                  employeeId={selectedItem}
                  employmentOrderType={employmentOrderType}
                  handleClose={closeLeftPanel}
                  updateEmployeeDataFunction={updateEmployeeDataRef.current}
                />
              ) : null,
          }}
        />
      )}
      {importResult && (
        <div
          className={styles.bdModalOverlay}
          onClick={() => setImportResult(null)}
        >
          <div className={styles.bdModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bdModalHeader}>
              <div className={styles.bdModalHeaderLeft}>
                <div className={styles.bdModalHeaderTitle}>
                  {t("importResult") || "Результат импорта"}
                </div>
              </div>
              <button
                className={styles.bdModalClose}
                onClick={() => setImportResult(null)}
              >
                {Icons.clear}
              </button>
            </div>
            <div
              style={{
                padding: "16px 20px",
                maxHeight: "70vh",
                overflowY: "auto",
              }}
            >
              <p>
                ✓ {t("updated") || "Обновлено"}:{" "}
                <strong>{importResult.updated}</strong>
              </p>
              <p>
                ＋ {t("created") || "Создано"}:{" "}
                <strong>{importResult.created || 0}</strong>
              </p>
              <p>
                — {t("unchanged") || "Без изменений"}:{" "}
                <strong>{importResult.unchanged || 0}</strong>
              </p>
              <p>
                📋 {t("ordersCreated") || "Приказов создано"}:{" "}
                <strong>{importResult.ordersCreated}</strong>
              </p>
              {importResult.errors?.length > 0 && (
                <>
                  <p style={{ color: "#ef4444", marginTop: 12 }}>
                    ✗ {t("errors") || "Ошибок"}:{" "}
                    <strong>{importResult.errors.length}</strong>
                  </p>
                  <ul
                    style={{
                      fontSize: 13,
                      color: "#ef4444",
                      paddingLeft: 16,
                      marginTop: 4,
                    }}
                  >
                    {importResult.errors.map((e, i) => {
                      const msg =
                        e.code === "EMPLOYEE_NOT_FOUND"
                          ? `${t("employee")} ID=${e.id} ${t("importNotFound")}`
                          : e.code === "DEPARTMENT_NOT_FOUND"
                            ? `${t("department")} ID=${e.id} ${t("importNotFound")}`
                            : e.code === "DEPARTMENT_BRANCH_MISMATCH"
                              ? `${t("department")} ID=${e.deptId} ${t("doesNotBelongToBranch")} ID=${e.branchId}`
                              : e.code === "DUPLICATE"
                                ? e.error || "Дублирующееся значение"
                                : t("importUnknownError") ||
                                  "Ошибка обработки строки";
                      return (
                        <li key={i}>
                          {t("row")} {e.row}: {msg}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;
