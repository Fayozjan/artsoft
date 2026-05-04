import { FaceDeviceModel } from "./faceDevices.model.js";
import { FaceDeviceClient } from "../../utils/faceDeviceFunction.js";
import { retry } from "../../utils/utils.js";
import { EmployeeService } from "../employees/employees.service.js";
import { EmployeeDoorTasksService } from "../employeeDoorTasks/employeeDoorTasks.service.js";

function extractFaceDevices(doors = []) {
  return doors
    .flatMap((door) =>
      (door.faceDevices || []).map((fd) => ({
        ...fd,
        door_id: door.id,
        is_local: fd.is_local ?? false,
      })),
    )
    .filter((fd) => fd.device_ip);
}

export const FaceDevicesService = {
  getFaceDevices: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const { door_id, search, direction, status } = filters;

    let AND = [];
    let OR = [];

    if (search && search.trim() !== "") {
      const s = search.trim();
      const idNum = Number(s);
      const portNum = Number(s);

      OR.push(
        { name: { contains: s, mode: "insensitive" } },
        { device_ip: { contains: s, mode: "insensitive" } },
        { door: { name: { contains: s, mode: "insensitive" } } },
        Number.isInteger(idNum) ? { id: { equals: idNum } } : null,
        Number.isInteger(portNum) ? { port: { equals: portNum } } : null,
      );

      OR = OR.filter(Boolean);
    }

    if (door_id) AND.push({ door_id: Number(door_id) });
    if (direction === "entry" || direction === "exit") AND.push({ direction });
    if (status !== undefined && status !== "")
      AND.push({ status: status === "true" });

    const where = {};
    if (AND.length > 0) where.AND = AND;
    if (OR.length > 0) where.OR = OR;

    const [data, total] = await Promise.all([
      FaceDeviceModel.findMany({ where, skip, take: limit }),
      FaceDeviceModel.count(where),
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

  getActiveFaceDevices: async () => {
    return FaceDeviceModel.findActive();
  },

  getFaceDeviceById: async (id) => {
    return FaceDeviceModel.findById(id);
  },

  createFaceDevice: async (data) => {
    return FaceDeviceModel.create({
      ...data,
      port: data.port ? Number(data.port) : null,
      door_id: data.door_id ? Number(data.door_id) : null,
      is_local: data.is_local === true || data.is_local === "true",
    });
  },

  updateFaceDevice: async (id, data) => {
    const { id: _removedId, port, door_id, status, door, ...rest } = data;

    return FaceDeviceModel.update(id, {
      ...rest,
      port: port ? Number(port) : null,
      door_id: door_id ? Number(door_id) : null,
      status: status === true || status === "true",
      is_local: rest.is_local === true || rest.is_local === "true",
    });
  },

  syncEmployee: async (id) => {
    const employee = await EmployeeService.getById(id, { includeDoors: true });

    if (!employee) throw new Error("Сотрудник не найден");

    const fullName = `${employee.last_name} ${employee.first_name}`;
    const photo = employee.photo;

    const currentDevices = extractFaceDevices(employee.doors);

    // Сценарий 1: Удаление на всех устройствах
    if (employee.status === false || currentDevices.length === 0) {
      const allFaceDevices = await FaceDeviceModel.findActive();

      await Promise.allSettled(
        allFaceDevices.map(async (device) => {
          if (device.is_local) {
            try {
              await retry(
                async () => {
                  await FaceDeviceClient.deleteUser(device.device_ip, id);
                },
                { retries: 3, delay: 10000 },
              );
            } catch (error) {
              console.error(
                `Не удалось удалить пользователя с устройства ${device.device_ip} после всех попыток:`,
                error.message,
              );
            }
          } else {
            // удалённое устройство — создаём задачу
            await EmployeeDoorTasksService.addTask(
              employee.id,
              device.door_id,
              "delete",
            );
          }
        }),
      );
      return;
    }

    // Сценарий 2: Обновление/Создание на разрешённых устройствах
    await Promise.allSettled(
      currentDevices.map(async (device) => {
        if (device.is_local) {
          try {
            await retry(
              async () => {
                await FaceDeviceClient.updateUser(device.device_ip, id, fullName);
                if (photo) {
                  await FaceDeviceClient.updateUserPhoto(
                    device.device_ip,
                    id,
                    fullName,
                    photo,
                  );
                }
              },
              {
                retries: 3,
                delay: 10000,
                onError: (err, attempt) => {
                  console.error(
                    `FaceDevice ${device.device_ip}, попытка ${attempt}:`,
                    err.message,
                  );
                },
              },
            );
          } catch (error) {
            console.error(
              `Критическая ошибка синхронизации с устройством ${device.device_ip}:`,
              error.message,
            );
          }
        } else {
          await EmployeeDoorTasksService.addTask(
            employee.id,
            device.door_id,
            "update",
          );
        }
      }),
    );
  },
};
