import { prismaContext } from "./prismaContext.js";
import { requestContext } from "./requestContext.js";

// Пачка записей одним запросом — для массовых правок (по записи на изменённую строку).
export const createAuditLogs = async (entries) => {
  if (entries.length === 0) return;
  try {
    const prisma = prismaContext.get();
    const { ip, userAgent } = requestContext.get();
    await prisma.audit_logs.createMany({
      data: entries.map(({ userId, action, entity, recordId, oldData, newData }) => ({
        entity,
        record_id: recordId ? parseInt(recordId) : null,
        action,
        old_data: oldData ?? null,
        new_data: newData ?? null,
        user_id: userId ? parseInt(userId) : null,
        ip_address: ip ?? null,
        user_agent: userAgent ?? null,
      })),
    });
  } catch (err) {
    console.error("[audit]", err.message);
  }
};

export const createAuditLog = async ({ userId, action, entity, recordId, oldData, newData }) => {
  try {
    const prisma = prismaContext.get();
    const { ip, userAgent } = requestContext.get();
    await prisma.audit_logs.create({
      data: {
        entity,
        record_id: recordId ? parseInt(recordId) : null,
        action,
        old_data: oldData ?? null,
        new_data: newData ?? null,
        user_id: userId ? parseInt(userId) : null,
        ip_address: ip ?? null,
        user_agent: userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[audit]", err.message);
  }
};
