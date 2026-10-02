import path from "path";
import { TaskModel } from "./tasks.model.js";
import { createAuditLog } from "../../utils/auditLog.js";
import { prismaContext } from "../../utils/prismaContext.js";
import { prismaPublic } from "../../utils/prismaForTenant.js";
import { tenantContext } from "../../utils/tenantContext.js";
import { buildTaskKeyboard } from "../../services/telegram-bot/src/handlers/employeeTaskHandler.js";
import axios from "axios";

async function sendTelegramMessage(chatId, text, replyMarkup) {
  const token = process.env.BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup || undefined,
    });
  } catch (err) {
    console.error("[tasks] Telegram notification failed:", err.message);
  }
}

function buildTaskMessage(task) {
  const assigneeName = task.assignee_employee
    ? [task.assignee_employee.last_name, task.assignee_employee.first_name].filter(Boolean).join(" ")
    : task.assignee_department?.name || task.assignee_position?.name || task.assignee_user?.username || "—";

  const priorityMap = { low: "Низкий", medium: "Средний", high: "Высокий" };
  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("ru-RU")
    : "не указан";

  const lines = [
    `📋 <b>Новая задача</b>`,
    ``,
    `<b>${task.title}</b>`,
    task.description ? `📝 ${task.description}` : null,
    ``,
    `👤 <b>Исполнитель:</b> ${assigneeName}`,
    `🔥 <b>Приоритет:</b> ${priorityMap[task.priority] || task.priority}`,
    `📅 <b>Дедлайн:</b> ${deadline}`,
    task.created_by ? `✍️ <b>Создал:</b> ${task.created_by.username}` : null,
  ];

  return lines.filter((l) => l !== null).join("\n");
}

async function notifyAssignee(task) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;

  const schema = tenantContext.get()?.schema;
  const text = buildTaskMessage(task);
  const keyboard = buildTaskKeyboard(task);

  if (task.assignee_employee_id && schema) {
    const reg = await prismaPublic.employee_telegram_chats.findFirst({
      where: { schema_name: schema, employee_id: task.assignee_employee_id },
    });
    if (reg) {
      await sendTelegramMessage(reg.chat_id, text, keyboard);
      return;
    }
  }

  if (task.assignee_employee_id) {
    const prisma = prismaContext.get();
    const user = await prisma.users.findFirst({
      where: { employee_id: task.assignee_employee_id },
      select: { telegram_id: true },
    });
    if (user?.telegram_id) {
      await sendTelegramMessage(user.telegram_id, text, keyboard);
      return;
    }
  }

  if (task.assignee_user_id) {
    const prisma = prismaContext.get();
    const user = await prisma.users.findUnique({
      where: { id: task.assignee_user_id },
      select: { telegram_id: true },
    });
    if (user?.telegram_id) {
      await sendTelegramMessage(user.telegram_id, text, keyboard);
    }
  }
}

export const TasksService = {
  getAll: async ({ page, pageSize, filters = {}, userId }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const andConditions = [];
    if (filters.search) andConditions.push({ title: { contains: filters.search, mode: "insensitive" } });
    if (filters.status) andConditions.push({ status: filters.status });
    if (filters.priority) andConditions.push({ priority: filters.priority });
    if (filters.assignee_employee_id) andConditions.push({ assignee_employee_id: Number(filters.assignee_employee_id) });
    if (filters.created_by_id) andConditions.push({ created_by_id: Number(filters.created_by_id) });

    if (filters.branch_id) {
      andConditions.push({ assignee_employee: { branch_id: Number(filters.branch_id) } });
    }
    if (filters.department_id) {
      andConditions.push({
        OR: [
          { assignee_employee: { department_id: Number(filters.department_id) } },
          { assignee_department_id: Number(filters.department_id) },
        ],
      });
    }
    if (filters.position_id) {
      andConditions.push({
        OR: [
          { assignee_employee: { position_id: Number(filters.position_id) } },
          { assignee_position_id: Number(filters.position_id) },
        ],
      });
    }
    if (filters.overdue) {
      andConditions.push({
        deadline: { lt: new Date() },
        status: { notIn: ["done", "confirmed", "cancelled"] },
      });
    }

    if (filters.my_tasks && userId) {
      const prisma = prismaContext.get();
      let employeeId = filters.my_employee_id ? Number(filters.my_employee_id) : null;
      if (!employeeId) {
        try {
          const me = await prisma.users.findUnique({ where: { id: Number(userId) }, select: { employee_id: true } });
          employeeId = me?.employee_id ?? null;
        } catch {}
      }
      const myConditions = [{ assignee_user_id: Number(userId) }];
      if (employeeId) myConditions.push({ assignee_employee_id: employeeId });
      andConditions.push({ OR: myConditions });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [data, total] = await Promise.all([
      TaskModel.findMany({ where, skip, take: limit }),
      TaskModel.count(where),
    ]);

    return {
      data,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getById: async (id) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    return task;
  },

  create: async (data, userId) => {
    if (data.deadline && typeof data.deadline === "string" && !data.deadline.includes("T")) {
      data = { ...data, deadline: new Date(data.deadline + "T00:00:00.000Z") };
    }
    const hasAssignee = Boolean(
      data.assignee_employee_id || data.assignee_department_id || data.assignee_position_id || data.assignee_user_id
    );
    const task = await TaskModel.create({
      ...data,
      created_by_id: Number(userId),
      ...(hasAssignee ? { status: "assigned", published_at: new Date() } : {}),
    });
    await createAuditLog({ userId, action: "create", entity: "tasks", recordId: task.id, newData: task });
    if (hasAssignee) await notifyAssignee(task);
    return task;
  },

  update: async (id, data, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    if (task.status !== "draft") throw new Error("CANNOT_EDIT");
    if (data.deadline && typeof data.deadline === "string" && !data.deadline.includes("T")) {
      data = { ...data, deadline: new Date(data.deadline + "T00:00:00.000Z") };
    }
    const updated = await TaskModel.update(id, data);
    await createAuditLog({ userId, action: "update", entity: "tasks", recordId: id, oldData: task, newData: updated });
    return updated;
  },

  remove: async (id, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    await TaskModel.remove(id);
    await createAuditLog({ userId, action: "delete", entity: "tasks", recordId: id, oldData: task });
  },

  publish: async (id, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    if (task.status !== "draft") throw new Error("INVALID_STATUS");
    if (task.created_by_id !== Number(userId)) throw new Error("FORBIDDEN");
    const updated = await TaskModel.update(id, { status: "assigned", published_at: new Date() });
    await notifyAssignee(updated);
    return updated;
  },

  accept: async (id, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    if (task.status !== "assigned") throw new Error("INVALID_STATUS");
    return TaskModel.update(id, { status: "in_progress", accepted_at: new Date() });
  },

  unpublish: async (id, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    if (task.status !== "assigned") throw new Error("INVALID_STATUS");
    if (task.created_by_id !== Number(userId)) throw new Error("FORBIDDEN");
    return TaskModel.update(id, { status: "draft", published_at: null });
  },

  unaccept: async (id, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    if (task.status !== "in_progress") throw new Error("INVALID_STATUS");
    return TaskModel.update(id, { status: "assigned", accepted_at: null });
  },

  uncomplete: async (id, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    if (task.status !== "done") throw new Error("INVALID_STATUS");
    return TaskModel.update(id, { status: "in_progress", completed_at: null });
  },

  complete: async (id, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    if (task.status !== "in_progress") throw new Error("INVALID_STATUS");
    return TaskModel.update(id, { status: "done", completed_at: new Date() });
  },

  cancel: async (id, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    if (["done", "confirmed"].includes(task.status)) throw new Error("INVALID_STATUS");
    return TaskModel.update(id, { status: "cancelled", cancelled_at: new Date() });
  },

  uncancel: async (id, userId) => {
    const task = await TaskModel.findById(id);
    if (!task) throw new Error("NOT_FOUND");
    if (task.status !== "cancelled") throw new Error("INVALID_STATUS");
    return TaskModel.update(id, { status: "draft", cancelled_at: null });
  },

  addComment: async (taskId, userId, text) => {
    return TaskModel.addComment(taskId, userId, text);
  },

  removeComment: async (taskId, commentId, userId) => {
    const comment = await TaskModel.findCommentById(commentId);
    if (!comment || comment.task_id !== Number(taskId)) throw new Error("NOT_FOUND");
    return TaskModel.removeComment(commentId);
  },

  addFile: async (taskId, userId, file) => {
    // Храним относительный путь от uploads/tasks с прямыми слэшами (не зависит от ОС),
    // чтобы ссылка на скачивание строилась одинаково на Windows и Linux.
    const baseDir = path.join(process.cwd(), "uploads", "tasks");
    const relPath = path.relative(baseDir, file.path).split(path.sep).join("/");
    return TaskModel.addFile(taskId, {
      file_name: file.originalname,
      file_path: relPath,
      file_size: file.size,
      uploaded_by_id: Number(userId),
    });
  },

  removeFile: async (taskId, fileId, userId) => {
    const file = await TaskModel.findFileById(fileId);
    if (!file || file.task_id !== Number(taskId)) throw new Error("NOT_FOUND");
    return TaskModel.removeFile(fileId);
  },
};
