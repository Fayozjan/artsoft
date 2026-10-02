import { runAttendanceReportTask } from "../../services/cronTasks/executors/attendanceReportExecutor.js";
import { runLateEmployeesReportTask } from "../../services/cronTasks/executors/lateEmployeesReportExecutor.js";
import { runDatabaseBackupTask } from "../../services/cronTasks/executors/databaseBackupExecutor.js";
import { runTabelReportTask } from "../../services/cronTasks/executors/tabelReportExecutor.js";
import { runReportsBundleTask } from "../../services/cronTasks/executors/reportsBundleExecutor.js";
import { runEventsSyncTask } from "../../services/cronTasks/executors/eventsSyncExecutor.js";
import { runCanteenReportTask } from "../../services/cronTasks/executors/canteenReportExecutor.js";
import { EXCEL_LANGUAGES, DEFAULT_EXCEL_LANGUAGE } from "../../utils/excelLocales.js";

const DISPLAY_MODES = ["byBranch", "byDepartments", "byEmployees"];
const REPORT_FORMATS = ["excel", "pdf"];
const TABEL_REPORT_TYPES = ["summary", "detailed"];
const CANTEEN_PERIODS = ["today", "yesterday", "week", "month", "prev_month"];
const CANTEEN_GROUP_BY = ["employee", "department", "branch"];
const MIN_WINDOW_MINUTES = 5;
const MAX_WINDOW_MINUTES = 60 * 24 * 60; // 60 дней

function normalizeChatIds(config) {
  const raw = Array.isArray(config.chat_ids) ? config.chat_ids : config.chat_id ? [config.chat_id] : [];
  const chatIds = [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))];
  if (!chatIds.length) {
    throw new Error("Нужно указать хотя бы один chat_id");
  }
  return chatIds;
}

function validateAttendanceReportConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Конфигурация задачи обязательна");
  }
  const chat_ids = normalizeChatIds(config);
  if (!DISPLAY_MODES.includes(config.display_mode)) {
    throw new Error("Некорректный режим отображения");
  }
  if (config.format !== undefined && !REPORT_FORMATS.includes(config.format)) {
    throw new Error("Некорректный формат отчёта");
  }
  if (config.language !== undefined && !EXCEL_LANGUAGES.includes(config.language)) {
    throw new Error("Некорректный язык отчёта");
  }

  const filter = config.filter || {};
  for (const key of ["branches", "departments", "employees", "positions"]) {
    if (filter[key] !== undefined && !Array.isArray(filter[key])) {
      throw new Error(`filter.${key} должен быть массивом`);
    }
  }

  return {
    chat_ids,
    display_mode: config.display_mode,
    format: config.format || "excel",
    language: config.language || DEFAULT_EXCEL_LANGUAGE,
    filter: {
      branches: filter.branches || [],
      departments: filter.departments || [],
      employees: filter.employees || [],
      positions: filter.positions || [],
    },
  };
}

function validateLateEmployeesReportConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Конфигурация задачи обязательна");
  }
  const chat_ids = normalizeChatIds(config);
  if (!REPORT_FORMATS.includes(config.format)) {
    throw new Error("Некорректный формат отчёта");
  }
  if (config.language !== undefined && !EXCEL_LANGUAGES.includes(config.language)) {
    throw new Error("Некорректный язык отчёта");
  }

  const filter = config.filter || {};
  for (const key of ["branches", "departments", "employees", "positions"]) {
    if (filter[key] !== undefined && !Array.isArray(filter[key])) {
      throw new Error(`filter.${key} должен быть массивом`);
    }
  }

  return {
    chat_ids,
    format: config.format,
    language: config.language || DEFAULT_EXCEL_LANGUAGE,
    include_lunch_late: !!config.include_lunch_late,
    filter: {
      branches: filter.branches || [],
      departments: filter.departments || [],
      employees: filter.employees || [],
      positions: filter.positions || [],
    },
  };
}

// Форма filter повторяет PRESET_FIELDS в client/src/components/TimesheetFilter.jsx (ID-based,
// не name-based, как у attendance_report/late_employees_report) — сохранённый timesheet-пресет
// подставляется в config.filter без преобразования.
function validateTabelReportConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Конфигурация задачи обязательна");
  }
  const chat_ids = normalizeChatIds(config);
  if (config.language !== undefined && !EXCEL_LANGUAGES.includes(config.language)) {
    throw new Error("Некорректный язык отчёта");
  }
  if (config.report_type !== undefined && !TABEL_REPORT_TYPES.includes(config.report_type)) {
    throw new Error("Некорректный тип отчёта");
  }

  const filter = config.filter || {};
  for (const key of ["branch_ids", "department_ids", "employee_ids", "position_ids"]) {
    if (filter[key] !== undefined && !Array.isArray(filter[key])) {
      throw new Error(`filter.${key} должен быть массивом`);
    }
  }
  if (filter.status !== undefined && !["", "true", "false"].includes(filter.status)) {
    throw new Error("Некорректный статус сотрудника в фильтре");
  }
  if (filter.hasEvents !== undefined && !["", "yes", "no"].includes(filter.hasEvents)) {
    throw new Error("Некорректное значение hasEvents в фильтре");
  }

  return {
    chat_ids,
    language: config.language || DEFAULT_EXCEL_LANGUAGE,
    report_type: config.report_type || "summary",
    filter: {
      branch_ids: filter.branch_ids || [],
      department_ids: filter.department_ids || [],
      employee_ids: filter.employee_ids || [],
      position_ids: filter.position_ids || [],
      status: filter.status || "",
      hasEvents: filter.hasEvents || "",
    },
  };
}

function validateReportsBundleConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Конфигурация задачи обязательна");
  }
  const chat_ids = normalizeChatIds(config);
  if (config.language !== undefined && !EXCEL_LANGUAGES.includes(config.language)) {
    throw new Error("Некорректный язык отчёта");
  }

  const filter = config.filter || {};
  for (const key of ["employees", "branches"]) {
    if (filter[key] !== undefined && !Array.isArray(filter[key])) {
      throw new Error(`filter.${key} должен быть массивом`);
    }
  }

  return {
    chat_ids,
    language: config.language || DEFAULT_EXCEL_LANGUAGE,
    include_lunch_late: !!config.include_lunch_late,
    filter: {
      employees: filter.employees || [],
      branches: filter.branches || [],
    },
  };
}

// Единственный тип без chat_ids: задача ничего не отправляет, а тянет события с устройств.
function validateEventsSyncConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Конфигурация задачи обязательна");
  }

  const windowMinutes = Number(config.window_minutes);
  if (
    !Number.isInteger(windowMinutes) ||
    windowMinutes < MIN_WINDOW_MINUTES ||
    windowMinutes > MAX_WINDOW_MINUTES
  ) {
    throw new Error(
      `Окно синхронизации должно быть от ${MIN_WINDOW_MINUTES} до ${MAX_WINDOW_MINUTES} минут`,
    );
  }

  return { window_minutes: windowMinutes };
}

function validateDatabaseBackupConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Конфигурация задачи обязательна");
  }
  const chat_ids = normalizeChatIds(config);

  return { chat_ids };
}

// Фильтр столовой — одиночные id (как в CanteenReportPage.jsx), а не массивы:
// CanteenService.getReport принимает branch_id/department_id/position_id/device_id по одному.
function validateCanteenReportConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Конфигурация задачи обязательна");
  }
  const chat_ids = normalizeChatIds(config);
  if (config.language !== undefined && !EXCEL_LANGUAGES.includes(config.language)) {
    throw new Error("Некорректный язык отчёта");
  }
  if (config.period !== undefined && !CANTEEN_PERIODS.includes(config.period)) {
    throw new Error("Некорректный период отчёта");
  }
  if (config.group_by !== undefined && !CANTEEN_GROUP_BY.includes(config.group_by)) {
    throw new Error("Некорректная группировка отчёта");
  }

  const filter = config.filter || {};
  const normalizeId = (value) => {
    if (value === undefined || value === null || value === "") return "";
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Некорректный фильтр отчёта столовой");
    }
    return String(id);
  };

  return {
    chat_ids,
    language: config.language || DEFAULT_EXCEL_LANGUAGE,
    period: config.period || "today",
    group_by: config.group_by || "employee",
    filter: {
      branch_id: normalizeId(filter.branch_id),
      department_id: normalizeId(filter.department_id),
      position_id: normalizeId(filter.position_id),
      device_id: normalizeId(filter.device_id),
    },
  };
}

// Реестр типов крон-задач. Добавление нового типа = новая запись здесь
// (+ фронтовая под-форма конфигурации) — CRUD/список/планировщик не меняются.
export const cronTaskTypes = {
  attendance_report: {
    validateConfig: validateAttendanceReportConfig,
    execute: runAttendanceReportTask,
  },
  late_employees_report: {
    validateConfig: validateLateEmployeesReportConfig,
    execute: runLateEmployeesReportTask,
  },
  tabel_report: {
    validateConfig: validateTabelReportConfig,
    execute: runTabelReportTask,
  },
  reports_bundle: {
    validateConfig: validateReportsBundleConfig,
    execute: runReportsBundleTask,
  },
  database_backup: {
    validateConfig: validateDatabaseBackupConfig,
    execute: runDatabaseBackupTask,
  },
  canteen_report: {
    validateConfig: validateCanteenReportConfig,
    execute: runCanteenReportTask,
  },
  events_sync: {
    validateConfig: validateEventsSyncConfig,
    execute: runEventsSyncTask,
  },
};

export const CRON_TASK_TYPES = Object.keys(cronTaskTypes);
