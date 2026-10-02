import { AuditLogsModel } from "./auditLogs.model.js";

export const AuditLogsService = {
  list: async ({ page, pageSize, filters }) => {
    const limit = pageSize ? parseInt(pageSize, 10) : 50;
    const currentPage = Math.max(parseInt(page || 1, 10), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    const { entity, action, user_id, date_from, date_to } = filters || {};

    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (user_id) where.user_id = parseInt(user_id, 10);
    if (date_from || date_to) {
      where.added_at = {};
      if (date_from) where.added_at.gte = new Date(date_from);
      if (date_to) {
        const to = new Date(date_to);
        to.setHours(23, 59, 59, 999);
        where.added_at.lte = to;
      }
    }

    const [records, totalItems] = await Promise.all([
      AuditLogsModel.findMany({ where, skip, take: limit }),
      AuditLogsModel.count(where),
    ]);

    const data = records.map((r) => ({
      id: r.id,
      entity: r.entity,
      record_id: r.record_id,
      action: r.action,
      old_data: r.old_data,
      new_data: r.new_data,
      added_at: r.added_at,
      user_id: r.user_id,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      user_name: r.user
        ? r.user.employee
          ? `${r.user.employee.last_name || ""} ${r.user.employee.first_name || ""}`.trim()
          : r.user.username
        : null,
    }));

    return {
      data,
      pagination: {
        totalItems,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  },

  getEntities: async () => AuditLogsModel.findDistinctEntities(),
};
