import { prismaContext } from "../../utils/prismaContext.js";
import { normalizeMac } from "../../utils/utils.js";

export const FaceDeviceModel = {
  findMany: async ({ where, skip, take }) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      include: { door: { select: { id: true, name: true } } },
    });
  },

  count: async (where) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.count({ where });
  },

  findById: async (id) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findUnique({
      where: { id: Number(id) },
      include: { door: { select: { id: true, name: true } } },
    });
  },

  // Опознание устройства по webhook-событию. Порядок — от самого стабильного
  // признака к самому текучему:
  //  1) id из URL webhook'а (/events/:deviceId) — задан вручную, он и главный
  //  2) серийный номер (shortSerialNumber) — привязан к железу навсегда
  //  3) MAC — тоже железный, но шлёт не каждая прошивка
  //  4) IP — последний: в локальной сети выдаётся по DHCP и переезжает
  //     между устройствами, по нему легко смапить событие не на то устройство
  findForEvent: async ({ deviceId, mac, ip, serial }) => {
    const prisma = prismaContext.get();
    const include = { door: { select: { id: true, name: true } } };

    const id = Number(deviceId);
    if (Number.isInteger(id) && id > 0) {
      const byId = await prisma.face_devices.findUnique({ where: { id }, include });
      if (byId) return byId;
    }

    if (serial) {
      const bySerial = await prisma.face_devices.findFirst({
        where: { serial_number: String(serial).trim() },
        include,
      });
      if (bySerial) return bySerial;
    }

    const normalized = normalizeMac(mac);
    if (normalized) {
      const byMac = await prisma.face_devices.findUnique({
        where: { mac_address: normalized },
        include,
      });
      if (byMac) return byMac;
    }

    if (ip) {
      const byIp = await prisma.face_devices.findUnique({
        where: { device_ip: String(ip) },
        include,
      });
      if (byIp) return byIp;
    }

    return null;
  },

  // Устройство опознано по IP — дописываем MAC, чтобы следующий раз нашлось
  // даже после смены IP. Заполняем только пустое поле: введённое админом
  // не трогаем.
  //
  // serial_number сюда намеренно не пишем: заполненное поле переключает
  // синхронизацию сотрудников на облачный RemoteFaceDeviceClient
  // (doors.service.js), и локальное устройство сломается.
  rememberMac: async (device, mac) => {
    const normalized = normalizeMac(mac);
    if (!normalized || device.mac_address) return device;

    const prisma = prismaContext.get();
    try {
      return await prisma.face_devices.update({
        where: { id: device.id },
        data: { mac_address: normalized },
      });
    } catch (err) {
      // mac_address уникален — может уже висеть на другом устройстве.
      // Опознание прошло, событие важнее: логируем и работаем дальше.
      console.warn(
        `face-device ${device.id}: MAC ${normalized} не записан (${err.message})`,
      );
      return device;
    }
  },

  create: async (data) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.update({
      where: { id: Number(id) },
      data,
    });
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.delete({ where: { id: Number(id) } });
  },

  findActive: async () => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findMany({
      where: { status: true },
      select: { door_id: true, device_ip: true, is_local: true },
    });
  },

  findByIds: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findMany({
      where: { id: { in: ids }, is_local: true },
      select: { id: true, device_ip: true, port: true },
    });
  },

  findSyncTargets: async (ids) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        device_ip: true,
        is_local: true,
        serial_number: true,
      },
    });
  },

  findByDoorIds: async (doorIds) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.findMany({
      where: { door_id: { in: doorIds }, status: true },
      select: { door_id: true, device_ip: true, is_local: true },
    });
  },

  disableByDoorId: async (doorId) => {
    const prisma = prismaContext.get();
    return prisma.face_devices.updateMany({
      where: { door_id: Number(doorId), status: true },
      data: { status: false },
    });
  },
};
