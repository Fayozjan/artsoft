import { RemoteFaceDeviceClient } from "../../utils/faceDeviceFunction.js";
import { retry } from "../../utils/utils.js";
import { EmployeeDoorTasksModel } from "./employeeDoorTasks.model.js";
import { tenantContext } from "../../utils/tenantContext.js";
import { getPrismaForTenant } from "../../utils/prismaForTenant.js";

export const EmployeeDoorTasksService = {
  async addTask(employeeId, doorId, action) {
    const tenant = tenantContext.get();
    if (!tenant) throw new Error("No tenant context for addTask");
    return await EmployeeDoorTasksModel.create({
      tenant_id: tenant.id,
      employee_id: employeeId,
      door_id: doorId,
      action,
      status: "pending",
    });
  },

  async addManyTasks(tasks) {
    if (!tasks || tasks.length === 0) return;
    const tenant = tenantContext.get();
    if (!tenant) throw new Error("No tenant context for addManyTasks");
    const tasksWithTenant = tasks.map((t) => ({ ...t, tenant_id: tenant.id }));
    return await EmployeeDoorTasksModel.createMany(tasksWithTenant);
  },

  async getPendingTasks() {
    const tenant = tenantContext.get();
    const filter = { status: "pending" };
    if (tenant) filter.tenant_id = tenant.id;
    return await EmployeeDoorTasksModel.findMany(filter);
  },

  async updateTask(id, data) {
    return await EmployeeDoorTasksModel.update(id, data);
  },

  async updateManyTasks(filter, data) {
    return await EmployeeDoorTasksModel.updateMany(filter, data);
  },

  async deleteTasks(filter) {
    const tenant = tenantContext.get();
    const finalFilter = tenant ? { ...filter, tenant_id: tenant.id } : filter;
    return await EmployeeDoorTasksModel.deleteMany(finalFilter);
  },

  async processTask(task, employee, door, tenant) {
    if (!door) {
      throw new Error(`Door ${task.door_id} not found`);
    }

    const devices = (door.faceDevices ?? []).filter((fd) => fd.serial_number);

    if (devices.length === 0) {
      throw new Error(`No device attached to door ${task.door_id}`);
    }

    const employeeNo = String(task.employee_id);

    if (task.action === "delete") {
      for (const device of devices) {
        await retry(
          () =>
            RemoteFaceDeviceClient.deleteUserFromDevice(
              employeeNo,
              device.serial_number,
            ),
          { retries: 3, delay: 10000 },
        );
      }
      return;
    }

    if (!employee) {
      throw new Error(`Employee ${task.employee_id} not found`);
    }

    const { first_name, last_name, photo } = employee;
    const fullName = `${last_name} ${first_name}`;

    for (const device of devices) {
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
              tenant,
            );
          }
        },
        { retries: 3, delay: 10000 },
      );
    }
  },

  async processPendingTasks() {
    const tasks = await EmployeeDoorTasksModel.findPending();

    if (tasks.length === 0) return;

    console.log(`[DoorTasks] Обработка ${tasks.length} задач...`);

    for (const task of tasks) {
      await EmployeeDoorTasksModel.update(task.id, { status: "processing" });

      try {
        const tenantPrisma = getPrismaForTenant(task.tenant.schema);

        const [employee, door] = await Promise.all([
          tenantPrisma.employees.findUnique({
            where: { id: task.employee_id },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              photo: true,
            },
          }),
          tenantPrisma.doors.findUnique({
            where: { id: task.door_id },
            include: { faceDevices: true },
          }),
        ]);

        await this.processTask(task, employee, door, task.tenant.schema);

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
