import { AuditLogsService } from "./auditLogs.service.js";

export const AuditLogsController = {
  list: async (req, res) => {
    try {
      const { page, pageSize, filters } = req.query;
      const parsedFilters = filters ? JSON.parse(filters) : {};
      const result = await AuditLogsService.list({ page, pageSize, filters: parsedFilters });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка при получении истории операций" });
    }
  },

  getEntities: async (req, res) => {
    try {
      const entities = await AuditLogsService.getEntities();
      res.json({ success: true, data: entities });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Ошибка" });
    }
  },
};
