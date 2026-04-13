import { VehiclePassesService } from "../vehiclePasses/vehiclePasses.service.js";
import { AnprCamerasService } from "./anprCameras.service.js";
import fs from "fs";
import path from "path";

export const AnprCamerasController = {
  // Получение списка камер с фильтрацией и пагинацией
  getAll: async (req, res) => {
    try {
      const filters =
        typeof req.query.filters === "string"
          ? JSON.parse(req.query.filters)
          : req.query.filters || {};

      const result = await AnprCamerasService.get({
        page: req.query.page,
        pageSize: req.query.pageSize,
        filters,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении камер ворот:", err);
      res.status(500).json({ error: "Ошибка при получении камер ворот" });
    }
  },

  // Получение камеры по ID
  getById: async (req, res) => {
    try {
      const device = await AnprCamerasService.getById(req.params.id);
      if (!device) return res.status(404).json({ error: "Камера не найдена" });
      res.json({ success: true, data: device });
    } catch (err) {
      console.error("Ошибка при получении камеры:", err);
      res.status(500).json({ error: "Ошибка при получении камеры" });
    }
  },

  // Создание новой камеры
  create: async (req, res) => {
    try {
      const device = await AnprCamerasService.create(req.body);
      res.status(201).json({ success: true, result: device });
    } catch (err) {
      console.error("Ошибка при добавлении камеры:", err);
      if (err.code === "P2002")
        return res
          .status(409)
          .json({ error: "Такое имя или IP уже существует!" });
      res.status(500).json({ error: "Ошибка при добавлении камеры" });
    }
  },

  // Обновление камеры
  update: async (req, res) => {
    try {
      const device = await AnprCamerasService.update(req.params.id, req.body);
      res.json({ success: true, result: device });
    } catch (err) {
      console.error("Ошибка при обновлении камеры:", err);
      if (err.code === "P2025")
        return res.status(404).json({ error: "Камера не найдена" });
      res.status(500).json({ error: "Ошибка при обновлении камеры" });
    }
  },

  receiveEvent: async (req, res) => {
    const { macAddress, licensePlate, dateTime, direction } = req.body;
    const imageFile = req.files?.[0];
    const tenant = req.tenant.schema;

    const imageBuffer = imageFile
      ? await fs.promises.readFile(imageFile.path)
      : null;

    await VehiclePassesService.createFromDeviceEvent(
      { licensePlate, dateTime, macAddress, tenant, direction },
      imageBuffer,
    );

    // Удаляем временный файл multer
    if (imageFile) await fs.promises.unlink(imageFile.path).catch(() => {});

    res.status(200).json({ ok: true });
  },
};
