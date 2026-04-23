import path from "path";
import fs from "fs";
import { EmployeeService } from "./employees.service.js";
import {
  createTempToken,
  resolveTempToken,
} from "../../middlewares/tempPhotoToken.js";

export const EmployeeController = {
  create: async (req, res) => {
    const userId = req.user.id;
    const data = req.body;
    const file = req.file;

    try {
      const result = await EmployeeService.create(userId, data, file);
      res.status(201).json(result);
    } catch (err) {
      console.error("Ошибка при добавлении сотрудника:", err);

      if (err.code === "P2002") {
        return res.status(400).json({
          error: `Сотрудник с таким ПИНФЛ уже существует`,
        });
      }

      res.status(500).json({
        error: err.message || "Ошибка при добавлении сотрудника",
      });
    }
  },

  getAll: async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Не авторизован" });
      }

      const {
        page,
        pageSize,
        branch_id,
        department_id,
        employee_id,
        position_id,
        search,
        gender,
        status,
        sort_by,
        sort_order,
      } = req.query;

      const result = await EmployeeService.getAll({
        userId,
        page,
        pageSize,
        filters: {
          branch_id,
          department_id,
          employee_id,
          position_id,
          search,
          gender,
          status,
          sort_by,
          sort_order,
        },
      });

      return res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении сотрудников:", err);
      return res.status(500).json({
        error: "Ошибка при получении сотрудников",
        details: err.message,
      });
    }
  },

  getStats: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Не авторизован" });

      const stats = await EmployeeService.getStats({ userId });
      return res.json({ success: true, stats });
    } catch (err) {
      console.error("Ошибка при получении статистики сотрудников:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const employee = await EmployeeService.getById(id);

      if (!employee)
        return res.status(404).json({ error: "Сотрудник не найден" });

      res.json({ success: true, data: employee });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении сотрудника" });
    }
  },

  getActive: async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    try {
      const data = await EmployeeService.getActive({ userId });
      res.json({ success: true, ...data });
    } catch (err) {
      console.error("Error in getActiveEmployees:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  update: async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    try {
      const { id } = req.params;

      const updated = await EmployeeService.update(
        id,
        req.body,
        req.file,
        userId,
      );

      res.json({ success: true, data: updated });
    } catch (err) {
      console.error("Ошибка при обновлении сотрудника:", err);
      res
        .status(500)
        .json({ error: err.message || "Ошибка при обновлении сотрудника" });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await EmployeeService.delete(id);
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error(err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при удалении сотрудника" });
    }
  },

  getImage: async (req, res) => {
    try {
      const filename = req.params[0];
      if (!filename) return res.status(400).json({ error: "Не указан файл" });

      const baseDir = path.join(process.cwd(), "uploads", "employees");

      // Защита от path traversal
      const safeName = path
        .normalize(filename)
        .replace(/^(\.\.(\/|\\|$))+/, "");

      const filePath = path.join(baseDir, safeName);

      if (!filePath.startsWith(baseDir + path.sep) && filePath !== baseDir) {
        return res.status(403).json({ error: "Доступ запрещён" });
      }

      // Async проверка существования
      await fs.promises.access(filePath, fs.constants.R_OK).catch(() => {
        const err = new Error("Файл не найден");
        err.status = 404;
        throw err;
      });

      if (process.env.NODE_ENV === "production") {
        res.setHeader("X-Accel-Redirect", `/internal/employees/${safeName}`);
        res.setHeader("Cache-Control", "private, max-age=86400");
        return res.status(200).end();
      }

      res.sendFile(filePath);
    } catch (err) {
      console.error("Ошибка при получении фото:", err.message);
      res.status(err.status ?? 400).json({ error: err.message });
    }
  },

  getImageTempLink: async (req, res) => {
    try {
      const filename = req.params[0];
      if (!filename) return res.status(400).json({ error: "Не указан файл" });

      const baseDir = path.join(process.cwd(), "uploads", "employees");
      const safeName = path
        .normalize(filename)
        .replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = path.join(baseDir, safeName);

      if (!filePath.startsWith(baseDir + path.sep)) {
        return res.status(403).json({ error: "Доступ запрещён" });
      }

      await fs.promises.access(filePath, fs.constants.R_OK).catch(() => {
        const err = new Error("Файл не найден");
        err.status = 404;
        throw err;
      });

      const token = createTempToken(filePath);
      const url = `${req.protocol}://${req.get("host")}/api/employees/photo/${token}`;

      res.json({ url, expiresIn: 300 });
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  },

  getImageByToken: async (req, res) => {
    try {
      const { token } = req.params;
      const filePath = resolveTempToken(token);

      if (!filePath) {
        return res
          .status(410)
          .json({ error: "Ссылка истекла или недействительна" });
      }

      res.sendFile(filePath);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
