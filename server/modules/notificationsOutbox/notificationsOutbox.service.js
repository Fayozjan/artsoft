import { buildPayload } from "./notificationsOutbox.helpers.js";
import { notificationsOutboxModel } from "./notificationsOutbox.model.js";

export const notificationsOutboxService = {
  async create(source_type, eventData, chats) {
    if (!chats || chats.size === 0) return;
    const payload = buildPayload(source_type, eventData);

    const notifications = Array.from(chats).map((chat_id) => ({
      source_type,
      chat_id,
      payload,
      event_date: eventData.date,
    }));

    try {
      await notificationsOutboxModel.createMany(notifications);
    } catch (err) {
      console.error("Ошибка при добавлении уведомлений:", err);
      throw err;
    }
  },

  async getPending() {
    try {
      const pending = await notificationsOutboxModel.findMany({
        status: "pending",
      });
      return pending;
    } catch (err) {
      console.error("Ошибка при получении pending уведомлений:", err);
      throw err;
    }
  },

  async update(id, data) {
    try {
      const updated = await notificationsOutboxModel.update(id, data);
      return updated;
    } catch (err) {
      console.error(`Ошибка при обновлении уведомления с id=${id}:`, err);
      throw err;
    }
  },

  async deleteOldSent() {
    try {
      const threeDaysAgo = subDays(new Date(), 3);

      const result = await notificationsOutboxModel.deleteMany({
        where: {
          status: "sent",
          created_at: { lt: threeDaysAgo },
        },
      });

      console.log(`🗑 Удалено старых sent уведомлений: ${result.count}`);
      return result;
    } catch (err) {
      console.error("❌ Ошибка при удалении старых sent уведомлений:", err);
      throw err;
    }
  },

  async deleteMany(filter) {
    return prisma.notifications_outbox.deleteMany({
      where: filter,
    });
  },
};
