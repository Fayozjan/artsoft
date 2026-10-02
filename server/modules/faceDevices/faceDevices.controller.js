import fs from "fs";
import { FacePassesService } from "../facePasses/facePasses.service.js";
import { FaceDevicesService } from "./faceDevices.service.js";
import { normalizeFaceEventLog } from "../../utils/faceEventLog.js";
// minor 75 — проход по лицу (то же, что запрашивает hikEventChecker)
const FACE_PASS_SUB_EVENT = 75;

// Статусы двери (открыта/закрыта и т.п.) — приходят на каждый проход и вдвое
// превышают поток самих проходов. Штатный шум, а не потерянные события.
const DOOR_STATUS_SUB_EVENTS = new Set([21, 22, 25, 26]);

const isJsonPart = (f) =>
  /json/i.test(f.mimetype || "") ||
  /\.json$/i.test(f.originalname || "") ||
  f.fieldname === "event_log" ||
  f.fieldname === "AccessControllerEvent";

const isImagePart = (f) =>
  /^image\//i.test(f.mimetype || "") ||
  /\.(jpe?g|png|bmp)$/i.test(f.originalname || "");

// Форматы прошивок и раскрутка обёрток — см. normalizeFaceEventLog.
// Тело запроса проверяем раньше, чем req.body.AccessControllerEvent:
// нормализатор сам развернёт обёртку до полного лога.
const extractEventLog = async (req) => {
  const candidates = [req.body?.event_log, req.body, req.body?.AccessControllerEvent];

  for (const file of req.files || []) {
    if (!isJsonPart(file)) continue;
    try {
      candidates.push(await fs.promises.readFile(file.path, "utf8"));
    } catch (err) {
      console.warn("face-event: не прочитана JSON-часть:", err.message);
    }
  }

  for (const candidate of candidates) {
    const log = normalizeFaceEventLog(candidate);
    if (log) return log;
  }

  return null;
};

// Причина, по которой событие не пишется в базу.
// reason === null — событие валидное. noise === true — штатный шум прошивки,
// такие пропуски не логируются.
const getSkipReason = (log) => {
  const inner = log.AccessControllerEvent;

  if (log.eventType === "heartBeat") return { reason: "heartBeat", noise: true };
  // eventState шлют не все прошивки — отсутствие считаем активным событием
  if (log.eventState != null && log.eventState !== "active")
    return { reason: `eventState=${log.eventState}`, noise: false };

  const raw = inner?.subEventType ?? inner?.minorEventType;
  const sub = Number(raw);
  if (sub !== FACE_PASS_SUB_EVENT) {
    return {
      reason: `subEventType=${raw ?? "нет"}`,
      noise: DOOR_STATUS_SUB_EVENTS.has(sub),
    };
  }

  if (!inner?.employeeNoString)
    return { reason: "нет employeeNoString", noise: false };

  return { reason: null, noise: false };
};

export const FaceDevicesController = {
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await FaceDevicesService.getFaceDevices({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении face-устройств:", err);
      res.status(500).json({ error: "Ошибка при получении face-устройств" });
    }
  },

  getOnlineStatus: async (req, res) => {
    try {
      const ids = String(req.query.ids || "")
        .split(",")
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id));

      if (ids.length === 0) return res.json({ success: true, data: {} });

      const data = await FaceDevicesService.getOnlineStatus(ids);
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при проверке статуса face-устройств:", err);
      res.status(500).json({ error: "Ошибка при проверке статуса face-устройств" });
    }
  },

  getCapacity: async (req, res) => {
    try {
      const ids = String(req.query.ids || "")
        .split(",")
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id));

      if (ids.length === 0) return res.json({ success: true, data: {} });

      const data = await FaceDevicesService.getCapacity(ids);
      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении вместимости face-устройств:", err);
      res.status(500).json({ error: "Ошибка при получении вместимости face-устройств" });
    }
  },

  getById: async (req, res) => {
    try {
      const device = await FaceDevicesService.getFaceDeviceById(req.params.id);
      if (!device)
        return res.status(404).json({ error: "Face-устройство не найдено" });
      res.json({ success: true, data: device });
    } catch (err) {
      console.error("Ошибка при получении face-устройства:", err);
      res.status(500).json({ error: "Ошибка при получении face-устройства" });
    }
  },

  create: async (req, res) => {
    try {
      const device = await FaceDevicesService.createFaceDevice(req.body, req.user?.id);
      res.status(201).json({ success: true, result: device });
    } catch (err) {
      console.error("Ошибка при добавлении face-устройства:", err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Такое имя уже существует!" });
      res.status(500).json({ error: "Ошибка при добавлении face-устройства" });
    }
  },

  update: async (req, res) => {
    const userId = req.user?.id;
    try {
      const device = await FaceDevicesService.updateFaceDevice(
        req.params.id,
        req.body,
        userId,
      );
      res.json({ success: true, result: device });
    } catch (err) {
      console.error("Ошибка при обновлении face-устройства:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Face-устройство не найдено" });
      res.status(500).json({ error: "Ошибка при обновлении face-устройства" });
    }
  },

  syncTime: async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids)
        ? req.body.ids.map(Number).filter(Number.isInteger)
        : [];
      const offsetMinutes = Number(req.body.offsetMinutes);
      const mode = req.body.mode === "ntp" ? "ntp" : "manual";

      if (ids.length === 0)
        return res
          .status(400)
          .json({ error: "Не выбраны устройства", code: "NO_DEVICES_SELECTED" });
      if (!Number.isFinite(offsetMinutes))
        return res
          .status(400)
          .json({ error: "Не указан часовой пояс", code: "NO_TIMEZONE" });

      const results = await FaceDevicesService.syncTime(ids, offsetMinutes, mode);
      res.json({ success: true, data: results });
    } catch (err) {
      console.error("Ошибка при синхронизации времени face-устройств:", err);
      res
        .status(500)
        .json({ error: "Ошибка при синхронизации времени", code: "SERVER_ERROR" });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await FaceDevicesService.deleteFaceDevice(
        req.params.id,
        req.user?.id,
      );

      if (!deleted)
        return res.status(404).json({ error: "Face-устройство не найдено" });

      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении face-устройства:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Face-устройство не найдено" });
      res.status(500).json({ error: "Ошибка при удалении face-устройства" });
    }
  },

  receiveEvent: async (req, res) => {
    const tenant = req.tenant.schema;
    const files = req.files || [];

    try {
      const eventLog = await extractEventLog(req);

      if (!eventLog) {
        req.faceEventOutcome = { result: "unparsed" };
        if (req.body?.eventType !== "heartBeat") {
          console.warn(
            `face-event [${tenant}]: формат не распознан ` +
              `(content-type=${req.headers["content-type"]}, ` +
              `body=${Object.keys(req.body || {}).join(",") || "пусто"}, ` +
              `files=${files.map((f) => `${f.fieldname}:${f.mimetype}`).join(",") || "нет"})`,
          );
        }
        return res.sendStatus(200);
      }

      const { reason, noise } = getSkipReason(eventLog);
      if (reason) {
        req.faceEventOutcome = { result: "skipped", reason, noise };
        // статусы двери и heartBeat в лог не пишем — их вдвое больше проходов
        if (!noise) {
          console.log(
            `face-event [${tenant}]: пропущено (${reason}), ip=${eventLog.ipAddress}`,
          );
        }
        return res.sendStatus(200);
      }

      // фото — именно картинка, а не первая попавшаяся часть multipart
      const imageFile = files.find(isImagePart);

      const result = await FacePassesService.createFromDeviceEvent(
        eventLog,
        imageFile ? [imageFile] : undefined,
        tenant,
        req.params.deviceId ?? req.query.device,
      );

      if (result?.deviceNotFound) {
        req.faceEventOutcome = {
          result: "device_not_found",
          mac: result.mac,
          serial: result.serial,
          ip: result.ip,
        };
        console.warn(
          `face-event [${tenant}]: устройство не найдено ` +
            `(serial=${result.serial ?? "нет в событии"}, ` +
            `MAC=${result.mac ?? "нет в событии"}, ip=${result.ip}), ` +
            `событие ${result.employeeNoString}-${result.serialNo} не сохранено. ` +
            `Пропишите MAC устройству в базе или URL webhook'а /api/face-devices/events/<id>.`,
        );
        return res.sendStatus(200);
      }

      if (result?.canteen && !result.duplicate && !result.notFound) {
        req.faceEventOutcome = {
          result: "canteen",
          status: result.status,
          mealId: result.id ?? null,
        };
        return res.status(200).json({ success: true, data: result });
      }

      req.faceEventOutcome = result?.duplicate
        ? { result: "duplicate" }
        : result?.notFound
          ? { result: "employee_not_found" }
          : { result: "saved", facePassId: result?.id ?? null };

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      req.faceEventOutcome = { result: "error", error: error.message };
      console.error(`face-event [${tenant}] ERROR:`, error);
      return res.status(500).json({ success: false });
    } finally {
      // multer пишет все части в tmp/ — чистим, каким бы ни был исход
      await Promise.all(
        files.map((f) => fs.promises.unlink(f.path).catch(() => {})),
      );
    }
  },
};
