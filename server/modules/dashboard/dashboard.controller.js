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

  finance: async (req, res) => {
    try {
      const data = await DashboardService.getFinance(req.user.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при загрузке финансов" });
    }
  },

  all: async (req, res) => {
    try {
      const [summary, analytics, feeds, finance] = await Promise.all([
        DashboardService.getSummary(req.user.id),
        DashboardService.getAnalytics(req.user.id),
        DashboardService.getFeeds(req.user.id),
        DashboardService.getFinance(req.user.id),
      ]);
      res.json({ success: true, data: { summary, analytics, feeds, finance } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при загрузке дашборда" });
    }
  },
};
