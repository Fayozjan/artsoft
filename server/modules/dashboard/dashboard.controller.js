import { DashboardService } from "./dashboard.service.js";

export const DashboardController = {
  summary: async (req, res) => {
    try {
      const data = await DashboardService.getSummary(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при загрузке сводки" });
    }
  },

  analytics: async (req, res) => {
    try {
      const data = await DashboardService.getAnalytics(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при загрузке аналитики" });
    }
  },

  feeds: async (req, res) => {
    try {
      const data = await DashboardService.getFeeds(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при загрузке ленты" });
    }
  },
};
