import { DateTime } from "luxon";
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
import { prismaContext } from "../../utils/prismaContext.js";
import { timeToMinutes, detectBreakReturnLate } from "../../utils/attendanceUtils.js";
import { extractMac, resolveEventDirection } from "../../utils/utils.js";
import { CanteenService } from "../canteen/canteen.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toTashkentDate(value) {
  if (!value) return null;
  const dt = DateTime.fromISO(String(value), { zone: "Asia/Tashkent" });
  return dt.isValid ? dt.toJSDate() : new Date(value);
}

function getFacePassNumericPriority(record, s) {
  const emp = record.employee || {};
  if (String(record.employee_id) === s) return 1;
  if (String(emp.employee_number || "") === s) return 2;
  if ((emp.pinfl || "").includes(s)) return 3;
  if ((emp.passport || "").toLowerCase().includes(s.toLowerCase())) return 4;
  return 5;
}

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

export async function calcLateForNotification(employeeId, passDate, passDirection) {
  if (passDirection !== "entry") return null;

  const prisma = prismaContext.get();
  const toLocalDate = (d) => new Date(new Date(d).getTime() + 5 * 60 * 60 * 1000);
  const toLocalYMD = (d) => toLocalDate(d).toISOString().slice(0, 10);

  const localDate = toLocalDate(passDate);
  const ymd = localDate.toISOString().slice(0, 10);

  // --- расписание ---
  const history = await prisma.employee_schedule_history.findMany({
    where: { employee_id: employeeId },
    include: { workSchedule: true },
    orderBy: { date_from: "asc" },
  });

  const record = history.find((h) => {
    const fromYMD = toLocalYMD(h.date_from);
    const toYMD = h.date_to ? toLocalYMD(h.date_to) : null;
    return toYMD ? ymd >= fromYMD && ymd <= toYMD : ymd >= fromYMD;
  });

  const schedule = record?.workSchedule;
  if (!schedule || schedule.type === "flexible") return null;

  const { type, late_tolerance_minutes, work_days, shifts } = schedule;
  let scheduleStart = null;
  let breakStart = null;
  let breakEnd = null;

  if (type === "fixed" || type === "remote") {
    const jsDay = localDate.getUTCDay() === 0 ? 7 : localDate.getUTCDay();
    const workDay = (work_days || []).find((d) => d.day === jsDay);
    if (!workDay) return null;
    scheduleStart = workDay.start ?? null;
    breakStart = workDay.break_start ?? null;
    breakEnd = workDay.break_end ?? null;
  } else if (type === "shift") {
    const shift = (shifts || [])[0];
    if (!shift) return null;
    scheduleStart = shift.start ?? null;
    breakStart = shift.break_start ?? null;
    breakEnd = shift.break_end ?? null;
  }

  if (!scheduleStart) return null;

  // --- все события сотрудника за сегодня ---
  const dayStart = new Date(`${ymd}T00:00:00+05:00`);
  const dayEnd = new Date(`${ymd}T23:59:59+05:00`);

  const todayPasses = await prisma.face_passes.findMany({
    where: { employee_id: employeeId, date: { gte: dayStart, lte: dayEnd } },
    orderBy: { date: "asc" },
  });

  if (!todayPasses.length) return null;

  const currentPassMs = new Date(passDate).getTime();

  // Первый вход дня?
  const priorEntries = todayPasses.filter(
    (p) => p.direction === "entry" && new Date(p.date).getTime() < currentPassMs,
  );
  const isFirstEntry = priorEntries.length === 0;

  if (isFirstEntry) {
    const scheduleStartMins = timeToMinutes(scheduleStart);
    const entryMins = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
    const lateMinutes = Math.max(0, entryMins - scheduleStartMins - (late_tolerance_minutes || 0));
    return { type: "arrival", lateMinutes, scheduleStart };
  }

  // Опоздание после перерыва?
  if (breakStart && breakEnd) {
    const events = todayPasses.map((p) => ({
      direction: p.direction,
      parsedDate: toLocalDate(p.date),
    }));
    const breakResult = detectBreakReturnLate(events, breakStart, breakEnd);

    if (breakResult.lateMinutes > 0 && breakResult.actualReturn) {
      const currentMins = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
      if (Math.abs(timeToMinutes(breakResult.actualReturn) - currentMins) <= 1) {
        return { type: "break_return", lateMinutes: breakResult.lateMinutes, breakEnd };
      }
    }
  }

  return null;
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

  createFromDeviceEvent: async (payload, files, tenant, deviceId) => {
    const event = payload.AccessControllerEvent;

    if (!event) throw new Error("AccessControllerEvent отсутствует в payload");

    const mac = extractMac(payload);
    const serial = payload.shortSerialNumber ?? payload.serialNumber ?? null;
    const device = await FaceDeviceModel.findForEvent({
      deviceId,
      mac,
      serial,
      ip: payload.ipAddress,
    });

    // Не throw: на 500 прошивка уходит в бесконечный ретрай и забивает лог
    // одним событием. Отвечаем 200, событие дотянет cron events_sync.
    if (!device) {
      return {
        success: false,
        deviceNotFound: true,
        mac,
        serial,
        ip: payload.ipAddress,
        employeeNoString: event.employeeNoString,
        serialNo: event.serialNo,
      };
    }

    // MAC дописываем разово, при первом опознании — дальше устройство
    // найдётся по нему, даже если DHCP выдаст другой IP.
    await FaceDeviceModel.rememberMac(device, mac);

    // --- определяем направление ---
    const direction = resolveEventDirection(device, event);

    const doorId = device.door_id;
    const faceDeviceId = device.id;

    let photoPath = null;
    if (files && files.length > 0) {
      const tmpFile = files[0];
      const imageBuffer = await fs.promises.readFile(tmpFile.path);

      photoPath = await saveUploadedPhoto(
        imageBuffer,
        payload.dateTime,
        event.employeeNoString,
        event.serialNo,
        tenant,
      );
      // временный файл удаляет контроллер (в finally)
    }

    if (!event.employeeNoString)
      throw new Error("employeeNoString отсутствует");

    const employeeId = Number(event.employeeNoString);
    if (
      !Number.isInteger(employeeId) ||
      employeeId > 2147483647 ||
      employeeId < 1
    ) {
      console.log(
        "employeeNoString out of INT4 range, skipping:",
        event.employeeNoString,
      );
      return { success: true, notFound: true };
    }

    // --- терминал столовой ---
    // Проход не фиксируем: событие такого устройства означает выдачу порции.
    if (device.purpose === "canteen") {
      return CanteenService.registerFromDeviceEvent({
        employeeId,
        faceDeviceId,
        date: payload.dateTime ? new Date(payload.dateTime) : new Date(),
        identifier: `${event.employeeNoString}-${event.serialNo}`,
        photo: photoPath,
      });
    }

    // --- формируем данные ---
    const data = {
      date: payload.dateTime ? new Date(payload.dateTime) : new Date(),
      identifier: `${event.employeeNoString}-${event.serialNo}`,
      employee_id: employeeId,
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
      if (err.code === "P2002") {
        console.log(`Duplicate ignored: ${data.identifier}`);

        return { success: true, duplicate: true };
      }

      if (err.code === "P2025") {
        console.log("Employee not found. Ignored:", data.employee_id);
        return { success: true, notFound: true };
      }

      throw err; //
    }

    // --- уведомления в телеграм ---
    try {
      const lateInfo = await calcLateForNotification(data.employee_id, newPass.date, direction);
      if (lateInfo) {
        newPass._lateMinutes = lateInfo.lateMinutes;
        newPass._lateType = lateInfo.type;
        newPass._scheduleStart = lateInfo.scheduleStart ?? lateInfo.breakEnd;
      }

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

    // право «Начать / Завершить работу» выдаёт администратор в карточке логина
    if (!user.telegram_work_punch)
      throw new Error(
        "Отметка начала и завершения работы через телеграм приложение не разрешена",
      );

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
        if (direction === "entry") {
          const lateInfo = await calcLateForEntry(data.employee_id, newPass.date);
          if (lateInfo) {
            newPass._lateMinutes = lateInfo.lateMinutes;
            newPass._scheduleStart = lateInfo.scheduleStart;
          }
        }

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
      if (start_date) where.date.gte = toTashkentDate(start_date);
      if (end_date) where.date.lte = toTashkentDate(end_date);
    }

    // Фильтры по сотруднику
    const employeeWhere = { ...employeeAccess };
    if (branch_id) employeeWhere.branch_id = Number(branch_id);
    if (department_id) employeeWhere.department_id = Number(department_id);
    if (position_id) employeeWhere.position_id = Number(position_id);
    if (Object.keys(employeeWhere).length) where.employee = employeeWhere;
    if (search) {
      const s = search.toString().trim();
      const isNumericSearch = /^\d+$/.test(s);
      const numericValue = isNumericSearch ? Number(s) : NaN;
      const isValidInt4 =
        isNumericSearch &&
        Number.isInteger(numericValue) &&
        numericValue >= -2147483648 &&
        numericValue <= 2147483647;

      const orConditions = [];
      if (isValidInt4) orConditions.push({ employee_id: numericValue });
      orConditions.push(
        { employee: { first_name: { contains: s, mode: "insensitive" } } },
        { employee: { last_name: { contains: s, mode: "insensitive" } } },
        { employee: { middle_name: { contains: s, mode: "insensitive" } } },
      );
      if (isNumericSearch) {
        orConditions.push(
          { employee: { employee_number: { contains: s } } },
          { employee: { pinfl: { contains: s } } },
          { employee: { passport: { contains: s, mode: "insensitive" } } },
        );
      }
      where.OR = orConditions;
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
    const isNumericSearch = search && /^\d+$/.test(search.toString().trim());

    const { records, total } = await FacePassesModel.find({
      where,
      skip: isNumericSearch ? 0 : skip,
      take: isNumericSearch ? 100000 : size,
    });

    if (isNumericSearch && records.length > 0) {
      const s = search.toString().trim();
      records.sort((a, b) => getFacePassNumericPriority(a, s) - getFacePassNumericPriority(b, s));
    }

    return {
      data: isNumericSearch ? records.slice(skip, skip + size) : records,
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
      if (start_date) where.date.gte = toTashkentDate(start_date);
      if (end_date) where.date.lte = toTashkentDate(end_date);
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
      const s = search.trim();
      const numericValue = Number(s);
      const isValidInt4 =
        !isNaN(numericValue) &&
        Number.isInteger(numericValue) &&
        numericValue >= -2147483648 &&
        numericValue <= 2147483647;

      const orConditions = [];

      if (isValidInt4) {
        orConditions.push({ employee_id: numericValue });
      }

      orConditions.push(
        { employee: { first_name: { contains: s, mode: "insensitive" } } },
        { employee: { last_name: { contains: s, mode: "insensitive" } } },
        { employee: { middle_name: { contains: s, mode: "insensitive" } } },
        { employee: { pinfl: { contains: s, mode: "insensitive" } } },
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
            pinfl: emp?.pinfl || null,
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

  // Табель: employeeIds уже отфильтрованы/авторизованы на уровне EmployeeService.getAll,
  // поэтому здесь без повторного join'а к employees — employeesById/historyByEmployee
  // передаёт вызывающая сторона (уже загружены один раз для страницы).
  getAllLean: async ({ employeeIds, startDate, endDate, employeesById, historyByEmployee }) => {
    if (!employeeIds?.length) return [];

    const where = { employee_id: { in: employeeIds.map(Number) } };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = toTashkentDate(startDate);
      if (endDate) where.date.lte = toTashkentDate(endDate);
    }

    const records = await FacePassesModel.findForTimesheet({ where });

    const grouped = new Map();
    for (const item of records) {
      const id = item.employee_id;

      if (!grouped.has(id)) {
        const emp = employeesById.get(id) || {};

        grouped.set(id, {
          employeeId: id,
          employeeNumber: emp.employee_number,
          employeeFullName:
            [emp.last_name, emp.first_name, emp.middle_name]
              .filter(Boolean)
              .join(" ") + ` (${id})`,
          employeePhoto: emp.photo,
          branchName: emp.branch?.name || null,
          departmentName: emp.department?.name || null,
          positionName: emp.position?.name || null,
          pinfl: emp.pinfl || null,
          workScheduleName: emp.workSchedule?.name || null,
          workSchedule: historyByEmployee.get(id) || [],
          events: [],
        });
      }

      grouped.get(id).events.push({
        id: item.id,
        date: item.date,
        identifier: item.identifier,
        direction: item.direction,
        doorName: item.door?.name || null,
        photo: item.photo || null,
      });
    }

    return Array.from(grouped.values());
  },

  getById: async (id) => {
    return FacePassesModel.getById(Number(id));
  },

  updateById: async (id, data) => {
    const payload = {};
    if (data.date) payload.date = new Date(data.date);

    return FacePassesModel.updateById(Number(id), payload);
  },

  deleteById: async (id) => {
    return FacePassesModel.deleteById(Number(id));
  },
};
