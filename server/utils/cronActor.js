// Крон-задачи не наследуют ограничения логина создателя: состав отчёта задаётся
// фильтром, сохранённым в config задачи, а не access_level/branch_access/view_mode юзера.
// Раньше исполнители передавали userId: row.created_by, и buildEmployeeAccess/buildDepartmentAccess
// срезали выборку до active_branch_id (режим просмотра одного филиала в UI) — филиалы,
// добавленные в фильтр задачи, в отчёт не попадали.
//
// Сервисы резолвят актора через UserModel.getById(userId), поэтому крон-актор —
// синтетический пользователь с полным доступом, отдаваемый моделью по CRON_ACTOR_ID.
// В таблице users такого id не существует (serial > 0), логином его получить нельзя.
export const CRON_ACTOR_ID = -1;

export const CRON_ACTOR = Object.freeze({
  id: CRON_ACTOR_ID,
  username: "cron",
  employee_id: null,
  access_level: "absolute",
  branch_access: [],
  department_access: [],
  view_mode: "all",
  telegram_id: null,
  active_branch_id: null,
  personal_menus: [],
  status: true,
  ignore_gps_check: false,
  menuAccess: [],
});

export const isCronActor = (id) => Number(id) === CRON_ACTOR_ID;
