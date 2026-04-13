import path from "path";
import fs from "fs";
import { VehiclePassesService } from "./vehiclePasses.service.js";

export const VehiclePassesController = {
  get: async (req, res) => {
    const userId = req.user.id;

    try {
      const { page, pageSize, filters } = req.query;

      const result = await VehiclePassesService.get({
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

      const record = await VehiclePassesService.getById(id);

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

      const updated = await VehiclePassesService.updateById(id, req.body);

      res.json({ success: true, data: updated });
    } catch (err) {
      console.error("Ошибка при обновлении FacePass:", err);
      res.status(500).json({ error: "Ошибка при обновлении FacePass" });
    }
  },

  deleteById: async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = await VehiclePassesService.deleteById(id);

      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error("Ошибка при удалении FacePass:", err);
      res.status(500).json({ error: "Ошибка при удалении FacePass" });
    }
  },

  getImage: async (req, res) => {
    try {
      const rawFilename = req.params[0];
      if (!rawFilename)
        return res.status(400).json({ error: "Не указан файл" });

      const safeName = path
        .normalize(rawFilename)
        .replace(/^(\.\.(\/|\\|$))+/, "")
        .replace(/^\/+/, "");

      const filePath = path.join(
        process.cwd(),
        "uploads",
        "vehicle-passes",
        safeName.split("/").join(path.sep),
      );

      // Защита: файл должен быть внутри uploads/vehicle-passes
      const uploadsRoot = path.join(process.cwd(), "uploads", "vehicle-passes");
      if (!filePath.startsWith(uploadsRoot + path.sep)) {
        return res.status(403).json({ error: "Доступ запрещён" });
      }

      // Проверяем существование файла
      await fs.promises.access(filePath, fs.constants.R_OK).catch(() => {
        const err = new Error("Файл не найден");
        err.status = 404;
        throw err;
      });

      if (process.env.NODE_ENV === "production") {
        // X-Accel-Redirect для Nginx
        res.setHeader(
          "X-Accel-Redirect",
          `/internal/vehicle-passes/${safeName}`,
        );
        res.setHeader("Cache-Control", "private, max-age=86400");
        return res.status(200).end();
      }

      // Dev: отправляем файл напрямую
      res.sendFile(filePath);
    } catch (err) {
      console.error("Ошибка при получении фото:", err.message);
      res.status(err.status ?? 400).json({ error: err.message });
    }
  },
};
