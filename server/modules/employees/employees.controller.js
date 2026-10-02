import path from "path";
import fs from "fs";
import { EmployeeService } from "./employees.service.js";
import { canAccessEmployee } from "./employee.helpers.js";
import { UserModel } from "../users/users.model.js";
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

      if (file?.path) {
        fs.unlink(file.path, () => {});
      }

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
        has_work_schedule,
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
          has_work_schedule,
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

  getProfile: async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await EmployeeService.getProfile(id);

      if (!profile)
        return res.status(404).json({ error: "Сотрудник не найден" });

      res.json({ success: true, data: profile });
    } catch (err) {
      console.error("Ошибка при получении профиля сотрудника:", err);
      res.status(500).json({ error: "Ошибка при получении профиля сотрудника" });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const employee = await EmployeeService.getById(id);

      if (!employee)
        return res.status(404).json({ error: "Сотрудник не найден" });

      const user = await UserModel.getById(Number(req.user.id));
      if (!user || !canAccessEmployee(user, employee))
        return res.status(403).json({ error: "Нет доступа к сотруднику" });

      res.json({ success: true, data: employee });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении сотрудника" });
    }
  },

  getRehireCandidates: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });

    try {
      const result = await EmployeeService.getRehireCandidates({
        search: req.query.search,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при получении уволенных сотрудников:", err);
      res.status(500).json({ error: "Ошибка при получении уволенных сотрудников" });
    }
  },

  getRehireCandidate: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });

    try {
      const data = await EmployeeService.getRehireCandidate({
        id: req.params.id,
      });

      if (!data) return res.status(404).json({ error: "Сотрудник не найден" });

      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при получении уволенного сотрудника:", err);
      res.status(500).json({ error: "Ошибка при получении уволенного сотрудника" });
    }
  },

  rehire: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });

    const file = req.file;

    try {
      const data = await EmployeeService.rehire(
        req.params.id,
        req.body,
        file,
        userId,
      );

      res.json({ success: true, data });
    } catch (err) {
      console.error("Ошибка при повторном приёме сотрудника:", err);

      if (file?.path) {
        fs.unlink(file.path, () => {});
      }

      if (err.code === "P2002") {
        return res
          .status(400)
          .json({ error: "Сотрудник с таким ПИНФЛ уже существует" });
      }

      res
        .status(400)
        .json({ error: err.message || "Ошибка при повторном приёме сотрудника" });
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

  bulkUpdateWorkSchedule: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });

    try {
      const { employee_ids, work_schedule_id, work_schedule_start_date } = req.body;

      const result = await EmployeeService.bulkUpdateWorkSchedule(
        Array.isArray(employee_ids) ? employee_ids : [],
        work_schedule_id,
        work_schedule_start_date,
        userId,
      );

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при массовом изменении графика:", err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при массовом изменении графика" });
    }
  },

  bulkUpdateDoors: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });

    try {
      const { employee_ids, door_ids, mode, sync_doors } = req.body;

      const result = await EmployeeService.bulkUpdateDoors(
        Array.isArray(employee_ids) ? employee_ids : [],
        Array.isArray(door_ids) ? door_ids : [],
        mode,
        ["true", "1", true, 1].includes(sync_doors),
        userId,
      );

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при массовом изменении дверей:", err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при массовом изменении дверей" });
    }
  },

  bulkSyncFaceDevices: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });

    try {
      const { employee_ids } = req.body;
      const result = await EmployeeService.bulkSyncFaceDevices(
        Array.isArray(employee_ids) ? employee_ids : [],
      );
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при массовой синхронизации с FaceDevice:", err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при синхронизации" });
    }
  },

  bulkUpdatePlacement: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });

    try {
      const { employee_ids, branch_id, department_id, position_id } = req.body;

      const result = await EmployeeService.bulkUpdatePlacement(
        Array.isArray(employee_ids) ? employee_ids : [],
        { branch_id, department_id, position_id },
        userId,
      );

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при массовом изменении данных сотрудников:", err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при массовом изменении данных" });
    }
  },

  getBulkDeleteImpact: async (req, res) => {
    try {
      const { employee_ids } = req.body;
      const impact = await EmployeeService.getBulkDeleteImpact(
        Array.isArray(employee_ids) ? employee_ids : [],
      );
      res.json({ success: true, ...impact });
    } catch (err) {
      console.error(err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при проверке удаления" });
    }
  },

  bulkDelete: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });

    try {
      const { employee_ids } = req.body;
      const result = await EmployeeService.bulkDelete(
        Array.isArray(employee_ids) ? employee_ids : [],
        userId,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при массовом удалении сотрудников:", err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при массовом удалении" });
    }
  },

  delete: async (req, res) => {
    const userId = req.user.id;
    try {
      const { id } = req.params;
      const deleted = await EmployeeService.delete(id, userId);
      res.json({ success: true, data: deleted });
    } catch (err) {
      console.error(err);
      res.status(400).json({
        error: err.message || "Ошибка при удалении сотрудника",
        blockers: err.blockers,
      });
    }
  },

  getDeleteImpact: async (req, res) => {
    try {
      const { id } = req.params;
      const impact = await EmployeeService.getDeleteImpact(id);
      res.json({ success: true, ...impact });
    } catch (err) {
      console.error(err);
      res
        .status(400)
        .json({ error: err.message || "Ошибка при проверке удаления" });
    }
  },

  importExcel: async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });
    if (!req.file) return res.status(400).json({ error: "Файл не загружен" });

    try {
      const result = await EmployeeService.importFromExcel(req.file.buffer, userId);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Ошибка при импорте сотрудников:", err);
      res.status(500).json({ error: err.message || "Ошибка при импорте" });
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
