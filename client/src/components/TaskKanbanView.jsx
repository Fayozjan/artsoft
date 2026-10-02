import { useTranslation } from "react-i18next";
import { User, Calendar } from "lucide-react";
import styles from "./TaskKanbanView.module.scss";

const COLUMNS = [
  { key: "draft", color: "#94a3b8" },
  { key: "assigned", color: "#f59e0b" },
  { key: "in_progress", color: "#3b82f6" },
  { key: "done", color: "#10b981" },
];

const PRIORITY_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
};

function getAssigneeName(task) {
  if (task.assignee_employee) {
    const { first_name, last_name } = task.assignee_employee;
    return [last_name, first_name].filter(Boolean).join(" ") || null;
  }
  if (task.assignee_department) return task.assignee_department.name;
  if (task.assignee_position) return task.assignee_position.name;
  if (task.assignee_user) return task.assignee_user.username;
  return null;
}

const TaskKanbanView = ({ tasks, onTaskClick }) => {
  const { t } = useTranslation();

  const tasksByStatus = {};
  COLUMNS.forEach((col) => {
    tasksByStatus[col.key] = tasks.filter((t) =>
      col.key === "done" ? t.status === "done" || t.status === "confirmed" : t.status === col.key
    );
  });

  return (
    <div className={styles.board}>
      {COLUMNS.map((col) => {
        const colTasks = tasksByStatus[col.key] || [];
        return (
          <div className={styles.column} key={col.key}>
            <div
              className={styles.columnHeader}
              style={{ background: col.color + "18", color: col.color }}
            >
              <span className={styles.columnTitle}>{t(`status.${col.key}`)}</span>
              <span className={styles.columnCount}>{colTasks.length}</span>
            </div>
            <div className={styles.cards}>
              {colTasks.map((task) => {
                const priorityColor = PRIORITY_COLORS[task.priority] || "#f59e0b";
                const assignee = getAssigneeName(task);
                const deadline = task.deadline
                  ? new Date(task.deadline).toLocaleDateString("ru-RU")
                  : null;
                const isOverdue = task.deadline && new Date(task.deadline) < new Date()
                  && !["done", "confirmed", "cancelled"].includes(task.status);

                return (
                  <div
                    className={styles.card}
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    style={{ borderLeft: `3px solid ${col.color}` }}
                  >
                    <div className={styles.cardTitle}>{task.title}</div>
                    <div className={styles.cardMeta}>
                      <div className={styles.cardRow}>
                        <span
                          className={styles.priorityDot}
                          style={{ background: priorityColor }}
                        />
                        <span>{t(`priority.${task.priority}`)}</span>
                      </div>
                      {assignee && (
                        <div className={styles.cardRow}>
                          <User size={11} />
                          <span>{assignee}</span>
                        </div>
                      )}
                      {deadline && (
                        <div className={`${styles.cardRow} ${isOverdue ? styles.deadlineOverdue : ""}`}>
                          <Calendar size={11} />
                          <span>{deadline}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TaskKanbanView;
