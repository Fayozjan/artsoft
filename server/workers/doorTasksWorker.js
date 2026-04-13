import { EmployeeDoorTasksService } from "../modules/employeeDoorTasks/employeeDoorTasks.service.js";

let isRunning = false;

export function startDoorTasksWorker(intervalMs = 10_000) {
  console.log("[DoorTasksWorker] Запущен");

  setInterval(async () => {
    if (isRunning) return;

    isRunning = true;
    try {
      await EmployeeDoorTasksService.processPendingTasks();
    } catch (err) {
      console.error("[DoorTasksWorker] Критическая ошибка:", err.message);
    } finally {
      isRunning = false;
    }
  }, intervalMs);
}
