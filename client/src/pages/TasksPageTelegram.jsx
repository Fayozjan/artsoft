import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useScreenStack } from "../context/ScreenStackContext";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useHideBranch } from "../hooks/useHideBranch";
import Loading from "../components/LoadingTelegram";
import {
  getTasks,
  getTaskById,
  createTask,
  publishTask,
  acceptTask,
  unacceptTask,
  completeTask,
  uncompleteTask,
  cancelTask,
  uncancelTask,
  addTaskComment,
  deleteTaskComment,
} from "../api/tasks";
import styles from "./TasksPageTelegram.module.scss";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CHIPS = [
  { key: "all", color: "#5b8af5" },
  { key: "assigned", color: "#f59e0b" },
  { key: "in_progress", color: "#3b82f6" },
  { key: "done", color: "#10b981" },
  { key: "draft", color: "#94a3b8" },
  { key: "cancelled", color: "#ef4444" },
];

const STATUS_COLORS = {
  draft: "#94a3b8",
  assigned: "#f59e0b",
  in_progress: "#3b82f6",
  done: "#10b981",
  confirmed: "#6366f1",
  cancelled: "#ef4444",
};

const PRIORITY_COLORS = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };
const PRIORITIES = ["low", "medium", "high"];

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Sets --accent / --accent-soft / --accent-line so SCSS can tint any element
// from a single hex color (works in light and dark themes).
function accentVars(color) {
  return {
    "--accent": color,
    "--accent-soft": `${color}1f`,
    "--accent-line": `${color}4d`,
  };
}

function getAssigneeName(task) {
  if (task.assignee_employee) {
    const e = task.assignee_employee;
    return [e.last_name, e.first_name, e.middle_name].filter(Boolean).join(" ") || null;
  }
  if (task.assignee_department) return task.assignee_department.name;
  if (task.assignee_position) return task.assignee_position.name;
  if (task.assignee_user) return task.assignee_user.username;
  return null;
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function fmtDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(deadline) {
  return !!deadline && new Date(deadline) < new Date();
}

// ─── Telegram back button ──────────────────────────────────────────────────────

function useTelegramBackButton(onBack) {
  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb) return;
    bb.show();
    bb.onClick(onBack);
    return () => {
      bb.offClick(onBack);
      bb.hide();
    };
  }, [onBack]);
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const IconChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const IconFlag = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.6}>
    <path d="M5 21V4" strokeLinecap="round" fill="none" />
    <path d="M5 4h11l-2 4 2 4H5z" strokeLinejoin="round" />
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M22 2L11 13" strokeLinecap="round" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconClipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
    <rect x="5" y="4" width="14" height="17" rx="3" />
    <path d="M9 4.5h6M9 12.5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Assignee Block ────────────────────────────────────────────────────────────

function AssigneeBlock({ employee, compact = false }) {
  const hideBranch = useHideBranch();
  if (!employee) return null;
  const fullName = [employee.last_name, employee.first_name, employee.middle_name]
    .filter(Boolean)
    .join(" ");
  const initials = [employee.last_name, employee.first_name]
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join("");
  const isActive = employee.status !== false;
  const sub = [hideBranch ? null : employee.branch?.name, employee.department?.name, employee.position?.name]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className={`${styles.assigneeBlock} ${compact ? styles.assigneeBlockCompact : ""}`}>
      <div className={`${styles.assigneeAvatar} ${isActive ? styles.assigneeAvatarActive : styles.assigneeAvatarInactive}`}>
        {employee.photo ? (
          <img src={`/api/employees/image/${employee.photo}`} alt={fullName} />
        ) : (
          <span className={styles.assigneeInitials}>{initials}</span>
        )}
      </div>
      <div className={styles.assigneeBody}>
        <p className={styles.assigneeName}>
          {fullName} <span className={styles.assigneeId}>({employee.id})</span>
        </p>
        {sub && <p className={styles.assigneeSub}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, index, onClick }) {
  const { t } = useTranslation();
  const assignee = getAssigneeName(task);
  const overdue = isOverdue(task.deadline);
  const statusColor = STATUS_COLORS[task.status] || "#94a3b8";
  const priorityColor = PRIORITY_COLORS[task.priority] || "#94a3b8";
  const textAssignee = !task.assignee_employee && assignee;

  return (
    <div
      className={styles.taskCard}
      style={{ ...accentVars(statusColor), "--i": Math.min(index, 8) }}
      onClick={onClick}
    >
      <div className={styles.cardTop}>
        <span className={styles.statusBadge}>
          <span className={styles.statusDot} />
          {t(`status.${task.status}`)}
        </span>
        <span className={styles.priorityPill} style={accentVars(priorityColor)}>
          <span className={styles.metaIcon}><IconFlag /></span>
          {t(`priority.${task.priority}`)}
        </span>
      </div>

      <p className={styles.taskTitle}>{task.title}</p>

      {(task.assignee_employee || textAssignee || task.deadline) && (
        <div className={styles.cardFooter}>
          {task.assignee_employee ? (
            <AssigneeBlock employee={task.assignee_employee} compact />
          ) : textAssignee ? (
            <span className={styles.footerAssignee}>
              <span className={styles.metaIcon}><IconUser /></span>
              <span className={styles.footerAssigneeText}>{assignee}</span>
            </span>
          ) : (
            <span />
          )}

          {task.deadline && (
            <span className={`${styles.deadlinePill} ${overdue ? styles.overdue : ""}`}>
              <span className={styles.metaIcon}><IconCalendar /></span>
              {fmtDate(task.deadline)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Task Screen ───────────────────────────────────────────────────────────

function AddTaskScreen({ onCreated }) {
  const { t } = useTranslation();
  const { popScreen } = useScreenStack();
  useTelegramBackButton(popScreen);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    deadline: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError(t("task.titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        priority: form.priority,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.deadline) payload.deadline = form.deadline;

      const res = await createTask(payload);
      if (res.success) {
        onCreated(res.data);
        popScreen();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.subPage}>
      <div className={styles.subHeader}>
        <button className={styles.backBtn} onClick={popScreen}>
          <IconChevronLeft />
        </button>
        <h2 className={styles.subTitle}>{t("task.addTask")}</h2>
      </div>

      <div className={styles.subMain}>
        <div className={styles.formCard}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t("task.title")}</label>
            <input
              className={`${styles.textInput} ${error ? styles.inputError : ""}`}
              placeholder={t("task.titlePlaceholder")}
              value={form.title}
              onChange={(e) => {
                setForm((f) => ({ ...f, title: e.target.value }));
                setError("");
              }}
            />
            {error && <span className={styles.errorText}>{error}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t("task.description")}</label>
            <textarea
              className={styles.textarea}
              placeholder={t("task.descriptionPlaceholder")}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t("task.priority")}</label>
            <div className={styles.segmented}>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.segBtn} ${form.priority === p ? styles.segBtnActive : ""}`}
                  style={accentVars(PRIORITY_COLORS[p])}
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                >
                  <span className={styles.segDot} />
                  {t(`priority.${p}`)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t("task.deadline")}</label>
            <input
              type="date"
              className={styles.textInput}
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              onFocus={(e) => e.target.showPicker?.()}
            />
          </div>
        </div>
      </div>

      <div className={styles.actionBar}>
        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? "..." : t("task.addTask")}
        </button>
      </div>
    </div>
  );
}

// ─── Task Detail Screen ────────────────────────────────────────────────────────

function InfoTile({ icon, label, value, danger }) {
  return (
    <div className={styles.infoTile}>
      <span className={styles.infoTileIcon}>{icon}</span>
      <div className={styles.infoTileBody}>
        <span className={styles.infoLabel}>{label}</span>
        <span className={`${styles.infoValue} ${danger ? styles.infoDanger : ""}`}>{value}</span>
      </div>
    </div>
  );
}

function TaskDetailScreen({ taskId, onUpdate }) {
  const { t } = useTranslation();
  const { popScreen } = useScreenStack();
  const { access } = useAuthStore();
  useTelegramBackButton(popScreen);

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentSending, setCommentSending] = useState(false);

  const loadTask = useCallback(async () => {
    const res = await getTaskById(taskId);
    if (res.success) setTask(res.data);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const doAction = async (fn) => {
    setActionLoading(true);
    try {
      const res = await fn(task.id);
      if (res.success) {
        setTask(res.data);
        onUpdate?.(res.data);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    setCommentSending(true);
    try {
      const res = await addTaskComment(task.id, comment.trim());
      if (res.success) {
        setComment("");
        loadTask();
      }
    } finally {
      setCommentSending(false);
    }
  };

  const removeComment = async (commentId) => {
    const res = await deleteTaskComment(task.id, commentId);
    if (res.success) loadTask();
  };

  if (loading) {
    return (
      <div className={styles.subPage}>
        <div className={styles.subHeader}>
          <button className={styles.backBtn} onClick={popScreen}>
            <IconChevronLeft />
          </button>
        </div>
        <div className={styles.loadingWrap}>
          <Loading />
        </div>
      </div>
    );
  }

  if (!task) return null;

  const isEmployee = access?.access_level === "employee";
  const isAdmin = !isEmployee;
  const isCreator = task.created_by_id === access?.user_id;
  const isAssignee =
    (task.assignee_employee_id && task.assignee_employee_id === access?.employee_id) ||
    (task.assignee_user_id && task.assignee_user_id === access?.user_id);
  const canManage = isCreator || isAdmin;

  const assignee = getAssigneeName(task);
  const overdue = isOverdue(task.deadline);
  const statusColor = STATUS_COLORS[task.status] || "#94a3b8";
  const priorityColor = PRIORITY_COLORS[task.priority] || "#94a3b8";

  const actions = [];
  if (task.status === "draft" && canManage) {
    actions.push({ label: t("task.publish"), fn: publishTask, color: "#3b82f6" });
  }
  if (task.status === "assigned") {
    if (isAssignee)
      actions.push({ label: t("task.accept"), fn: acceptTask, color: "#10b981" });
    if (canManage)
      actions.push({ label: t("task.cancel"), fn: cancelTask, color: "#ef4444", secondary: true });
  }
  if (task.status === "in_progress") {
    if (isAssignee) {
      actions.push({ label: t("task.complete"), fn: completeTask, color: "#10b981" });
      actions.push({ label: t("task.unaccept"), fn: unacceptTask, color: "#94a3b8", secondary: true });
    }
    if (isAdmin && !isAssignee)
      actions.push({ label: t("task.cancel"), fn: cancelTask, color: "#ef4444", secondary: true });
  }
  if (task.status === "done" && isAssignee) {
    actions.push({ label: t("task.uncomplete"), fn: uncompleteTask, color: "#94a3b8", secondary: true });
  }
  if (task.status === "cancelled" && canManage) {
    actions.push({ label: t("task.uncancel"), fn: uncancelTask, color: "#f59e0b" });
  }

  const creatorName = task.created_by
    ? task.created_by.employee
      ? [task.created_by.employee.last_name, task.created_by.employee.first_name]
          .filter(Boolean)
          .join(" ")
      : task.created_by.username
    : null;

  const comments = task.comments || [];

  return (
    <div className={styles.subPage}>
      <div className={styles.subHeader}>
        <button className={styles.backBtn} onClick={popScreen}>
          <IconChevronLeft />
        </button>
        <h2 className={styles.subTitle}>{t("task.taskDetail")}</h2>
      </div>

      <div className={styles.subMain}>
        {/* Title card */}
        <div className={styles.detailCard} style={accentVars(statusColor)}>
          <div className={styles.detailHero}>
            <div className={styles.detailBadges}>
              <span className={styles.statusBadge}>
                <span className={styles.statusDot} />
                {t(`status.${task.status}`)}
              </span>
              <span className={styles.priorityPill} style={accentVars(priorityColor)}>
                <span className={styles.metaIcon}><IconFlag /></span>
                {t(`priority.${task.priority}`)}
              </span>
            </div>
            <h3 className={styles.detailTitle}>{task.title}</h3>
          </div>

          <div className={styles.detailBody}>
            {(task.deadline || creatorName || (!task.assignee_employee && assignee)) && (
              <div className={styles.infoGrid}>
                {!task.assignee_employee && assignee && (
                  <InfoTile icon={<IconUser />} label={t("task.assignee")} value={assignee} />
                )}
                {task.deadline && (
                  <InfoTile
                    icon={<IconCalendar />}
                    label={t("task.deadline")}
                    value={`${fmtDate(task.deadline)}${overdue ? " ⚠" : ""}`}
                    danger={overdue}
                  />
                )}
                {creatorName && (
                  <InfoTile
                    icon={<IconUser />}
                    label={t("task.createdBy")}
                    value={creatorName}
                  />
                )}
              </div>
            )}

            {task.assignee_employee && (
              <div className={styles.section}>
                <p className={styles.sectionLabel}>{t("task.assignee")}</p>
                <AssigneeBlock employee={task.assignee_employee} />
              </div>
            )}

            {task.description && (
              <div className={styles.section}>
                <p className={styles.sectionLabel}>{t("task.description")}</p>
                <p className={styles.descriptionText}>{task.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Comments */}
        <div className={styles.commentsSection}>
          <div className={styles.commentsHeader}>
            <p className={styles.sectionLabel}>{t("task.comments")}</p>
            {comments.length > 0 && (
              <span className={styles.commentsCount}>{comments.length}</span>
            )}
          </div>

          {comments.length > 0 ? (
            <div className={styles.commentsList}>
              {comments.map((c) => {
                const isMine = c.user_id === access?.user_id;
                const author = c.user?.username || "—";
                return (
                  <div
                    key={c.id}
                    className={`${styles.commentItem} ${isMine ? styles.commentMine : ""}`}
                  >
                    <div className={styles.commentAvatar}>
                      {author[0]?.toUpperCase() || "?"}
                    </div>
                    <div className={styles.commentBubble}>
                      <div className={styles.commentMeta}>
                        <span className={styles.commentAuthor}>{author}</span>
                        <span className={styles.commentTime}>
                          {fmtDateTime(c.created_at)}
                        </span>
                        {isMine && (
                          <button
                            className={styles.commentDelete}
                            onClick={() => removeComment(c.id)}
                          >
                            <IconTrash />
                          </button>
                        )}
                      </div>
                      <p className={styles.commentText}>{c.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyComments}>{t("noData")}</p>
          )}

          <div className={styles.commentForm}>
            <textarea
              className={styles.commentInput}
              placeholder={t("task.addComment")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={1}
            />
            <button
              className={styles.commentSendBtn}
              onClick={sendComment}
              disabled={commentSending || !comment.trim()}
            >
              <IconSend />
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className={styles.actionBar}>
          <div className={styles.actionsRow}>
            {actions.map((a, i) => (
              <button
                key={i}
                className={`${styles.actionBtn} ${a.secondary ? styles.actionBtnSecondary : ""}`}
                style={accentVars(a.color)}
                onClick={() => doAction(a.fn)}
                disabled={actionLoading}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function TasksPageTelegram() {
  const { t } = useTranslation();
  const { pushScreen } = useScreenStack();
  const { access } = useAuthStore();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("all");
  const [myTasks, setMyTasks] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef(null);

  const loadTasks = useCallback(async (status, my, employeeId) => {
    setLoading(true);
    try {
      const params = { page: 1, limit: 100 };
      if (status !== "all") params.status = status;
      if (my) {
        params.my_tasks = true;
        if (employeeId) params.my_employee_id = employeeId;
      }
      const res = await getTasks(params);
      setTasks(res.data || []);
    } catch (err) {
      console.error("[loadTasks]", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks(activeStatus, myTasks, access?.employee_id);
  }, [activeStatus, myTasks, access?.employee_id, loadTasks]);

  usePullToRefresh(() => loadTasks(activeStatus, myTasks, access?.employee_id), scrollRef, loading);

  const filteredTasks = searchQuery.trim()
    ? (() => {
        const q = searchQuery.trim().toLowerCase();
        return tasks.filter((task) => {
          if (task.title?.toLowerCase().includes(q)) return true;
          if (task.assignee_employee) {
            const e = task.assignee_employee;
            const fullName = [e.last_name, e.first_name, e.middle_name]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (fullName.includes(q)) return true;
            if (String(e.id).includes(q)) return true;
          }
          return false;
        });
      })()
    : tasks;

  const openDetail = (taskId) => {
    pushScreen(
      `task-${taskId}`,
      <TaskDetailScreen
        taskId={taskId}
        onUpdate={(updated) => {
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
          );
        }}
      />,
    );
  };

  const openAdd = () => {
    pushScreen(
      "add-task",
      <AddTaskScreen
        onCreated={(newTask) => {
          setTasks((prev) => [newTask, ...prev]);
        }}
      />,
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}><IconSearch /></span>
            <input
              className={styles.searchInput}
              type="text"
              placeholder={t("task.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchQuery("")}
              >
                <IconClose />
              </button>
            )}
          </div>
          <button className={styles.addBtn} onClick={openAdd} aria-label={t("task.addTask")}>
            <IconPlus />
          </button>
        </div>

        <div className={styles.chipsRow}>
          {STATUS_CHIPS.map((chip) => {
            const isActive = chip.key === activeStatus && !myTasks;
            return (
              <button
                key={chip.key}
                className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                style={accentVars(chip.color)}
                onClick={() => {
                  setMyTasks(false);
                  setActiveStatus(chip.key);
                }}
              >
                <span className={styles.chipDot} />
                {chip.key === "all" ? t("all") || "Все" : t(`status.${chip.key}`)}
              </button>
            );
          })}
          <button
            className={`${styles.chip} ${myTasks ? styles.chipActive : ""}`}
            style={accentVars("#8b5cf6")}
            onClick={() => { setActiveStatus("all"); setMyTasks((v) => !v); }}
          >
            <span className={styles.chipDot} />
            {t("task.myTasks")}
          </button>
        </div>
      </div>

      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        {loading ? (
          <div className={styles.loadingWrap}>
            <Loading />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><IconClipboard /></div>
            <p className={styles.emptyText}>{t("noData")}</p>
          </div>
        ) : (
          <div className={styles.taskList}>
            {filteredTasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                onClick={() => openDetail(task.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
