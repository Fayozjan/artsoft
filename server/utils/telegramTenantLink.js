import { prismaPublic } from "./prismaForTenant.js";
import { tenantContext } from "./tenantContext.js";

// Вход через телеграм сначала ищет арендатора по public.tenant_telegram_users
// (telegram_id → tenant) и только потом логин в его схеме по users.telegram_id.
// Поэтому привязку ведём вместе с users.telegram_id.

// "" и пробелы → null; undefined остаётся undefined («поле не менялось»)
export const normalizeTelegramId = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value).trim() || null;
};

const currentTenantId = () => {
  const tenant = tenantContext.get();
  if (!tenant) throw new Error("Не определён арендатор для привязки Telegram ID");
  return tenant.id;
};

// telegram_id глобально уникален: занятый другим арендатором ID привязать нельзя.
// Вызывать до записи логина, чтобы не оставить его без привязки.
export const assertTelegramIdFree = async (telegramId) => {
  if (!telegramId) return;

  const existing = await prismaPublic.tenant_telegram_users.findUnique({
    where: { telegram_id: telegramId },
  });

  if (existing && existing.tenant_id !== currentTenantId()) {
    const error = new Error("Этот Telegram ID уже привязан к другой организации.");
    error.statusCode = 409;
    throw error;
  }
};

// Приводит привязку в соответствие с логином: старый ID убираем, новый добавляем.
// Upsert также лечит логины, у которых привязки не было.
export const syncTelegramLink = async (oldTelegramId, newTelegramId) => {
  const tenantId = currentTenantId();

  if (oldTelegramId && oldTelegramId !== newTelegramId) {
    await prismaPublic.tenant_telegram_users.deleteMany({
      where: { telegram_id: oldTelegramId, tenant_id: tenantId },
    });
  }

  if (newTelegramId) {
    await prismaPublic.tenant_telegram_users.upsert({
      where: { telegram_id: newTelegramId },
      create: { telegram_id: newTelegramId, tenant_id: tenantId },
      update: {},
    });
  }
};
