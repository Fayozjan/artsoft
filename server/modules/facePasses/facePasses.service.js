import { FaceDeviceModel } from "../faceDevices/faceDevices.model.js";
import { UserModel } from "../users/users.model.js";
import { FacePassesModel } from "./facePasses.model.js";
import { EmployeeModel } from "../employees/employees.model.js";
import path from "path";
import sharp from "sharp";
import fs from "fs";
import { fileURLToPath } from "url";
import { notificationsOutboxService } from "../notificationsOutbox/notificationsOutbox.service.js";
import { telegramBotsService } from "../telegramBots/telegramBots.service.js";
import { buildFacePassEmployeeAccess } from "./facePasses.helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function saveUploadedPhoto(
  imageBuffer,
  dateTime,
  employeeNoString,
  serialNo,
  tenant,
) {
  if (!imageBuffer) return null;

  const eventDate = dateTime ? new Date(dateTime) : new Date();
  const year = eventDate.getFullYear();
  const month = String(eventDate.getMonth() + 1).padStart(2, "0");

  const serverRoot = path.resolve(__dirname, "../..");
  const uploadsFolder = path.join(
    serverRoot,
    "uploads",
    "face-passes",
    tenant,
    String(year),
    month,
  );
  await fs.promises.mkdir(uploadsFolder, { recursive: true });

  const fileName = `${employeeNoString}-${serialNo}.jpg`;
  const finalPath = path.join(uploadsFolder, fileName);

  const optimizedBuffer = await sharp(imageBuffer)
    .resize({
      width: 600,
      height: 600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 80,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer();

  await fs.promises.writeFile(finalPath, optimizedBuffer);

  // Возвращаем относительный путь для хранения в БД
  return path.join(tenant, String(year), month, fileName).replace(/\\/g, "/");
}

export const FacePassesService = {
  create: async (payload) => {
    const data = {
      date: payload.date ? new Date(payload.date) : new Date(),
      identifier: payload.identifier,
      photo: payload.photo ?? null,
      employee_id: payload.employee_id,
      door_id: payload.door_id,
      face_devices_id: payload.face_devices_id,
      direction: payload.direction ?? null,
    };

    return FacePassesModel.create(data);
  },

  createFromDeviceEvent: async (payload, files, tenant) => {
    const device = await FaceDeviceModel.findByIp(payload.ipAddress);
    if (!device) throw new Error("Face device не найден в базе данных");

    const event = payload.AccessControllerEvent;

    if (!event) throw new Error("AccessControllerEvent отсутствует в payload");

    let direction = device.direction ?? null;

    // --- определяем направление ---
    if (direction === "universal") {
      if (event.attendanceStatus === "checkIn") {
        direction = "entry";
      } else if (event.attendanceStatus === "checkOut") {
        direction = "exit";
      } else {
        direction = null;
      }
    }

    const doorId = device.door_id;
    const faceDeviceId = device.id;

    let photoPath = null;
    if (files && files.length > 0) {
      const tmpFile = files[0];
      const imageBuffer = await fs.promises.readFile(tmpFile.path);

      photoPath = await saveUploadedPhoto(
        imageBuffer,
        payload.dateTime,
        payload.employeeNoString,
        payload.serialNo,
        tenant,
      );

      // удаляем временный файл
      await fs.promises.unlink(tmpFile.path);
    }

    if (!event.employeeNoString)
      throw new Error("employeeNoString отсутствует");

    // --- формируем данные ---
    const data = {
      date: new Date(payload.dateTime),
      identifier: `${event.employeeNoString}-${event.serialNo}`,
      employee_id: Number(event.employeeNoString),
      door_id: doorId,
      face_devices_id: faceDeviceId,
      direction,
      photo: photoPath,
    };

    // --- сохраняем в базу ---
    let newPass;

    try {
      newPass = await FacePassesModel.create(data);
    } catch (err) {
      // дубликат записи
      if (err.code === "P2002") {
        console.log(
          `Duplicate face_pass ignored: ${data.identifier}, Face Device: ${data.face_devices_id}`,
        );
        return { success: true, duplicate: true };
      }

      // сотрудник не найден
      if (err.code === "P2025") {
        console.log("Employee not found. Ignored:", data.employee_id);
        return { success: true, duplicate: true };
      }
    }

    // --- уведомления в телеграм ---
    try {
      const employeeSubscribers = await telegramBotsService.getEventAlertBots();
      const chats = employeeSubscribers.get(data.employee_id);

      if (chats && chats.size > 0) {
        await notificationsOutboxService.create("face_pass", newPass, chats);
      }
    } catch (err) {
      console.error("Ошибка при отправке уведомлений:", err);
    }

    return newPass;
  },

  createFromTelegram: async (
    userId,
    tenant,
    latitude,
    longitude,
    direction,
    files,
  ) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    // --- определяем door_id по геолокации сотрудника ---
    const employee = await EmployeeModel.getById(user.employee_id);
    if (!employee) throw new Error("Сотрудник не найден");

    // --- пропускаем GPS-проверку для дистанционных / исключений ---
    const skipGps =
      user.ignore_gps_check === true ||
      employee.workSchedule?.type === "remote";

    let doorId = null;
    let source = null;

    if (skipGps) {
      source = "mobile";
    } else {
      if (!employee.doors?.length)
        throw new Error("Сотруднику не назначена ни одна дверь");
      const haversine = (lat1, lon1, lat2, lon2) => {
        const R = 6371000;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      // Двери сотрудника с координатами (только активные)
      const doorsWithLocation = employee.doors.filter(
        (d) => d.status && d.latitude != null && d.longitude != null,
      );

      if (doorsWithLocation.length > 0) {
        const MAX_DISTANCE_METERS = 500;
        let closestDoor = null;
        let minDist = Infinity;

        for (const door of doorsWithLocation) {
          const dist = haversine(
            latitude,
            longitude,
            door.latitude,
            door.longitude,
          );
          if (dist < minDist) {
            minDist = dist;
            closestDoor = door;
          }
        }

        if (!closestDoor || minDist > MAX_DISTANCE_METERS) {
          throw new Error(
            `Вы находитесь слишком далеко от офиса (${Math.round(minDist)} м)`,
          );
        }

        doorId = closestDoor.id;
      } else {
        // Нет дверей с координатами — берём первую активную из назначенных
        const fallback = employee.doors.find((d) => d.status);
        if (fallback) doorId = fallback.id;
      }

      if (!doorId) throw new Error("Не найдена подходящая дверь");
    }

    const date = new Date();
    const timestamp = Date.now();

    let photoPath = null;

    if (files && files.length > 0) {
      const tmpFile = files[0];
      const imageBuffer = await fs.promises.readFile(tmpFile.path);

      photoPath = await saveUploadedPhoto(
        imageBuffer,
        date,
        timestamp,
        user.employee_id,
        tenant,
      );

      // удаляем временный файл
      await fs.promises.unlink(tmpFile.path);
    }

    const data = {
      date: date,
      identifier: `${user.employee_id}-${timestamp}`,
      employee_id: Number(user.employee_id),
      door_id: doorId,
      face_devices_id: null,
      direction,
      source,
      latitude: latitude != null ? parseFloat(latitude) : null,
      longitude: longitude != null ? parseFloat(longitude) : null,
      photo: photoPath,
    };

    console.log("data", data);

    // --- сохраняем в базу ---
    let newPass;

    try {
      newPass = await FacePassesModel.create(data);
    } catch (err) {
      console.log("err", err);
      // дубликат записи
      if (err.code === "P2002") {
        console.log(
          `Duplicate face_pass ignored: ${data.identifier}, Face Device: ${data.face_devices_id}`,
        );
        return { success: true, duplicate: true };
      }

      // сотрудник не найден
      if (err.code === "P2025") {
        console.log("Employee not found. Ignored:", data.employee_id);
        return { success: true, duplicate: true };
      }
    }

    // --- уведомления в телеграм ---
    if (newPass) {
      try {
        const employeeSubscribers =
          await telegramBotsService.getEventAlertBots();
        const chats = employeeSubscribers.get(data.employee_id);

        if (chats && chats.size > 0) {
          await notificationsOutboxService.create("face_pass", newPass, chats);
        }
      } catch (err) {
        console.error("Ошибка при отправке уведомлений:", err);
      }
    }

    console.log("newPass", newPass);

    return newPass;
  },

  get: async ({ userId, page, pageSize, filters = {} }) => {
    const {
      start_date,
      end_date,
      branch_id,
      department_id,
      position_id,
      direction,
      search,
    } = filters;

    // --- получаем пользователя ---
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const employeeAccess = buildFacePassEmployeeAccess(user);

    // --- формируем условия запроса ---
    const where = {};

    // Дата
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    // Фильтры по сотруднику
    const employeeWhere = { ...employeeAccess };
    if (branch_id) employeeWhere.branch_id = Number(branch_id);
    if (department_id) employeeWhere.department_id = Number(department_id);
    if (position_id) employeeWhere.position_id = Number(position_id);
    if (Object.keys(employeeWhere).length) where.employee = employeeWhere;
    if (search) {
      where.OR = [
        { employee_id: isNaN(Number(search)) ? undefined : Number(search) },
        { employee: { first_name: { contains: search, mode: "insensitive" } } },
        { employee: { last_name: { contains: search, mode: "insensitive" } } },
        {
          employee: { middle_name: { contains: search, mode: "insensitive" } },
        },
      ];
    }

    // Остальные фильтры
    if (direction) where.direction = direction;
    if (filters.source === "MOBILE") {
      where.source = "MOBILE";
    } else if (filters.source === "DEVICE") {
      where.source = null;
    }
    if (filters.selectedDoorIds && filters.selectedDoorIds.length > 0) {
      where.door_id = { in: filters.selectedDoorIds.map((id) => Number(id)) };
    }

    // --- пагинация ---
    const currentPage = Math.max(parseInt(page) || 1, 1);
    const size = Math.max(parseInt(pageSize) || 50, 1);
    const skip = (currentPage - 1) * size;

    const { records, total } = await FacePassesModel.find({
      where,
      skip,
      take: size,
    });

    return {
      data: records,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: size,
        totalPages: Math.ceil(total / size),
      },
    };
  },

  getAll: async ({ userId, filters = {} }) => {
    const {
      start_date,
      end_date,
      branch_id,
      department_id,
      position_id,
      direction,
      door_id,
      employeeIds,
      search,
    } = filters;

    // --- получаем пользователя ---
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const employeeAccess = buildFacePassEmployeeAccess(user);

    const where = {};

    // --- Фильтр по дате ---
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    // --- Фильтры по сотруднику (branch, dep, position) ---
    const employeeWhere = { ...employeeAccess };
    if (branch_id) employeeWhere.branch_id = Number(branch_id);
    if (department_id) employeeWhere.department_id = Number(department_id);
    if (position_id) employeeWhere.position_id = Number(position_id);

    if (Object.keys(employeeWhere).length > 0) {
      where.employee = employeeWhere;
    }

    // --- Поиск search ---
    if (search) {
      const searchNumber = Number(search);
      const orConditions = [];

      // если search – число → ищем по employee_id
      if (!isNaN(searchNumber)) {
        orConditions.push({ employee_id: searchNumber });
      }

      // поиск по ФИО
      orConditions.push(
        { employee: { first_name: { contains: search, mode: "insensitive" } } },
        { employee: { last_name: { contains: search, mode: "insensitive" } } },
        {
          employee: { middle_name: { contains: search, mode: "insensitive" } },
        },
      );

      where.OR = orConditions;
    }

    // --- Фильтр по выбранным employeeIds ---
    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      if (!where.employee) where.employee = {};

      const cleanIds = employeeIds.map(Number).filter((x) => !isNaN(x));

      if (cleanIds.length > 0) {
        where.employee.id = { in: cleanIds };
      }
    }

    // --- Остальные фильтры ---
    if (direction) where.direction = direction;
    if (door_id) where.door_id = Number(door_id);

    // --- получаем данные ---
    const { records } = await FacePassesModel.find({ where });

    records.sort((a, b) => a.employee_id - b.employee_id);

    const grouped = Object.values(
      records.reduce((acc, item) => {
        const id = item.employee_id;

        if (!acc[id]) {
          const emp = item.employee || {};

          acc[id] = {
            employeeId: id,
            employeeNumber: emp.employee_number,
            employeeFullName:
              [emp.last_name, emp.first_name, emp.middle_name]
                .filter(Boolean)
                .join(" ") + ` (${emp.id})`,
            employeePhoto: emp.photo,
            branchName: emp.branch?.name || null,
            departmentName: emp.department?.name || null,
            positionName: emp.position?.name || null,
            workScheduleName: emp.workSchedule?.name || null,
            workSchedule: emp.employeeScheduleHistory || null,

            events: [],
          };
        }

        acc[id].events.push({
          id: item.id,
          date: item.date,
          identifier: item.identifier,
          direction: item.direction,
          doorId: item.door_id,
          doorName: item.door?.name || null,
          photo: item.photo || null,
        });

        return acc;
      }, {}),
    );

    return grouped;
  },

  getById: async (id) => {
    return FacePassesModel.getById(Number(id));
  },

  updateById: async (id, data) => {
    return FacePassesModel.updateById(Number(id), data);
  },

  deleteById: async (id) => {
    return FacePassesModel.deleteById(Number(id));
  },
};
