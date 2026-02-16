import { notificationsOutboxModel } from "./notificationsOutbox.model.js";

export const notificationsOutboxService = {
  async sendNotifications(newPassId, chats) {
    if (!chats || chats.size === 0) return;

    const notifications = Array.from(chats).map((chat_id) => ({
      face_pass_id: newPassId,
      chat_id,
    }));

    try {
      await notificationsOutboxModel.createMany(notifications);
    } catch (err) {
      console.error("Ошибка при добавлении уведомлений:", err);
      throw err;
    }
  },

  async getPendingNotifications() {
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

  async updateNotification(id, data) {
    try {
      const updated = await notificationsOutboxModel.update(id, data);
      return updated;
    } catch (err) {
      console.error(`Ошибка при обновлении уведомления с id=${id}:`, err);
      throw err;
    }
  },

  async deleteOldSentNotifications() {
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
