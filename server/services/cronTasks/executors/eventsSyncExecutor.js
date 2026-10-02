import { events_checker_window } from "../../../utils/hikEventChecker.js";

// Забирает события с face-устройств за последние config.window_minutes.
// Заменяет зашитые тиры старого scheduleEventsChecker: один тир = одна крон-задача
// с schedule_kind="interval" (как часто) + window_minutes (за какой период).
export async function runEventsSyncTask(row) {
  const windowMinutes = row.config?.window_minutes ?? 60;

  console.log(`🚀 [events_sync] "${row.name}": окно ${windowMinutes} мин.`);
  const { startTime, endTime } = await events_checker_window(windowMinutes);

  return { window_minutes: windowMinutes, startTime, endTime };
}
