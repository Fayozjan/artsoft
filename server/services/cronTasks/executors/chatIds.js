import { InputFile } from "grammy";

// Задачи, сохранённые до перехода на множественный выбор чатов, хранят одиночный chat_id.
export function getChatIds(config) {
  if (Array.isArray(config.chat_ids) && config.chat_ids.length) {
    return config.chat_ids;
  }
  return config.chat_id ? [config.chat_id] : [];
}

// Отправка одного файла нескольким chat_id: сбой одного (например, «chat not found»)
// не должен блокировать отправку остальным. Бросает только если не доставлено никому —
// тогда задача целиком помечается error, как раньше.
export async function sendDocumentToChats(bot, chatIds, filePath, fileName, options) {
  const failed = [];
  for (const chatId of chatIds) {
    try {
      await bot.api.sendDocument(chatId, new InputFile(filePath, fileName), options);
    } catch (err) {
      failed.push(`${chatId}: ${err.message}`);
    }
  }
  if (failed.length === chatIds.length) {
    throw new Error(failed.join("; "));
  }
  return failed;
}
