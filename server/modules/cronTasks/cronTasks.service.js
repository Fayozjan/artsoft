import { CronTasksModel } from "./cronTasks.model.js";
import { cronTaskTypes, CRON_TASK_TYPES } from "./cronTasks.taskTypes.js";
import { createAuditLog } from "../../utils/auditLog.js";

const SCHEDULE_KINDS = ["daily", "interval"];
const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 60 * 24 * 30; // 30 дней

// Возвращает полный набор полей расписания: неиспользуемые для выбранного вида
// обнуляются, чтобы в строке не оставалось расписание от прошлого вида.
function validateSchedule({ schedule_kind, hour, minute, days_of_week, interval_minutes }) {
  const kind = schedule_kind || "daily";
  if (!SCHEDULE_KINDS.includes(kind)) {
    throw new Error("Некорректный вид расписания");
  }

  if (kind === "interval") {
    const n = Number(interval_minutes);
    if (!Number.isInteger(n) || n < MIN_INTERVAL_MINUTES || n > MAX_INTERVAL_MINUTES) {
      throw new Error(`Интервал должен быть от ${MIN_INTERVAL_MINUTES} до ${MAX_INTERVAL_MINUTES} минут`);
    }
    return { schedule_kind: kind, interval_minutes: n, hour: null, minute: null, days_of_week: [] };
  }

  const h = Number(hour);
  const m = Number(minute);

  if (!Number.isInteger(h) || h < 0 || h > 23) {
    throw new Error("Некорректный час (0-23)");
  }
  if (!Number.isInteger(m) || m < 0 || m > 59) {
    throw new Error("Некорректная минута (0-59)");
  }
  if (!Array.isArray(days_of_week) || !days_of_week.length) {
    throw new Error("Нужно выбрать хотя бы один день недели");
  }

  const days = days_of_week.map(Number);
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
    throw new Error("Некорректный день недели (1-7)");
  }

  return { schedule_kind: kind, hour: h, minute: m, days_of_week: days, interval_minutes: null };
}

export const CronTasksService = {
  getAll: async () => CronTasksModel.getAll(),

  getById: async (id) => CronTasksModel.getById(id),

  create: async ({ name, task_type, config, schedule_kind, hour, minute, days_of_week, interval_minutes, userId }) => {
    if (!name?.trim()) {
      throw new Error("Название задачи обязательно");
    }
    if (!CRON_TASK_TYPES.includes(task_type)) {
      throw new Error("Неизвестный тип задачи");
    }

    const schedule = validateSchedule({ schedule_kind, hour, minute, days_of_week, interval_minutes });
    const validatedConfig = cronTaskTypes[task_type].validateConfig(config);

    const result = await CronTasksModel.create({
      name: name.trim(),
      task_type,
      config: validatedConfig,
      ...schedule,
      created_by: userId,
    });

    await createAuditLog({ userId, action: "create", entity: "cron_tasks", recordId: result.id, newData: result });
    return result;
  },

  update: async ({ id, name, task_type, config, schedule_kind, hour, minute, days_of_week, interval_minutes, status, userId }) => {
    const existing = await CronTasksModel.getById(id);
    if (!existing) {
      throw new Error("Задача не найдена");
    }

    const type = task_type || existing.task_type;
    if (!CRON_TASK_TYPES.includes(type)) {
      throw new Error("Неизвестный тип задачи");
    }

    const schedule = validateSchedule({
      schedule_kind: schedule_kind ?? existing.schedule_kind,
      hour: hour ?? existing.hour,
      minute: minute ?? existing.minute,
      days_of_week: days_of_week ?? existing.days_of_week,
      interval_minutes: interval_minutes ?? existing.interval_minutes,
    });
    const validatedConfig = cronTaskTypes[type].validateConfig(config ?? existing.config);

    const result = await CronTasksModel.update(id, {
      name: name?.trim() || existing.name,
      task_type: type,
      config: validatedConfig,
      ...schedule,
      status: typeof status === "boolean" ? status : existing.status,
    });

    await createAuditLog({ userId, action: "update", entity: "cron_tasks", recordId: id, oldData: existing, newData: result });
    return result;
  },

  toggle: async ({ id, userId }) => {
    const existing = await CronTasksModel.getById(id);
    if (!existing) {
      throw new Error("Задача не найдена");
    }

    const result = await CronTasksModel.update(id, { status: !existing.status });
    await createAuditLog({ userId, action: "update", entity: "cron_tasks", recordId: id, oldData: existing, newData: result });
    return result;
  },

  delete: async ({ id, userId }) => {
    const existing = await CronTasksModel.getById(id);
    if (!existing) {
      throw new Error("Задача не найдена");
    }

    const result = await CronTasksModel.delete(id);
    await createAuditLog({ userId, action: "delete", entity: "cron_tasks", recordId: id, oldData: existing });
    return result;
  },

  runNow: async (id) => {
    const row = await CronTasksModel.getById(id);
    if (!row) {
      throw new Error("Задача не найдена");
    }

    const taskType = cronTaskTypes[row.task_type];
    if (!taskType) {
      throw new Error("Неизвестный тип задачи");
    }

    try {
      const result = await taskType.execute(row);
      await CronTasksModel.markRun(id, { status: "success", error: result?.error ?? null });
      return result;
    } catch (err) {
      await CronTasksModel.markRun(id, { status: "error", error: err.message });
      throw err;
    }
  },
};
