import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Pencil, Download } from "lucide-react";
import { useAlertStore } from "../stores/alertStore";
import EmployeeCell from "./EmployeeCell";
import {
  getTaskById,
  publishTask,
  unpublishTask,
  acceptTask,
  unacceptTask,
  completeTask,
  uncompleteTask,
  uncancelTask,
  addTaskComment,
  deleteTaskComment,
  uploadTaskFile,
  deleteTaskFile,
} from "../api";
import styles from "./TaskDetail.module.scss";

function formatDuration(ms, t) {
  if (!ms || ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return t("durationDaysHours", { days, hours });
  if (hours > 0) return t("durationHoursMinutes", { hours, minutes: mins });
  return t("durationMinutes", { minutes: mins });
}

function fmtDt(dt) {
  if (!dt) return null;
  return new Date(dt).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

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

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

const TaskDetail = ({ id, currentUser, canEdit, onEdit, onRefresh, onClose }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const fileInputRef = useRef(null);

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTask = async () => {
    try {
      const { data } = await getTaskById(id);
      setTask(data);
    } catch (err) {
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchTask();
  }, [id]);

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      const actionMap = {
        publish: publishTask,
        unpublish: unpublishTask,
        accept: acceptTask,
        unaccept: unacceptTask,
        complete: completeTask,
        uncomplete: uncompleteTask,
        uncancel: uncancelTask,
      };
      await actionMap[action](id);
      await fetchTask();
      onRefresh?.();
      showAlert(t("success"), "success");
    } catch (err) {
      const msg = err.response?.data?.error || t("error");
      showAlert(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addTaskComment(id, commentText.trim());
      setCommentText("");
      await fetchTask();
    } catch (err) {
      showAlert(t("error"), "error");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteTaskComment(id, commentId);
      await fetchTask();
    } catch (err) {
      showAlert(t("error"), "error");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await uploadTaskFile(id, formData);
      await fetchTask();
      showAlert(t("success"), "success");
    } catch (err) {
      showAlert(t("error"), "error");
    }
    e.target.value = "";
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await deleteTaskFile(id, fileId);
      await fetchTask();
    } catch (err) {
      showAlert(t("error"), "error");
    }
  };

  if (loading) return <div style={{ padding: 16, color: "var(--text-secondary)" }}>{t("loading")}...</div>;
  if (!task) return null;

  const isCreator = currentUser?.id === task.created_by_id;
  const isAssignee =
    (task.assignee_user_id && currentUser?.id === task.assignee_user_id) ||
    (task.assignee_employee_id && currentUser?.employee_id === task.assignee_employee_id);
  const statusColor = STATUS_COLORS[task.status] || "#94a3b8";
  const priorityColor = PRIORITY_COLORS[task.priority] || "#f59e0b";

  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("ru-RU")
    : null;
  const assignedAt = task.published_at
    ? new Date(task.published_at).toLocaleDateString("ru-RU")
    : null;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && !["done", "confirmed", "cancelled"].includes(task.status);

  return (
    <div className={styles.detail}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleRow}>
            <h2>{task.title}</h2>
            <span className={styles.badge} style={{ background: priorityColor + "20", color: priorityColor }}>
              {t(`priority.${task.priority}`)}
            </span>
          </div>
          <div className={styles.statusGroup}>
            <span className={styles.statusBadge} style={{ background: statusColor + "20", color: statusColor }}>
              {t(`status.${task.status}`)}
            </span>
            {task.status === "draft" && isCreator && canEdit && (
              <button className={styles.editIconBtn} onClick={() => onEdit(task)} title={t("edit")} aria-label={t("edit")}>
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
        <div className={styles.peopleRow}>
          <div className={styles.personBlock}>
            <span className={styles.personLabel}>{t("task.assignee")}</span>
            {task.assignee_employee ? (
              <EmployeeCell
                compact
                id={task.assignee_employee.id}
                photo={task.assignee_employee.photo}
                lastName={task.assignee_employee.last_name}
                firstName={task.assignee_employee.first_name}
                middleName={task.assignee_employee.middle_name}
                branch={task.assignee_employee.branch?.name}
                department={task.assignee_employee.department?.name}
                position={task.assignee_employee.position?.name}
              />
            ) : (
              <span className={styles.personFallback}>{getAssigneeName(task)}</span>
            )}
          </div>
          <div className={styles.personBlock}>
            <span className={styles.personLabel}>{t("task.createdBy")}</span>
            {task.created_by?.employee ? (
              <EmployeeCell
                compact
                id={task.created_by.employee_id}
                photo={task.created_by.employee.photo}
                lastName={task.created_by.employee.last_name}
                firstName={task.created_by.employee.first_name}
                middleName={task.created_by.employee.middle_name}
                branch={task.created_by.employee.branch?.name}
                department={task.created_by.employee.department?.name}
                position={task.created_by.employee.position?.name}
              />
            ) : (
              <span className={styles.personFallback}>{task.created_by?.username || "—"}</span>
            )}
          </div>
        </div>
        <div className={styles.meta}>
          {assignedAt && (
            <span>{t("task.assignedAt")}: <strong>{assignedAt}</strong></span>
          )}
          {deadline && (
            <span style={isOverdue ? { color: "#ef4444" } : {}}>
              {t("task.deadline")}: <strong>{deadline}</strong>
            </span>
          )}
        </div>
      </div>

      {task.description && (
        <div className={styles.section}>
          <h3>{t("task.description")}</h3>
          <div className={styles.description}>{task.description}</div>
        </div>
      )}

      <div className={styles.actions}>
        {task.status === "draft" && isCreator && (
          <button className={styles.btnPrimary} onClick={() => handleAction("publish")} disabled={actionLoading}>
            {t("task.publish")}
          </button>
        )}
        {task.status === "assigned" && isCreator && (
          <button className={styles.btnSecondary} onClick={() => handleAction("unpublish")} disabled={actionLoading}>
            {t("task.unpublish")}
          </button>
        )}
        {task.status === "assigned" && isAssignee && (
          <button className={styles.btnSuccess} onClick={() => handleAction("accept")} disabled={actionLoading}>
            {t("task.accept")}
          </button>
        )}
        {task.status === "in_progress" && isAssignee && (
          <button className={styles.btnSecondary} onClick={() => handleAction("unaccept")} disabled={actionLoading}>
            {t("task.unaccept")}
          </button>
        )}
        {task.status === "in_progress" && isAssignee && (
          <button className={styles.btnSuccess} onClick={() => handleAction("complete")} disabled={actionLoading}>
            {t("task.complete")}
          </button>
        )}
        {task.status === "done" && isAssignee && (
          <button className={styles.btnSecondary} onClick={() => handleAction("uncomplete")} disabled={actionLoading}>
            {t("task.uncomplete")}
          </button>
        )}
        {task.status === "cancelled" && isCreator && (
          <button className={styles.btnSecondary} onClick={() => handleAction("uncancel")} disabled={actionLoading}>
            {t("task.uncancel")}
          </button>
        )}
      </div>

      <div className={styles.section}>
        <h3>{t("task.files")} <span className={styles.count}>{task.files?.length || 0}</span></h3>
        {task.files?.map((file) => (
          <div className={styles.fileItem} key={file.id}>
            <span className={styles.fileName}
              onClick={() => window.open(`/api/tasks/files/download/${file.file_path}`, "_blank")}
            >
              {file.file_name}
            </span>
            {file.file_size && <span className={styles.fileSize}>{formatSize(file.file_size)}</span>}
            <a
              className={styles.fileDownload}
              href={`/api/tasks/files/download/${file.file_path}`}
              download={file.file_name}
              title={t("downloadLabel")}
              aria-label={t("downloadLabel")}
            >
              <Download size={14} />
            </a>
            <button className={styles.fileDelete} onClick={() => handleDeleteFile(file.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
        <label className={styles.uploadBtn}>
          + {t("task.uploadFile")}
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} />
        </label>
      </div>

      <div className={styles.section}>
        <h3>{t("task.comments")} <span className={styles.count}>{task.comments?.length || 0}</span></h3>
        {task.comments?.map((comment) => (
          <div className={styles.comment} key={comment.id}>
            <div className={styles.avatar}>
              {comment.user?.username?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className={styles.commentBody}>
              <div className={styles.commentHeader}>
                <span className={styles.commentUser}>{comment.user?.username}</span>
                <span className={styles.commentTime}>
                  {new Date(comment.created_at).toLocaleString("ru-RU", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
                {currentUser?.id === comment.user_id && (
                  <button className={styles.commentDelete} onClick={() => handleDeleteComment(comment.id)}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className={styles.commentText}>{comment.text}</div>
            </div>
          </div>
        ))}

        <div className={styles.commentInput}>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t("task.addComment")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) handleAddComment();
            }}
          />
          <button onClick={handleAddComment} disabled={submittingComment || !commentText.trim()}>
            {t("send")}
          </button>
        </div>
      </div>
      <div className={styles.section}>
        <h3>{t("task.timeline")}</h3>
        <div className={styles.timeline}>
          {(() => {
            const STEP_META = {
              created:   { label: t("status.draft"),       color: "#94a3b8" },
              published: { label: t("status.assigned"),    color: "#f59e0b" },
              accepted:  { label: t("status.in_progress"), color: "#3b82f6" },
              completed: { label: t("status.done"),        color: "#10b981" },
              confirmed: { label: t("status.confirmed"),   color: "#6366f1" },
              cancelled: { label: t("status.cancelled"),   color: "#ef4444" },
            };

            const steps = [
              { key: "created",   ts: task.created_at },
              { key: "published", ts: task.published_at },
              { key: "accepted",  ts: task.accepted_at },
              { key: "completed", ts: task.completed_at },
              { key: "confirmed", ts: task.confirmed_at },
              { key: "cancelled", ts: task.cancelled_at },
            ].filter((s) => s.ts);

            return steps.map((step, i) => {
              const meta = STEP_META[step.key];
              const prev = steps[i - 1];
              const duration = prev ? formatDuration(new Date(step.ts) - new Date(prev.ts), t) : null;

              let timeliness = null;
              if (step.key === "completed" && task.deadline) {
                const diff = new Date(step.ts) - new Date(task.deadline);
                timeliness = diff <= 0
                  ? { ok: true, label: `✅ ${t("task.onTime")}` }
                  : { ok: false, label: `⏰ ${t("task.late")} ${formatDuration(diff, t)}` };
              }

              return (
                <div className={styles.timelineStep} key={step.key}>
                  <div className={styles.timelineLeft}>
                    <div className={styles.timelineDot} style={{ background: meta.color }} />
                  </div>
                  <div className={styles.timelineCard}>
                    <div className={styles.timelineCardTop}>
                      <span className={styles.timelineLabel} style={{ color: meta.color }}>{meta.label}</span>
                      <span className={styles.timelineTs}>{fmtDt(step.ts)}</span>
                    </div>
                    {(duration || timeliness) && (
                      <div className={styles.timelineBottom}>
                        {duration && <span className={styles.timelineDuration}>{duration}</span>}
                        {timeliness && (
                          <span className={timeliness.ok ? styles.timelineOnTime : styles.timelineLate}>
                            {timeliness.label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

    </div>
  );
};

export default TaskDetail;
