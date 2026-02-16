import { telegramBotsModel } from "./telegramBots.model.js";

export const telegramBotsService = {
  getEventAlertBots: async () => {
    try {
      const bots = await telegramBotsModel.getEventAlertBots();
      const employeeMap = new Map();

      bots.forEach((bot) => {
        bot.selectedEmployeeIds.forEach((employeeId) => {
          if (!employeeMap.has(employeeId)) {
            employeeMap.set(employeeId, new Set());
          }
          employeeMap.get(employeeId).add(bot.chat_id);
        });
      });

      return employeeMap;
    } catch (err) {
      console.error("Ошибка при получении телеграм ботов в сервисе:", err);
      throw err;
    }
  },
};
