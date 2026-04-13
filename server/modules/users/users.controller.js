import { UserService } from "./users.service.js";

export const UserController = {
  create: async (req, res) => {
    try {
      const result = await UserService.create(req.body);

      res.status(201).json({
        success: true,
        result,
      });
    } catch (err) {
      console.error(err);

      if (err.code === "P2002") {
        return res
          .status(409)
          .json({ success: false, error: "Такое имя логина уже существует!" });
      }

      res
        .status(err.statusCode || 500)
        .json({ success: false, error: err.message });
    }
  },

  get: async (req, res) => {
    try {
      const { page, pageSize, filters } = req.query;

      const result = await UserService.get(page, pageSize, filters);

      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка получения пользователей" });
    }
  },

  getById: async (req, res) => {
    try {
      const user = await UserService.getById(req.params.id);

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "Пользователь не найден" });
      }

      res.json({ success: true, data: user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },

  getMenu: async (req, res) => {
    try {
      const menu = await UserService.getMenu(req.user.id);
      res.json(menu);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка получения меню" });
    }
  },

  getInfo: async (req, res) => {
    try {
      const info = await UserService.getInfo(req.user.id);
      res.json(info);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  },

  getAccess: async (req, res) => {
    try {
      const access = await UserService.getAccess(req.user.id);
      res.json({ success: true, data: access });
    } catch (err) {
      console.error("getAccess error:", err.message);
      console.error("getAccess stack:", err.stack);
      res
        .status(err.statusCode || 500)
        .json({ success: false, error: err.message });
    }
  },

  updateById: async (req, res) => {
    try {
      const result = await UserService.updateById(req.params.id, req.body);

      res.json({
        success: true,
        result,
      });
    } catch (err) {
      console.error(err);

      res
        .status(err.statusCode || 500)
        .json({ success: false, error: err.message });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const result = await UserService.updateProfile(req.user.id, req.body);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error(err);

      res
        .status(err.statusCode || 500)
        .json({ success: false, error: err.message });
    }
  },
};
