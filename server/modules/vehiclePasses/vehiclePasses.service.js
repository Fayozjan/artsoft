import { AnprCamerasModel } from "../anprCameras/anprCameras.model.js";
import { UserModel } from "../users/users.model.js";
import { VehiclePassesModel } from "./vehiclePasses.model.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { notificationsOutboxService } from "../notificationsOutbox/notificationsOutbox.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDates(records) {
  return records.map((r) => ({
    ...r,
    date: new Date(r.date).toLocaleString("ru-RU", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  }));
}

function mapVehiclePass(record) {
  return {
    id: record.id,
    branch_id: record.branch_id,
    branch_name: record.branch?.name || null,

    gate_id: record.gate_id,
    gate_name: record.gate?.name || null,

    camera_id: record.camera_id,
    camera_name: record.camera?.name || null,

    plate_number: record.plate_number,
    direction: record.direction,
    photo: record.photo,
    date: record.date,
    created_at: record.created_at,
  };
}

export async function saveUploadedPhoto(imageBuffer, dateTime, tenant) {
  if (!imageBuffer) return null;

  const eventDate = dateTime ? new Date(dateTime) : new Date();
  const year = eventDate.getFullYear();
  const month = String(eventDate.getMonth() + 1).padStart(2, "0");

  const serverRoot = path.resolve(__dirname, "../..");
  const uploadsFolder = path.join(
    serverRoot,
    "uploads",
    "vehicle-passes",
    tenant,
    String(year),
    month,
  );
  await fs.promises.mkdir(uploadsFolder, { recursive: true });

  const fileName = `plate_${Date.now()}.jpg`;
  const finalPath = path.join(uploadsFolder, fileName);

  await fs.promises.writeFile(finalPath, imageBuffer);

  // Возвращаем относительный путь для хранения в БД
  return path.join(tenant, String(year), month, fileName).replace(/\\/g, "/");
}

export const VehiclePassesService = {
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

    return VehiclePassesModel.create(data);
  },

  get: async ({ userId, page, pageSize, filters = {} }) => {
    const {
      start_date,
      end_date,
      branch_id,
      direction,
      selectedGateIds,
      search,
    } = filters;

    // --- получаем пользователя ---
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    // --- access фильтр ---
    const accessWhere = {};
    if (user.access_level === "branch" && user.branch_access?.length) {
      accessWhere.branch_id = { in: user.branch_access };
    } else if (
      user.access_level === "department" &&
      user.department_access?.length
    ) {
      accessWhere.branch_id = { in: user.department_access };
    }

    // --- формируем условия запроса ---
    const where = { ...accessWhere };

    // Дата
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    // Фильтр по филиалу
    if (branch_id) where.branch_id = Number(branch_id);

    // Фильтр по направлению
    if (direction) where.direction = direction;

    // Фильтр по воротам
    if (selectedGateIds?.length) {
      where.gate_id = {
        in: selectedGateIds.map(Number),
      };
    }

    // Поиск по номеру транспорта
    if (search) {
      where.plate_number = { contains: search, mode: "insensitive" };
    }

    // --- пагинация ---
    const currentPage = Math.max(parseInt(page) || 1, 1);
    const size = Math.max(parseInt(pageSize) || 50, 1);
    const skip = (currentPage - 1) * size;

    const { records, total } = await VehiclePassesModel.find({
      where,
      skip,
      take: size,
    });

    return {
      data: formatDates(records.map(mapVehiclePass)),
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: size,
        totalPages: Math.ceil(total / size),
      },
    };
  },

  getAll: async ({ userId, filters = {} }) => {
    const { start_date, end_date, branch_id, direction, gate_id, search } =
      filters;

    // --- получаем пользователя ---
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    // --- access фильтр ---
    const accessWhere = {};
    if (user.access_level === "branch" && user.branch_access?.length) {
      accessWhere.branch_id = { in: user.branch_access };
    } else if (
      user.access_level === "department" &&
      user.department_access?.length
    ) {
      accessWhere.branch_id = { in: user.department_access };
    }

    const where = { ...accessWhere };

    // Дата
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    // Фильтр по филиалу
    if (branch_id) where.branch_id = Number(branch_id);

    // Фильтр по направлению
    if (direction) where.direction = direction;

    // Фильтр по воротам
    if (gate_id) where.gate_id = Number(gate_id);

    // Поиск по номеру транспорта
    if (search) {
      where.plate_number = { contains: search, mode: "insensitive" };
    }

    const { records } = await VehiclePassesModel.find({ where });

    return formatDates(records.map(mapVehiclePass));
  },

  updateById: async (id, data) => {
    return VehiclePassesModel.updateById(Number(id), data);
  },

  deleteById: async (id) => {
    return VehiclePassesModel.deleteById(Number(id));
  },

  createFromDeviceEvent: async (
    { licensePlate, dateTime, macAddress, tenant, direction },
    imageBuffer,
  ) => {
    const camera = await AnprCamerasModel.findByMacAddress(macAddress);
    if (!camera) throw new Error(`Камера с MAC ${macAddress} не найдена`);

    if (!licensePlate) throw new Error("licensePlate отсутствует");

    const photoPath = imageBuffer
      ? await saveUploadedPhoto(imageBuffer, dateTime, tenant)
      : null;

    const data = {
      date: new Date(dateTime),
      plate_number: licensePlate,
      camera_id: camera.id,
      branch_id: camera?.gate?.branch?.id ?? null,
      gate_id: camera.gate_id ?? null,
      direction: direction ?? null,
      photo: photoPath,
    };

    const newPass = await VehiclePassesModel.create(data);

    const chats = camera.gate?.telegram_chat_ids || [];

    if (chats.length > 0) {
      await notificationsOutboxService.create("anpr_pass", newPass, chats);
    }

    return newPass;
  },
};
