import axios from "axios";
import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import { useFilterDataStore } from "../stores/filterDataStore";
import { usePermissions } from "../hooks/usePermissions";
import { EmployeeService } from "../api";

import Button from "../components/Button";
import Loading from "../components/Loading";
import AddEmployee from "../components/AddEmployee";
import EditEmployee from "../components/EditEmployee";
import EmployeesTable from "../components/EmployeesTable";
import EmploymentOrdersTimeline from "../components/EmploymentOrdersTimeline";
import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import Pagination from "../components/Pagination";
import EmployeeFilter from "../components/EmployeeFilter";
import SalarySort from "../components/SalarySort";
import DownloadButton from "../components/DownloadButton";
import AddEmploymentOrder from "../components/AddEmploymentOrder";
import EmployeeWorkSchedulesHistory from "../components/EmployeeWorkSchedulesHistory";
import EmployeeSalaryHistory from "../components/EmployeeSalaryHistory";

import styles from "./EmployeesPage.module.scss";
import { Icons } from "../icons/icons";
import { useAuthStore } from "../stores/authStore";

const StatWidget = ({
  icon: Icon,
  color,
  label,
  value,
  sub,
  progress,
  action,
}) => (
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
    {action && (
      <button
        className={styles.statWidgetAction}
        onClick={action.onClick}
        style={{ borderColor: color + "40", color, background: color + "10" }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        {action.label}
      </button>
    )}
  </div>
);

const GenderWidget = ({ gender, total, t }) => {
  const rows = [
    { key: "male", color: "#3b82f6", label: t("male"), count: gender.male },
    {
      key: "female",
      color: "#ec4899",
      label: t("female"),
      count: gender.female,
    },
    {
      key: "unspecified",
      color: "#94a3b8",
      label: t("notSpecified"),
      count: gender.unspecified,
    },
  ].filter((r) => r.count > 0);

  if (!rows.length) return null;

  return (
    <div className={styles.statWidget}>
      <span className={styles.statWidgetLabel}>{t("statsGender")}</span>
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
      <div className={styles.typeSegmentLabels}>
        {rows.map((r) => (
          <div
            key={r.key}
            className={styles.typeSegmentLabel}
            style={{ width: `${(r.count / total) * 100}%`, color: r.color }}
          >
            <span className={styles.typeSegmentName}>{r.label}</span>
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

const BirthdayModal = ({ list, onClose, t }) => {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const sortedList = [...list].sort((a, b) => {
    const dobA = new Date(a.date_of_birth);
    const dobB = new Date(b.date_of_birth);
    const aVal = dobA.getUTCMonth() * 100 + dobA.getUTCDate();
    const bVal = dobB.getUTCMonth() * 100 + dobB.getUTCDate();
    return aVal - bVal;
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
                <th>{t("fullName")}</th>
                <th>{t("position")}</th>
                <th>{t("dateOfBirth")}</th>
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
                        {emp.photo && (
                          <img
                            src={`/api/employees/image/${emp.photo}`}
                            alt="employee"
                            className={
                              emp.status ? styles.active : styles.terminated
                            }
                          />
                        )}
                        <div className={styles.empInfo}>
                          <span className={styles.empName}>
                            {emp.full_name} ({emp.id})
                          </span>
                          <span className={styles.empSub}>
                            {[emp.branch, emp.department]
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

const EmployeesPage = () => {
  const { deleteUser } = useFilterDataStore();
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
  const { t } = useTranslation();
  const [employmentOrderType, setEmploymentOrderType] = useState("");
  const isLeftPanelOpen = Boolean(employmentOrderType);
  const [leftPanelType, setLeftPanelType] = useState("");
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const updateEmployeeDataRef = useRef(() => {});
  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};

  const [formData, setFormData] = useState({
    branch_id: "",
    department_id: "",
    employee_id: "",
    position_id: "",
    status: "",
    gender: "",
  });

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
  }, []);

  useEffect(() => {
    if (viewMode === "branch") {
      fetchEmployees(1, formData, pageSize);
    }
  }, [activeBranchId]);

  const handleSetUpdateFunction = (fn) => {
    updateEmployeeDataRef.current = fn;
  };

  const handleSearch = () => {
    fetchEmployees(1, { ...formData }, pageSize);
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

  const handleDeleteClick = (id) => {
    setSelectedItem(id);
    setShowModal(true);
  };

  const handleLeftPanel = (nextEmploymentOrderType, nextLeftPanelType) => {
    const isSamePanel =
      employmentOrderType === nextEmploymentOrderType &&
      leftPanelType === nextLeftPanelType;

    if (isSamePanel) {
      setEmploymentOrderType(null);
      setLeftPanelType(null);
    } else {
      setEmploymentOrderType(nextEmploymentOrderType);
      setLeftPanelType(nextLeftPanelType);
    }
  };

  const closeLeftPanel = () => {
    setEmploymentOrderType(null);
    setLeftPanelType(null);
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`/api/employees/delete/${id}`);
      if (response.data.success) {
        setData((prevData) => prevData.filter((user) => user.user_id !== id));
        deleteUser(id);
        showAlert(t("success"), "error");
      }
    } catch (err) {
      showAlert(`${err.response.data.message}`, "error");
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

  return (
    <div className={styles.employeesPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
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
                action={
                  stats.birthdays_this_week > 0
                    ? {
                        label: t("showList"),
                        onClick: () => setShowBdModal(true),
                      }
                    : null
                }
              />
              {stats.total > 0 && (
                <GenderWidget gender={stats.gender} total={stats.total} t={t} />
              )}
            </div>
          )}

          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <div className={styles.searchInput}>
                <span onClick={handleSearch}>{Icons.search}</span>
                <input
                  type="text"
                  placeholder={t("search")}
                  value={formData.search || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />

                {formData.search && (
                  <span
                    className={styles.clearBtn}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        search: "",
                      }));
                    }}
                  >
                    {Icons.clear}
                  </span>
                )}
              </div>

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

              <div
                className={styles.refreshBtn}
                onClick={() => fetchEmployees(currentPage, formData, pageSize)}
              >
                {Icons.refresh}
              </div>

              {data.length > 0 && (
                <DownloadButton
                  text={t("save")}
                  onClick={() => exportEmployeesToExcel(data)}
                />
              )}
            </div>
          </div>

          <EmployeesTable
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
          />
        </div>
      )}

      <CenterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAccept={() => handleDelete(selectedItem)}
        title={t("areYouSureDelete")}
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
              ) : leftPanelType === "employmentOrdersList" ? (
                <EmploymentOrdersTimeline
                  employeeId={selectedItem}
                  handleClose={closeLeftPanel}
                  updateEmployeeDataFunction={updateEmployeeDataRef.current}
                />
              ) : leftPanelType === "employmentWorkScheduleList" ? (
                <EmployeeWorkSchedulesHistory
                  employeeId={selectedItem}
                  handleClose={closeLeftPanel}
                  updateEmployeeDataFunction={updateEmployeeDataRef.current}
                />
              ) : leftPanelType === "salaryHistoryList" ? (
                <EmployeeSalaryHistory
                  employeeId={selectedItem}
                  handleClose={closeLeftPanel}
                />
              ) : null,
          }}
        />
      )}
    </div>
  );
};

export default EmployeesPage;
