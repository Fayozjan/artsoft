import { FacePassesService } from "../facePasses/facePasses.service.js";
import { FaceDevicesService } from "./faceDevices.service.js";

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
      const device = await FaceDevicesService.createFaceDevice(req.body);
      res.status(201).json({ success: true, result: device });
    } catch (err) {
      console.error("Ошибка при добавлении face-устройства:", err);
      if (err.code === "P2002")
        return res.status(409).json({ error: "Такое имя уже существует!" });
      res.status(500).json({ error: "Ошибка при добавлении face-устройства" });
    }
  },

  update: async (req, res) => {
    try {
      const device = await FaceDevicesService.updateFaceDevice(
        req.params.id,
        req.body,
      );
      res.json({ success: true, result: device });
    } catch (err) {
      console.error("Ошибка при обновлении face-устройства:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Face-устройство не найдено" });
      res.status(500).json({ error: "Ошибка при обновлении face-устройства" });
    }
  },

  receiveEvent: async (req, res) => {
    const rawEvent = req.body.AccessControllerEvent || req.body.event_log;
    const tenant = req.tenant.schema;

    if (!rawEvent) return res.sendStatus(200);

    let eventLog;
    try {
      eventLog = typeof rawEvent === "string" ? JSON.parse(rawEvent) : rawEvent;
    } catch (e) {
      console.log("JSON parse error", e);
      return res.sendStatus(200);
    }

    if (
      !eventLog.eventType ||
      eventLog.eventType === "heartBeat" ||
      eventLog.eventState !== "active"
    ) {
      return res.sendStatus(200);
    }

    const innerEvent = eventLog.AccessControllerEvent;
    if (
      !innerEvent ||
      innerEvent.subEventType !== 75 ||
      !innerEvent.employeeNoString
    ) {
      return res.sendStatus(200);
    }

    let files;
    if (req.files && req.files.length > 0) {
      files = [req.files[0]];
    }

    try {
      const result = await FacePassesService.createFromDeviceEvent(
        eventLog,
        files,
        tenant,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.log("createFromHikvision ERROR", error);
      return res.status(500).json({ success: false });
    }
  },
};
