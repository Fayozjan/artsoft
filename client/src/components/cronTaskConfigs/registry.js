import AttendanceReportConfig from "./AttendanceReportConfig";
import LateEmployeesReportConfig from "./LateEmployeesReportConfig";
import TabelReportConfig from "./TabelReportConfig";
import ReportsBundleConfig from "./ReportsBundleConfig";
import DatabaseBackupConfig from "./DatabaseBackupConfig";
import EventsSyncConfig from "./EventsSyncConfig";
import CanteenReportConfig from "./CanteenReportConfig";

// Реестр типов крон-задач для фронта — зеркало server/modules/cronTasks/cronTasks.taskTypes.js.
// Новый тип = одна запись здесь + файл под-формы рядом. AddCronTask / EditCronTask /
// CronTasksPage читают этот реестр и не меняются.
//
// labelKey  — ключ i18n для названия типа
// Config    — под-форма конфигурации, props: { config, onChange }
// defaults  — фабрика пустого config (функция, чтобы вложенные объекты не шарились между формами)
// summary   — короткая строка конфигурации для колонки таблицы
export const CRON_TASK_REGISTRY = {
  attendance_report: {
    labelKey: "attendanceReportTaskType",
    Config: AttendanceReportConfig,
    defaults: () => ({
      chat_ids: [],
      format: "excel",
      display_mode: "byBranch",
      language: "ru",
      filter: { branches: [], departments: [], employees: [], positions: [] },
    }),
    summary: (config) =>
      [(config?.chat_ids || []).join(", "), config?.display_mode].filter(Boolean).join(" · "),
  },

  late_employees_report: {
    labelKey: "lateEmployeesReportTaskType",
    Config: LateEmployeesReportConfig,
    defaults: () => ({
      chat_ids: [],
      format: "excel",
      language: "ru",
      include_lunch_late: false,
      filter: { branches: [], departments: [], employees: [], positions: [] },
    }),
    summary: (config) =>
      [(config?.chat_ids || []).join(", "), config?.format].filter(Boolean).join(" · "),
  },

  tabel_report: {
    labelKey: "tabelReportTaskType",
    Config: TabelReportConfig,
    defaults: () => ({
      chat_ids: [],
      language: "ru",
      report_type: "summary",
      filter: {
        branch_ids: [],
        department_ids: [],
        employee_ids: [],
        position_ids: [],
        status: "",
        hasEvents: "",
      },
    }),
    summary: (config) =>
      [(config?.chat_ids || []).join(", "), config?.report_type].filter(Boolean).join(" · "),
  },

  reports_bundle: {
    labelKey: "reportsBundleTaskType",
    Config: ReportsBundleConfig,
    defaults: () => ({
      chat_ids: [],
      language: "ru",
      include_lunch_late: false,
      filter: { employees: [], branches: [] },
    }),
    summary: (config) =>
      [(config?.chat_ids || []).join(", "), config?.language].filter(Boolean).join(" · "),
  },

  database_backup: {
    labelKey: "databaseBackupTaskType",
    Config: DatabaseBackupConfig,
    defaults: () => ({ chat_ids: [] }),
    summary: (config) => (config?.chat_ids || []).join(", "),
  },

  canteen_report: {
    labelKey: "canteenReportTaskType",
    Config: CanteenReportConfig,
    defaults: () => ({
      chat_ids: [],
      language: "ru",
      period: "today",
      group_by: "employee",
      filter: { branch_id: "", department_id: "", position_id: "", device_id: "" },
    }),
    summary: (config, t) =>
      [(config?.chat_ids || []).join(", "), config?.period ? t("canteenPeriod_" + config.period) : ""]
        .filter(Boolean)
        .join(" · "),
  },

  events_sync: {
    labelKey: "eventsSyncTaskType",
    Config: EventsSyncConfig,
    defaults: () => ({ window_minutes: 60 }),
    summary: (config, t) =>
      config?.window_minutes ? t("windowMinutesShort", { minutes: config.window_minutes }) : "",
  },
};

export const CRON_TASK_TYPES = Object.keys(CRON_TASK_REGISTRY);

export const getCronTaskType = (taskType) => CRON_TASK_REGISTRY[taskType] || null;

export const getCronTaskDefaults = (taskType) =>
  CRON_TASK_REGISTRY[taskType]?.defaults() ?? {};
