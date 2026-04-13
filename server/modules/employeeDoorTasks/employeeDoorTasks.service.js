import { RemoteFaceDeviceClient } from "../../utils/faceDeviceFunction.js";
import { retry } from "../../utils/utils.js";
import { EmployeeDoorTasksModel } from "./employeeDoorTasks.model.js";

export const EmployeeDoorTasksService = {
  async addTask(employeeId, doorId, action) {
    try {
      return await EmployeeDoorTasksModel.create({
        employee_id: employeeId,
        door_id: doorId,
        action,
        status: "pending",
      });
    } catch (err) {
      console.error("Ошибка при добавлении задачи:", err);
      throw err;
    }
  },

  async addManyTasks(tasks) {
    if (!tasks || tasks.length === 0) return;
    try {
      return await EmployeeDoorTasksModel.createMany(tasks);
    } catch (err) {
      console.error("Ошибка при добавлении нескольких задач:", err);
      throw err;
    }
  },

  async getPendingTasks() {
    try {
      return await EmployeeDoorTasksModel.findMany({ status: "pending" });
    } catch (err) {
      console.error("Ошибка при получении pending задач:", err);
      throw err;
    }
  },

  async updateTask(id, data) {
    try {
      return await EmployeeDoorTasksModel.update(id, data);
    } catch (err) {
      console.error(`Ошибка при обновлении задачи с id=${id}:`, err);
      throw err;
    }
  },

  async updateManyTasks(filter, data) {
    try {
      return await EmployeeDoorTasksModel.updateMany(filter, data);
    } catch (err) {
      console.error("Ошибка при обновлении нескольких задач:", err);
      throw err;
    }
  },

  async deleteTasks(filter) {
    try {
      return await EmployeeDoorTasksModel.deleteMany(filter);
    } catch (err) {
      console.error("Ошибка при удалении задач:", err);
      throw err;
    }
  },

  async processTask(task) {
    if (!task.door) {
      throw new Error(`Door ${task.door_id} not found`);
    }

    const device = (task.door?.faceDevices ?? []).find(
      (fd) => fd.serial_number,
    );

    if (!device) {
      throw new Error(`No device attached to door ${task.door_id}`);
    }

    const employeeNo = String(task.employee_id);

    if (task.action === "delete") {
      await retry(
        () =>
          RemoteFaceDeviceClient.deleteUserFromDevice(
            employeeNo,
            device.serial_number,
          ),
        { retries: 3, delay: 10000 },
      );
      return;
    }

    const { first_name, last_name, photo } = task.employee;
    const fullName = `${last_name} ${first_name}`;

    await retry(
      async () => {
        await RemoteFaceDeviceClient.addUserToDevice(
          employeeNo,
          fullName,
          device.serial_number,
        );

        if (photo) {
          await RemoteFaceDeviceClient.addUserPhotoToDevice(
            employeeNo,
            fullName,
            device.serial_number,
            photo,
          );
        }
      },
      { retries: 3, delay: 10000 },
    );
  },

  async processPendingTasks() {
    const tasks = await EmployeeDoorTasksModel.findMany({ status: "pending" });

    if (tasks.length === 0) return;

    console.log(`[DoorTasks] Обработка ${tasks.length} задач...`);

    for (const task of tasks) {
      await EmployeeDoorTasksModel.update(task.id, { status: "processing" });

      try {
        await this.processTask(task);

        await EmployeeDoorTasksModel.update(task.id, {
          status: "done",
          updated_at: new Date(),
          error: null,
        });

        console.log(`[DoorTasks] ✅ Задача ${task.id} выполнена`);
      } catch (err) {
        const retryCount = (task.retry_count ?? 0) + 1;
        const failed = retryCount >= 5;

        await EmployeeDoorTasksModel.update(task.id, {
          status: failed ? "failed" : "pending",
          retry_count: retryCount,
          error: err.message,
        });

        console.error(
          `[DoorTasks] ❌ Задача ${task.id} ошибка (попытка ${retryCount}):`,
          err.message,
        );
      }
    }
  },
};
