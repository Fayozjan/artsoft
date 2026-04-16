import path from "path";
import fs from "fs";
import { FacePassesService } from "./facePasses.service.js";

export const FacePassesController = {
  create: async (req, res) => {
    const userId = req.user.id;
    const tenant = req.tenant.schema;
    const { latitude, longitude, direction } = req.body;

    let files;
    if (req.files && req.files.length > 0) {
      files = [req.files[0]];
    }

    if (!direction) {
      return res.status(400).json({
        success: false,
        message: "Направление не отправлено",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Локация не отправлено",
      });
    }

    if (!req.files) {
      return res.status(400).json({
        success: false,
        message: "Фото не отправлено",
      });
    }

    try {
      const result = await FacePassesService.createFromTelegram(
        userId,
        tenant,
        latitude,
        longitude,
        direction,
        files,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  get: async (req, res) => {
    const userId = req.user.id;

    try {
      const { page, pageSize, filters } = req.query;

      const result = await FacePassesService.get({
        userId,
        page,
        pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении FacePass:", err);
      res.status(500).json({ error: "Ошибка при получении FacePass" });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const record = await FacePassesService.getById(id);

      if (!record) return res.status(404).json({ error: "FacePass не найден" });

      res.json({ success: true, data: record });
    } catch (err) {
      console.error("Ошибка при получении FacePass:", err);
      res.status(500).json({ error: "Ошибка при получении FacePass" });
    }
  },

  updateById: async (req, res) => {
    try {
      const { id } = req.params;

      const updated = await FacePassesService.updateById(id, req.body);

      res.json({ success: true, data: updated });
    } catch (err) {
      console.error("Ошибка при обновлении FacePass:", err);
      res.status(500).json({ error: "Ошибка при обновлении FacePass" });
    }
  },

  deleteById: async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = await FacePassesService.deleteById(id);

      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении FacePass:", err);
      res.status(500).json({ error: "Ошибка при удалении FacePass" });
    }
  },

  receiveEvent: async (req, res) => {
    const rawEvent = req.body.AccessControllerEvent || req.body.event_log;

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
      const result = await FacePassesService.processEvent(eventLog, files);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.log("createFromHikvision ERROR", error);
      return res.status(500).json({ success: false });
    }
  },

  getImage: async (req, res) => {
    try {
      const rawFilename = req.params[0];
      if (!rawFilename)
        return res.status(400).json({ error: "Не указан файл" });

      const baseDir = path.join(process.cwd(), "uploads", "face-passes");

      const safeName = path
        .normalize(rawFilename)
        .replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = path.join(baseDir, ...safeName.split("/"));

      if (!filePath.startsWith(baseDir + path.sep) && filePath !== baseDir) {
        return res.status(403).json({ error: "Доступ запрещён" });
      }

      await fs.promises.access(filePath, fs.constants.R_OK).catch(() => {
        const err = new Error("Файл не найден");
        err.status = 404;
        throw err;
      });

      if (process.env.NODE_ENV === "production") {
        res.setHeader("X-Accel-Redirect", `/internal/face-passes/${safeName}`);
        res.setHeader("Cache-Control", "private, max-age=86400");
        return res.status(200).end();
      }

      res.sendFile(filePath);
    } catch (err) {
      console.error("Ошибка при получении фото:", err.message);
      res.status(err.status ?? 400).json({ error: err.message });
    }
  },
};
