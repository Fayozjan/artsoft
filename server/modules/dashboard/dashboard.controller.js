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

  tasks: async (req, res) => {
    try {
      const data = await DashboardService.getTasks(req.user.id, req.query.branch_id || null);
      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при загрузке задач" });
    }
  },

  all: async (req, res) => {
    try {
      const branchId = req.query.branch_id || null;
      const [summary, analytics, feeds, finance, tasks] = await Promise.all([
        DashboardService.getSummary(req.user.id, branchId),
        DashboardService.getAnalytics(req.user.id, branchId),
        DashboardService.getFeeds(req.user.id, branchId),
        DashboardService.getFinance(req.user.id, branchId),
        DashboardService.getTasks(req.user.id, branchId),
      ]);
      res.json({ success: true, data: { summary, analytics, feeds, finance, tasks } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при загрузке дашборда" });
    }
  },
};
