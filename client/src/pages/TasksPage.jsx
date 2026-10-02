import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LayoutList, LayoutGrid } from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import { usePermissions } from "../hooks/usePermissions";
import { useAuthStore } from "../stores/authStore";
import { getTasks, deleteTask } from "../api";

import Button from "../components/Button";
import Pagination from "../components/Pagination";
import Loading from "../components/Loading";
import Search from "../components/Search";
import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import { Icons } from "../icons/icons";

import AddTask from "../components/AddTask";
import TaskDetail from "../components/TaskDetail";
import TaskKanbanView from "../components/TaskKanbanView";
import EmployeeCell from "../components/EmployeeCell";
import TaskFilter from "../components/TaskFilter";
import SortArrow from "../components/SortArrow";

import styles from "./TasksPage.module.scss";

const STATUS_COLORS = {
  draft: "#94a3b8",
  assigned: "#f59e0b",
  in_progress: "#3b82f6",
  done: "#10b981",
  confirmed: "#6366f1",
  cancelled: "#ef4444",
};

const PRIORITY_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
};

function getAssigneeName(task) {
  if (task.assignee_employee) {
    const { first_name, last_name } = task.assignee_employee;
    return [last_name, first_name].filter(Boolean).join(" ") || "—";
  }
  if (task.assignee_department) return task.assignee_department.name;
  if (task.assignee_position) return task.assignee_position.name;
  if (task.assignee_user) return task.assignee_user.username;
  return "—";
}

const TasksPage = () => {
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const rawUser = useAuthStore((s) => s.user);
  const access = useAuthStore((s) => s.access);
  const currentUser = rawUser
    ? {
        ...rawUser,
        access_level: rawUser.access_level ?? access?.access_level,
        employee_id: rawUser.employee_id ?? access?.employee_id,
      }
    : null;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);

  const [viewMode, setViewMode] = useState("table");
  const [sidebarMode, setSidebarMode] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const [formData, setFormData] = useState({
    search: "",
    status: "",
    priority: "",
    my_tasks: false,
    branch_id: "",
    department_id: "",
    position_id: "",
    overdue: false,
  });

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const { data: items, pagination } = await getTasks({
        page,
        pageSize: size,
        filters: JSON.stringify(filters),
      });
      setData(items || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotalItems(pagination?.totalItems || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  const handleSearch = (f = formData) => {
    setCurrentPage(1);
    fetchData(1, f, pageSize);
  };

  const handleDelete = async () => {
    try {
      await deleteTask(deleteId);
      showAlert(t("success"), "success");
      setDeleteId(null);
      fetchData();
    } catch (err) {
      showAlert(t("error"), "error");
    }
  };

  const handleRowClick = (id) => {
    setSelectedTaskId(id);
    setSidebarMode("view");
  };

  const closeSidebar = () => {
    setSidebarMode(null);
    setSelectedTaskId(null);
    setEditData(null);
  };

  const openAdd = () => {
    setEditData(null);
    setSelectedTaskId(null);
    setSidebarMode("add");
  };

  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return null;
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    if (days > 0) return t("durationDaysHours", { days, hours });
    if (hours > 0) return t("durationHours", { hours });
    return t("durationMinutes", { minutes: totalMin });
  };

  const getCompletionStatus = (item) => {
    if (!item.completed_at) return null;
    const completedStr = new Date(item.completed_at).toLocaleDateString(
      "ru-RU",
    );
    if (!item.deadline) return { ok: true, label: completedStr };
    const overdue = new Date(item.completed_at) - new Date(item.deadline);
    if (overdue <= 0) return { ok: true, label: completedStr };
    return { ok: false, label: completedStr, late: formatDuration(overdue) };
  };

  const getCreatorName = (item) => {
    if (!item.created_by) return "";
    return (
      [item.created_by.employee?.last_name, item.created_by.employee?.first_name]
        .filter(Boolean)
        .join(" ") || item.created_by.username
    );
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortValue = (item, field) => {
    switch (field) {
      case "assignee":
        return getAssigneeName(item);
      case "createdBy":
        return getCreatorName(item);
      default:
        return item[field];
    }
  };

  const getSortedData = () => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);

      if (aVal === null || aVal === undefined || aVal === "") return 1;
      if (bVal === null || bVal === undefined || bVal === "") return -1;

      if (["published_at", "deadline", "completed_at"].includes(sortField)) {
        return sortOrder === "asc"
          ? new Date(aVal) - new Date(bVal)
          : new Date(bVal) - new Date(aVal);
      }

      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  const formatDeadline = (deadline) => {
    if (!deadline) return "—";
    const d = new Date(deadline);
    const isOverdue = d < new Date();
    const str = d.toLocaleDateString("ru-RU");
    return { str, isOverdue };
  };

  return (
    <div className={styles.page}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search
                formData={formData}
                setFormData={setFormData}
                onSearch={handleSearch}
              />
              <TaskFilter
                formData={formData}
                setFormData={setFormData}
                onSubmit={() => handleSearch(formData)}
              />
              <div className={styles.viewToggle}>
                <div
                  className={styles.viewToggleSlider}
                  style={{ transform: `translateX(${viewMode === "kanban" ? "100%" : "0"})` }}
                />
                <button
                  className={viewMode === "table" ? styles.active : ""}
                  onClick={() => setViewMode("table")}
                  title={t("tableView")}
                >
                  <LayoutList size={15} />
                  <span>{t("tableView")}</span>
                </button>
                <button
                  className={viewMode === "kanban" ? styles.active : ""}
                  onClick={() => setViewMode("kanban")}
                  title={t("kanbanView")}
                >
                  <LayoutGrid size={15} />
                  <span>{t("kanbanView")}</span>
                </button>
              </div>
            </div>

            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              handleChangePageSize={(e) => {
                const size = parseInt(e.target.value, 10);
                setPageSize(size);
                setCurrentPage(1);
              }}
              handlePageChange={(page) => {
                if (page >= 1 && page <= totalPages) setCurrentPage(page);
              }}
            />

            <div className={styles.buttonsWrapper}>
              {canAdd && <Button text={t("add")} onClick={openAdd} />}
              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>
            </div>
          </div>

          {viewMode === "table" ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>№</th>
                    <th onClick={() => handleSort("title")}>
                      <span className={styles.headerContent}>
                        {t("task.title")}
                        <SortArrow active={sortField === "title"} order={sortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSort("priority")}>
                      <span className={styles.headerContent}>
                        {t("task.priority")}
                        <SortArrow active={sortField === "priority"} order={sortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSort("status")}>
                      <span className={styles.headerContent}>
                        {t("task.status")}
                        <SortArrow active={sortField === "status"} order={sortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSort("assignee")}>
                      <span className={styles.headerContent}>
                        {t("task.assignee")}
                        <SortArrow active={sortField === "assignee"} order={sortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSort("published_at")}>
                      <span className={styles.headerContent}>
                        {t("task.assignedAt")}
                        <SortArrow active={sortField === "published_at"} order={sortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSort("deadline")}>
                      <span className={styles.headerContent}>
                        {t("task.deadline")}
                        <SortArrow active={sortField === "deadline"} order={sortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSort("createdBy")}>
                      <span className={styles.headerContent}>
                        {t("task.createdBy")}
                        <SortArrow active={sortField === "createdBy"} order={sortOrder} />
                      </span>
                    </th>
                    <th onClick={() => handleSort("completed_at")}>
                      <span className={styles.headerContent}>
                        {t("task.completion")}
                        <SortArrow active={sortField === "completed_at"} order={sortOrder} />
                      </span>
                    </th>
                    {(canEdit || canDelete) && <th>{t("action")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.length > 0 ? (
                    getSortedData().map((item, i) => {
                      const dl = item.deadline
                        ? formatDeadline(item.deadline)
                        : null;
                      const statusColor =
                        STATUS_COLORS[item.status] || "#94a3b8";
                      const priorityColor =
                        PRIORITY_COLORS[item.priority] || "#f59e0b";
                      return (
                        <tr
                          key={item.id}
                          onClick={() => handleRowClick(item.id)}
                        >
                          <td>{(currentPage - 1) * pageSize + i + 1}</td>
                          <td style={{ fontWeight: 500 }}>{item.title}</td>
                          <td>
                            <span
                              className={styles.priorityBadge}
                              style={{
                                background: priorityColor + "20",
                                color: priorityColor,
                              }}
                            >
                              {t(`priority.${item.priority}`)}
                            </span>
                          </td>
                          <td>
                            <span
                              className={styles.statusBadge}
                              style={{
                                background: statusColor + "20",
                                color: statusColor,
                              }}
                            >
                              {t(`status.${item.status}`)}
                            </span>
                          </td>
                          <td>
                            {item.assignee_employee ? (
                              <EmployeeCell
                                photo={item.assignee_employee.photo}
                                lastName={item.assignee_employee.last_name}
                                firstName={item.assignee_employee.first_name}
                                middleName={item.assignee_employee.middle_name}
                                id={item.assignee_employee.id}
                                branch={item.assignee_employee.branch?.name}
                                department={
                                  item.assignee_employee.department?.name
                                }
                                position={item.assignee_employee.position?.name}
                              />
                            ) : (
                              getAssigneeName(item)
                            )}
                          </td>
                          <td>
                            {item.published_at
                              ? new Date(item.published_at).toLocaleDateString(
                                  "ru-RU",
                                )
                              : "—"}
                          </td>
                          <td>
                            {dl ? (
                              <span
                                className={
                                  dl.isOverdue && !["done", "confirmed"].includes(item.status)
                                    ? styles.deadlineOverdue
                                    : ""
                                }
                              >
                                {dl.str}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {item.created_by?.employee ? (
                              <EmployeeCell
                                photo={item.created_by.employee.photo}
                                lastName={item.created_by.employee.last_name}
                                firstName={item.created_by.employee.first_name}
                                middleName={item.created_by.employee.middle_name}
                                id={item.created_by.employee_id}
                                branch={item.created_by.employee.branch?.name}
                                department={
                                  item.created_by.employee.department?.name
                                }
                                position={item.created_by.employee.position?.name}
                              />
                            ) : (
                              getCreatorName(item) || "—"
                            )}
                          </td>
                          <td>
                            {(() => {
                              const cs = getCompletionStatus(item);
                              if (!cs) return "—";
                              return (
                                <span
                                  style={{
                                    color: cs.ok ? "#10b981" : "#ef4444",
                                    fontWeight: 600,
                                    fontSize: 12,
                                  }}
                                >
                                  {cs.label}
                                  {cs.late ? ` (${cs.late})` : ""}
                                </span>
                              );
                            })()}
                          </td>
                          {(canEdit || canDelete) && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className={styles.actionsCell}>
                                {canEdit && item.status === "draft" && (
                                  <button
                                    className={styles.iconBtn}
                                    onClick={() => {
                                      setEditData(item);
                                      setSelectedTaskId(item.id);
                                      setSidebarMode("edit");
                                    }}
                                    title={t("edit")}
                                  >
                                    {Icons.edit}
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    className={`${styles.iconBtn} ${styles.danger}`}
                                    onClick={() => setDeleteId(item.id)}
                                    title={t("delete")}
                                  >
                                    {Icons.delete}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={canEdit || canDelete ? 10 : 9}
                        className={styles.noData}
                      >
                        {t("noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <TaskKanbanView tasks={data} onTaskClick={handleRowClick} />
          )}
        </div>
      )}

      <CenterModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onAccept={handleDelete}
        title={t("areYouSureDelete")}
      />

      <OverlaySidebar
        isOpen={sidebarMode === "add"}
        onClose={closeSidebar}
        title={t("task.addTask")}
        width="600px"
      >
        <AddTask
          onSuccess={() => {
            fetchData();
            closeSidebar();
          }}
          onClose={closeSidebar}
        />
      </OverlaySidebar>

      <OverlaySidebar
        isOpen={sidebarMode === "view" || sidebarMode === "edit"}
        onClose={closeSidebar}
        title={
          sidebarMode === "edit" ? t("task.editTask") : t("task.taskDetail")
        }
        width="700px"
      >
        {sidebarMode === "view" && selectedTaskId && (
          <TaskDetail
            id={selectedTaskId}
            currentUser={currentUser}
            canEdit={canEdit}
            onEdit={(task) => {
              setEditData(task);
              setSidebarMode("edit");
            }}
            onRefresh={fetchData}
            onClose={closeSidebar}
          />
        )}
        {sidebarMode === "edit" && editData && (
          <AddTask
            initialData={editData}
            onSuccess={() => {
              fetchData();
              setSidebarMode("view");
              setEditData(null);
            }}
            onClose={() => {
              setSidebarMode("view");
              setEditData(null);
            }}
          />
        )}
      </OverlaySidebar>
    </div>
  );
};

export default TasksPage;
