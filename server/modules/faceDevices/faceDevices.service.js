import { FaceDeviceModel } from "./faceDevices.model.js";
import {
  FaceDeviceClient,
  RemoteFaceDeviceClient,
  syncTimeError,
} from "../../utils/faceDeviceFunction.js";
import { retry, normalizeMac } from "../../utils/utils.js";
import { EmployeeService } from "../employees/employees.service.js";
import { EmployeeDoorTasksService } from "../employeeDoorTasks/employeeDoorTasks.service.js";
import { createAuditLog } from "../../utils/auditLog.js";

// Назначение терминала: обычный проход или столовая
const PURPOSES = ["access", "canteen"];
const normalizePurpose = (value) =>
  PURPOSES.includes(value) ? value : "access";

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
        { mac_address: { contains: s, mode: "insensitive" } },
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

  getOnlineStatus: async (ids) => {
    const devices = await FaceDeviceModel.findByIds(ids);
    const entries = await Promise.all(
      devices.map(async (d) => [
        d.id,
        await FaceDeviceClient.checkOnline(d.device_ip, d.port || 80),
      ]),
    );
    return Object.fromEntries(entries);
  },

  // Живая вместимость терминалов: сколько людей прописано / сколько влезает.
  // Не хранится в базе — как и онлайн-статус, спрашивается у устройства каждый раз.
  getCapacity: async (ids) => {
    const devices = await FaceDeviceModel.findSyncTargets(ids);

    const entries = await Promise.all(
      devices.map(async (d) => {
        try {
          const result = d.is_local
            ? await FaceDeviceClient.getUserCapacity(d.device_ip)
            : d.serial_number
              ? await RemoteFaceDeviceClient.getUserCapacity(d.serial_number)
              : null;
          return [d.id, result];
        } catch (err) {
          console.error(`Ошибка получения вместимости устройства ${d.id}:`, err.message);
          return [d.id, null];
        }
      }),
    );

    return Object.fromEntries(entries);
  },

  getFaceDeviceById: async (id) => {
    return FaceDeviceModel.findById(id);
  },

  createFaceDevice: async (data, userId) => {
    const result = await FaceDeviceModel.create({
      ...data,
      purpose: normalizePurpose(data.purpose),
      mac_address: normalizeMac(data.mac_address),
      port: data.port ? Number(data.port) : null,
      door_id: data.door_id ? Number(data.door_id) : null,
      is_local: data.is_local === true || data.is_local === "true",
    });
    await createAuditLog({ userId, action: "create", entity: "face_devices", recordId: result.id, newData: result });
    return result;
  },

  updateFaceDevice: async (id, data, userId) => {
    const old = await FaceDeviceModel.findById(id);
    const { id: _removedId, port, door_id, status, door, mac_address, ...rest } =
      data;

    const result = await FaceDeviceModel.update(id, {
      ...rest,
      ...(rest.purpose !== undefined
        ? { purpose: normalizePurpose(rest.purpose) }
        : {}),
      // поле не пришло — MAC не трогаем, иначе затрём существующий
      ...(mac_address !== undefined
        ? { mac_address: normalizeMac(mac_address) }
        : {}),
      port: port ? Number(port) : null,
      door_id: door_id ? Number(door_id) : null,
      status: status === true || status === "true",
      is_local: rest.is_local === true || rest.is_local === "true",
    });
    await createAuditLog({ userId, action: "update", entity: "face_devices", recordId: id, oldData: old, newData: result });
    return result;
  },

  deleteFaceDevice: async (id, userId) => {
    const old = await FaceDeviceModel.findById(id);
    if (!old) return null;

    const result = await FaceDeviceModel.delete(id);
    await createAuditLog({ userId, action: "delete", entity: "face_devices", recordId: Number(id), oldData: old });
    return result;
  },

  // offsetMinutes — смещение от UTC в минутах (Ташкент = +300)
  // mode — "manual" (выставить время сейчас) или "ntp" (перевести на NTP time.google.com)
  syncTime: async (ids, offsetMinutes, mode = "manual") => {
    const devices = await FaceDeviceModel.findSyncTargets(ids);

    const results = await Promise.allSettled(
      devices.map(async (device) => {
        if (device.is_local) {
          if (!device.device_ip) throw syncTimeError("NO_IP");
          await FaceDeviceClient.syncTime(device.device_ip, offsetMinutes, mode);
        } else if (device.serial_number) {
          await RemoteFaceDeviceClient.syncTime(
            device.serial_number,
            offsetMinutes,
            mode,
          );
        } else {
          throw syncTimeError("UNSUPPORTED");
        }
      }),
    );

    const synced = devices.map((device, i) => {
      const outcome = results[i];
      if (outcome.status === "fulfilled")
        return { id: device.id, name: device.name, success: true };

      const reason = outcome.reason;
      // Код без syncCode — незапланированный сбой, его стоит видеть в логах.
      if (!reason?.syncCode)
        console.error(
          `Синхронизация времени, устройство ${device.id}:`,
          reason,
        );

      return {
        id: device.id,
        name: device.name,
        success: false,
        code: reason?.syncCode || "UNKNOWN",
        detail: reason?.syncCode ? reason.detail || "" : reason?.message || "",
      };
    });

    // Запрошенные id, которых нет в базе, иначе исчезли бы из ответа молча.
    const found = new Set(devices.map((d) => d.id));
    const missing = ids
      .filter((id) => !found.has(id))
      .map((id) => ({
        id,
        name: String(id),
        success: false,
        code: "NOT_FOUND",
        detail: "",
      }));

    return [...synced, ...missing];
  },

  syncEmployee: async (id, { removedDoorIds = [] } = {}) => {
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

    // Сценарий 3: Удаление с устройств убранных дверей
    if (removedDoorIds.length > 0) {
      const removedDevices = await FaceDeviceModel.findByDoorIds(removedDoorIds);

      await Promise.allSettled(
        removedDevices.map(async (device) => {
          if (device.is_local) {
            try {
              await retry(
                async () => {
                  await FaceDeviceClient.deleteUser(device.device_ip, id);
                },
                {
                  retries: 3,
                  delay: 10000,
                  onError: (err, attempt) => {
                    console.error(
                      `FaceDevice ${device.device_ip} (удаление), попытка ${attempt}:`,
                      err.message,
                    );
                  },
                },
              );
            } catch (error) {
              console.error(
                `Не удалось удалить пользователя с устройства ${device.device_ip}:`,
                error.message,
              );
            }
          } else {
            await EmployeeDoorTasksService.addTask(
              employee.id,
              device.door_id,
              "delete",
            );
          }
        }),
      );
    }
  },
};
